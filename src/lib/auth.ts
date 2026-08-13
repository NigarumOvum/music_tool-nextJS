import { createClient } from "@libsql/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { ALL_ACCESS_PAGE_MAP, MANAGEABLE_PAGES, type ManagedPageKey } from "@/lib/access";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { sendEmail } from "@/lib/email";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const EMAIL_CONFIRMATION_DURATION_MS = 1000 * 60 * 60 * 24;
const PASSWORD_RESET_DURATION_MS = 1000 * 60 * 30;
const BOOTSTRAP_ADMIN_EMAILS = new Set(["b.pdrn.rdz@gmail.com"]);

type AuthEmailTokenType = "email-confirmation" | "password-reset";

type NullableString = string | null | undefined;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: string | null;
  isAdmin: boolean;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type RegisteredUserAccess = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: string | null;
  isAdmin: boolean;
  pageAccess: Record<ManagedPageKey, boolean>;
};

let client: ReturnType<typeof createClient> | null = null;
let authTablesReady = false;

async function ensureColumn(table: string, column: string, definition: string) {
  const db = getAuthClient();
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((row) => String((row as Record<string, unknown>).name) === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

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

function isBootstrapAdminEmail(email: string) {
  return BOOTSTRAP_ADMIN_EMAILS.has(normalizeEmail(email));
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

function resolveIsAdmin(email: string, isAdminFromDb: boolean) {
  return isAdminFromDb || isBootstrapAdminEmail(email);
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    isAdmin: resolveIsAdmin(user.email, user.isAdmin),
  };
}

function mapUserRow(row: Record<string, unknown>): AuthUser {
  const email = String(row.email);
  return normalizeAuthUser({
    id: String(row.id),
    email,
    name: (row.name as string | null) ?? null,
    emailVerifiedAt: (row.email_verified_at as string | null) ?? null,
    isAdmin: Number(row.is_admin ?? 0) === 1,
  });
}

function getDefaultPageAccessMap() {
  return Object.fromEntries(
    MANAGEABLE_PAGES.map((page) => [page.key, false]),
  ) as Record<ManagedPageKey, boolean>;
}

async function ensureBootstrapAdmins() {
  const db = getAuthClient();
  for (const email of BOOTSTRAP_ADMIN_EMAILS) {
    await db.execute({
      sql: "update app_user set is_admin = 1 where lower(email) = ?",
      args: [email],
    });
  }
}

async function getUserPageAccessMap(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return ALL_ACCESS_PAGE_MAP;
  }

  await ensureAuthTables();
  const db = getAuthClient();
  const result = await db.execute({
    sql: "select page_key, can_access from app_page_access where user_id = ?",
    args: [userId],
  });

  const accessMap = getDefaultPageAccessMap();
  for (const row of result.rows) {
    const pageKey = String((row as Record<string, unknown>).page_key);
    if (!MANAGEABLE_PAGES.some((page) => page.key === pageKey)) {
      continue;
    }

    accessMap[pageKey as ManagedPageKey] = Number((row as Record<string, unknown>).can_access ?? 1) === 1;
  }

  return accessMap;
}

async function createAuthEmailToken(userId: string, type: AuthEmailTokenType) {
  await ensureAuthTables();
  const db = getAuthClient();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + (type === "email-confirmation" ? EMAIL_CONFIRMATION_DURATION_MS : PASSWORD_RESET_DURATION_MS)).toISOString();

  await db.execute({
    sql: `
      insert into app_email_token (id, user_id, type, token_hash, expires_at, created_at, consumed_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [crypto.randomUUID(), userId, type, hashToken(token), expiresAt, isoNow(), null],
  });

  return token;
}

async function consumeAuthEmailToken(token: string, type: AuthEmailTokenType) {
  await ensureAuthTables();
  const db = getAuthClient();
  const result = await db.execute({
    sql: `
      select app_email_token.*, app_user.email as email, app_user.name as name, app_user.email_verified_at as email_verified_at, app_user.is_admin as is_admin
      from app_email_token
      join app_user on app_user.id = app_email_token.user_id
      where app_email_token.token_hash = ? and app_email_token.type = ?
      limit 1
    `,
    args: [hashToken(token), type],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("Invalid or expired token");
  }

  if (row.consumed_at) {
    throw new Error("Invalid or expired token");
  }

  if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
    throw new Error("Invalid or expired token");
  }

  await db.execute({
    sql: "update app_email_token set consumed_at = ? where id = ?",
    args: [isoNow(), String(row.id)],
  });

  return normalizeAuthUser({
    id: String(row.user_id),
    email: String(row.email),
    name: (row.name as string | null) ?? null,
    emailVerifiedAt: (row.email_verified_at as string | null) ?? null,
    isAdmin: Number(row.is_admin ?? 0) === 1,
  });
}

async function sendVerificationEmail(user: AuthUser, token: string) {
  const url = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Confirm your Music Tool email",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h1 style="font-size:24px">Confirm your email</h1>
        <p>Hi ${user.name || user.email},</p>
        <p>Confirm your Music Tool account to finish setup.</p>
        <p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#c2793f;color:#fff;text-decoration:none;border-radius:9999px">Confirm email</a></p>
        <p>If the button does not work, open this link:</p>
        <p>${url}</p>
      </div>
    `,
    text: `Confirm your Music Tool email: ${url}`,
  });
}

