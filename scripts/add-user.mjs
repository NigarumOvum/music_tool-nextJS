import { createClient } from "@libsql/client";
import { randomBytes, scryptSync } from "node:crypto";

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = { email: null, name: null, password: null, admin: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--email") {
      options.email = argv[index + 1]?.trim().toLowerCase() || null;
      index += 1;
      continue;
    }
    if (arg === "--name") {
      options.name = argv[index + 1]?.trim() || null;
      index += 1;
      continue;
    }
    if (arg === "--password") {
      options.password = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === "--admin") {
      options.admin = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`
Usage: node scripts/add-user.mjs [options]

Creates a user directly in the auth database (app_user).

Options:
  --email <email>      Required. Email of the user to create.
  --name <name>        Optional. Display name.
  --password <pass>    Optional. Password to set (min 8 chars).
                       If omitted, a random password is generated and printed.
  --admin              Optional. Mark the user as admin.
  --help               Show this help.

Requires environment variables:
  MUSIC_TURSO_DATABASE_URL, MUSIC_TURSO_AUTH_TOKEN
`);
}

function generatePassword() {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function isoNow() {
  return new Date().toISOString();
}

async function ensureAuthTables(db) {
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
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const email = options.email || "";
  if (!email.includes("@")) {
    throw new Error("A valid --email is required");
  }

  const password = options.password || generatePassword();
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const db = createClient({
    url: readEnv("MUSIC_TURSO_DATABASE_URL"),
    authToken: readEnv("MUSIC_TURSO_AUTH_TOKEN"),
  });

  await ensureAuthTables(db);

  const existing = await db.execute({
    sql: "select id from app_user where email = ? limit 1",
    args: [email],
  });
  if (existing.rows[0]) {
    throw new Error(`Email already registered: ${email}`);
  }

  const now = isoNow();
  const user = {
    id: randomBytes(16).toString("hex"),
    email,
    name: options.name || null,
    email_verified_at: now,
    is_admin: options.admin ? 1 : 0,
    password_hash: hashPassword(password),
    created_at: now,
    updated_at: now,
  };

  await db.execute({
    sql: `
      insert into app_user (id, email, name, email_verified_at, is_admin, password_hash, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      user.id,
      user.email,
      user.name,
      user.email_verified_at,
      user.is_admin,
      user.password_hash,
      user.created_at,
      user.updated_at,
    ],
  });

  console.log("User created successfully:");
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Name:     ${user.name || "(none)"}`);
  console.log(`  Admin:    ${user.is_admin === 1 ? "yes" : "no"}`);
  console.log(`  Email verified: yes (can log in immediately)`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});