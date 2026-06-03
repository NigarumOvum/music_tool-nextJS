import { createClient } from "@libsql/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

type NullableString = string | null | undefined;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

let client: ReturnType<typeof createClient> | null = null;
let authTablesReady = false;

function getAuthClient() {
  if (client) {
    return client;
  }

  const url = process.env.MUSIC_TURSO_DATABASE_URL;
  const authToken = process.env.MUSIC_TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Music production database is not configured");
  }

  client = createClient({ url, authToken });
  return client;
}

function isoNow() {
  return new Date().toISOString();
}

function normalizeText(value: NullableString) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) {
    return false;
  }

  const computed = scryptSync(password, salt, 64);
  const original = Buffer.from(originalHash, "hex");
  if (computed.byteLength !== original.byteLength) {
    return false;
  }

  return timingSafeEqual(computed, original);
}

function parseCookieValue(header: string | null, name: string) {
  if (!header) {
    return null;
  }

  const parts = header.split(/;\s*/);
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = part.slice(0, separator);
    if (key === name) {
      return decodeURIComponent(part.slice(separator + 1));
    }
  }

  return null;
}

async function ensureAuthTables() {
  if (authTablesReady) {
    return;
  }

  const db = getAuthClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_user (
      id text PRIMARY KEY NOT NULL,
      email text NOT NULL,
      name text,
      password_hash text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_idx
    ON app_user (email)
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_session (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      expires_at text NOT NULL,
      created_at text NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS app_session_user_idx
    ON app_session (user_id, expires_at)
  `);

  authTablesReady = true;
}

async function getSessionRecord(sessionId: string | null) {
  if (!sessionId) {
    return null;
  }

  await ensureAuthTables();
  const db = getAuthClient();
  const result = await db.execute({
    sql: `
      select
        app_session.id as session_id,
        app_session.user_id as user_id,
        app_session.expires_at as expires_at,
        app_user.id as id,
        app_user.email as email,
        app_user.name as name
      from app_session
      join app_user on app_user.id = app_session.user_id
      where app_session.id = ?
      limit 1
    `,
    args: [sessionId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
    await db.execute({ sql: "delete from app_session where id = ?", args: [sessionId] });
    return null;
  }

  return {
    session: {
      id: String(row.session_id),
      userId: String(row.user_id),
      expiresAt: String(row.expires_at),
    } satisfies AuthSession,
    user: {
      id: String(row.id),
      email: String(row.email),
      name: (row.name as string | null) ?? null,
    } satisfies AuthUser,
  };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
  const record = await getSessionRecord(sessionId);
  return record?.user || null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireApiUser(request: Request) {
  const sessionId = parseCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  const record = await getSessionRecord(sessionId);
  if (!record) {
    throw new Error("Unauthorized");
  }

  return record.user;
}

async function createSession(userId: string) {
  await ensureAuthTables();
  const db = getAuthClient();
  const session = {
    id: crypto.randomUUID(),
    user_id: userId,
    expires_at: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    created_at: isoNow(),
  };

  await db.execute({
    sql: `
      insert into app_session (id, user_id, expires_at, created_at)
      values (?, ?, ?, ?)
    `,
    args: [session.id, session.user_id, session.expires_at, session.created_at],
  });

  return {
    id: session.id,
    userId: session.user_id,
    expiresAt: session.expires_at,
  } satisfies AuthSession;
}

export async function setSessionCookie(session: AuthSession) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

export async function registerUser(input: { name?: string | null; email: string; password: string }) {
  await ensureAuthTables();
  const db = getAuthClient();
  const email = normalizeEmail(input.email);
  const name = normalizeText(input.name);
  const password = input.password.trim();

  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existing = await db.execute({
    sql: "select id from app_user where email = ? limit 1",
    args: [email],
  });
  if (existing.rows[0]) {
    throw new Error("Email is already registered");
  }

  const now = isoNow();
  const user = {
    id: crypto.randomUUID(),
    email,
    name,
    password_hash: hashPassword(password),
    created_at: now,
    updated_at: now,
  };

  await db.execute({
    sql: `
      insert into app_user (id, email, name, password_hash, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?)
    `,
    args: [user.id, user.email, user.name, user.password_hash, user.created_at, user.updated_at],
  });

  const session = await createSession(user.id);
  await setSessionCookie(session);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  } satisfies AuthUser;
}

export async function loginUser(input: { email: string; password: string }) {
  await ensureAuthTables();
  const db = getAuthClient();
  const email = normalizeEmail(input.email);
  const password = input.password;

  const result = await db.execute({
    sql: "select * from app_user where email = ? limit 1",
    args: [email],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;

  if (!row || !verifyPassword(password, String(row.password_hash))) {
    throw new Error("Invalid email or password");
  }

  const session = await createSession(String(row.id));
  await setSessionCookie(session);

  return {
    id: String(row.id),
    email: String(row.email),
    name: (row.name as string | null) ?? null,
  } satisfies AuthUser;
}

export async function logoutUser(request: Request) {
  await ensureAuthTables();
  const db = getAuthClient();
  const sessionId = parseCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (sessionId) {
    await db.execute({ sql: "delete from app_session where id = ?", args: [sessionId] });
  }
  await clearSessionCookie();
}