async function sendPasswordResetEmail(user: AuthUser, token: string) {
  const url = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Music Tool password",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h1 style="font-size:24px">Reset your password</h1>
        <p>Hi ${user.name || user.email},</p>
        <p>Use the link below to set a new Music Tool password.</p>
        <p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#c2793f;color:#fff;text-decoration:none;border-radius:9999px">Reset password</a></p>
        <p>If the button does not work, open this link:</p>
        <p>${url}</p>
      </div>
    `,
    text: `Reset your Music Tool password: ${url}`,
  });
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
  const db = getAuthClient();

  if (authTablesReady) {
    await ensureBootstrapAdmins();
    return;
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_user (
      id text PRIMARY KEY NOT NULL,
      email text NOT NULL,
      name text,
      email_verified_at text,
      is_admin integer NOT NULL DEFAULT 0,
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_email_token (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      type text NOT NULL,
      token_hash text NOT NULL,
      expires_at text NOT NULL,
      created_at text NOT NULL,
      consumed_at text
    )
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_email_token_hash_idx
    ON app_email_token (token_hash)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS app_email_token_user_idx
    ON app_email_token (user_id, type, expires_at)
  `);
  await ensureColumn("app_user", "email_verified_at", "text");
  await ensureColumn("app_user", "is_admin", "integer NOT NULL DEFAULT 0");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_page_access (
      user_id text NOT NULL,
      page_key text NOT NULL,
      can_access integer NOT NULL,
      updated_at text NOT NULL,
      updated_by text,
      PRIMARY KEY (user_id, page_key)
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS app_page_access_user_idx
    ON app_page_access (user_id, page_key)
  `);
  await ensureBootstrapAdmins();

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
        app_user.name as name,
        app_user.email_verified_at as email_verified_at,
        app_user.is_admin as is_admin
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
    user: normalizeAuthUser({
      id: String(row.id),
      email: String(row.email),
      name: (row.name as string | null) ?? null,
      emailVerifiedAt: (row.email_verified_at as string | null) ?? null,
      isAdmin: Number(row.is_admin ?? 0) === 1,
    }),
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

export async function requireAdminCurrentUser() {
  const user = await requireCurrentUser();
  if (!user.isAdmin) {
    redirect("/account");
  }

  return user;
}

export async function requireAdminApiUser(request: Request) {
  const user = await requireApiUser(request);
  if (!user.isAdmin) {
    throw new Error("Forbidden");
  }

  return user;
}

export async function ensureUserCanAccessPage(user: AuthUser, pageKey: ManagedPageKey) {
  const accessMap = await getUserPageAccessMap(user.id, user.isAdmin);
  return accessMap[pageKey];
}

export async function listRegisteredUsersWithAccess() {
  await ensureAuthTables();
  const db = getAuthClient();
  const [usersResult, accessResult] = await Promise.all([
    db.execute({
      sql: "select id, email, name, email_verified_at, is_admin from app_user order by is_admin desc, email asc",
    }),
    db.execute({
      sql: "select user_id, page_key, can_access from app_page_access",
    }),
  ]);

  const accessByUser = new Map<string, Record<ManagedPageKey, boolean>>();
  for (const row of accessResult.rows) {
    const userId = String((row as Record<string, unknown>).user_id);
    const pageKey = String((row as Record<string, unknown>).page_key);
    if (!MANAGEABLE_PAGES.some((page) => page.key === pageKey)) {
      continue;
    }

    const existing = accessByUser.get(userId) || getDefaultPageAccessMap();
    existing[pageKey as ManagedPageKey] = Number((row as Record<string, unknown>).can_access ?? 1) === 1;
    accessByUser.set(userId, existing);
  }

  return usersResult.rows.map((row) => {
    const user = mapUserRow(row as Record<string, unknown>);
    const pageAccess = user.isAdmin ? ALL_ACCESS_PAGE_MAP : (accessByUser.get(user.id) || getDefaultPageAccessMap());

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
      isAdmin: user.isAdmin,
      pageAccess,
    } satisfies RegisteredUserAccess;
  });
}

export async function updateRegisteredUserAccess(options: {
  targetUserId: string;
  pageKey: ManagedPageKey;
  canAccess: boolean;
  actingUserId: string;
}) {
  await ensureAuthTables();
  const db = getAuthClient();
  const targetResult = await db.execute({
    sql: "select id, is_admin from app_user where id = ? limit 1",
    args: [options.targetUserId],
  });
  const target = targetResult.rows[0] as Record<string, unknown> | undefined;
  if (!target) {
    throw new Error("User not found");
  }

  if (Number(target.is_admin ?? 0) === 1) {
    throw new Error("Admin access is fixed and cannot be edited here");
  }

  await db.execute({
    sql: `
      insert into app_page_access (user_id, page_key, can_access, updated_at, updated_by)
      values (?, ?, ?, ?, ?)
      on conflict(user_id, page_key)
      do update set can_access = excluded.can_access, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    `,
    args: [options.targetUserId, options.pageKey, options.canAccess ? 1 : 0, isoNow(), options.actingUserId],
  });
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
    email_verified_at: null,
    is_admin: isBootstrapAdminEmail(email) ? 1 : 0,
    password_hash: hashPassword(password),
    created_at: now,
    updated_at: now,
  };

  await db.execute({
    sql: `
      insert into app_user (id, email, name, email_verified_at, is_admin, password_hash, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [user.id, user.email, user.name, user.email_verified_at, user.is_admin, user.password_hash, user.created_at, user.updated_at],
  });

  try {
    const token = await createAuthEmailToken(user.id, "email-confirmation");
    await sendVerificationEmail(mapUserRow(user), token);
  } catch (error) {
    await db.execute({ sql: "delete from app_user where id = ?", args: [user.id] });
    throw error;
  }

  return mapUserRow(user);
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

  if (!row.email_verified_at) {
    throw new Error("Please confirm your email before logging in");
  }

  const session = await createSession(String(row.id));
  await setSessionCookie(session);

  return mapUserRow(row);
}

