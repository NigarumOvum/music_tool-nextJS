import { createClient } from "@libsql/client";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = { email: null, password: null, help: false };
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
    if (arg === "--password") {
      options.password = argv[index + 1] || null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.email || !options.password) {
    console.log(`
Usage: node scripts/set-password.mjs --email <email> --password <pass>

Sets a new password for an existing user and rotates their sessions.

Requires environment variables:
  MUSIC_TURSO_DATABASE_URL, MUSIC_TURSO_AUTH_TOKEN
`);
    return;
  }

  const email = options.email;
  if (!email.includes("@")) {
    throw new Error("A valid --email is required");
  }
  if (options.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const db = createClient({
    url: readEnv("MUSIC_TURSO_DATABASE_URL"),
    authToken: readEnv("MUSIC_TURSO_AUTH_TOKEN"),
  });

  const existing = await db.execute({
    sql: "select id, email, is_admin from app_user where email = ? limit 1",
    args: [email],
  });
  const row = existing.rows[0];
  if (!row) {
    const similar = await db.execute({
      sql: "select email from app_user where email like ? limit 10",
      args: [`%${email.split("@")[0]}%`],
    });
    console.log(`No user found with email: ${email}`);
    if (similar.rows.length > 0) {
      console.log("Similar emails in system:");
      for (const r of similar.rows) console.log(`  - ${r.email}`);
    }
    process.exit(1);
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: "update app_user set password_hash = ?, updated_at = ? where id = ?",
    args: [hashPassword(options.password), now, String(row.id)],
  });
  await db.execute({ sql: "delete from app_session where user_id = ?", args: [String(row.id)] });

  // Verify the stored hash the same way the app does.
  const check = await db.execute({
    sql: "select password_hash from app_user where id = ?",
    args: [String(row.id)],
  });
  const [salt, originalHash] = String(check.rows[0].password_hash).split(":");
  const computed = scryptSync(options.password, salt, 64);
  const ok =
    computed.byteLength === Buffer.from(originalHash, "hex").byteLength &&
    timingSafeEqual(computed, Buffer.from(originalHash, "hex"));

  console.log(`Password updated for: ${row.email} (admin: ${Number(row.is_admin) === 1})`);
  console.log("Password verifies:", ok);
  console.log("Sessions rotated: yes");
  if (!ok) process.exit(1);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