export async function resendEmailConfirmation(emailInput: string) {
  await ensureAuthTables();
  const db = getAuthClient();
  const email = normalizeEmail(emailInput);
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }

  const result = await db.execute({
    sql: "select * from app_user where email = ? limit 1",
    args: [email],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return;
  }

  if (row.email_verified_at) {
    return;
  }

  const token = await createAuthEmailToken(String(row.id), "email-confirmation");
  await sendVerificationEmail(mapUserRow(row), token);
}

export async function confirmEmail(token: string) {
  const user = await consumeAuthEmailToken(token, "email-confirmation");
  if (user.emailVerifiedAt) {
    return user;
  }

  await ensureAuthTables();
  const db = getAuthClient();
  const verifiedAt = isoNow();
  await db.execute({
    sql: "update app_user set email_verified_at = ?, updated_at = ? where id = ?",
    args: [verifiedAt, verifiedAt, user.id],
  });

  return {
    ...user,
    emailVerifiedAt: verifiedAt,
  } satisfies AuthUser;
}

export async function requestPasswordReset(emailInput: string) {
  await ensureAuthTables();
  const db = getAuthClient();
  const email = normalizeEmail(emailInput);
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }

  const result = await db.execute({
    sql: "select * from app_user where email = ? limit 1",
    args: [email],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return;
  }

  const token = await createAuthEmailToken(String(row.id), "password-reset");
  await sendPasswordResetEmail(mapUserRow(row), token);
}

export async function resetPassword(token: string, nextPassword: string) {
  const password = nextPassword.trim();
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const user = await consumeAuthEmailToken(token, "password-reset");
  await ensureAuthTables();
  const db = getAuthClient();
  const now = isoNow();
  await db.execute({
    sql: "update app_user set password_hash = ?, updated_at = ? where id = ?",
    args: [hashPassword(password), now, user.id],
  });
  await db.execute({ sql: "delete from app_session where user_id = ?", args: [user.id] });

  return user;
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