import { createClient } from "@libsql/client";

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseArgs(argv) {
  const options = {
    email: null,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--email") {
      options.email = argv[index + 1]?.trim().toLowerCase() || null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run migrate:legacy-music-ownership -- [--email user@example.com] [--dry-run]

Behavior:
  - assigns orphaned songs (songs.user_id is null or empty) to one user
  - assigns orphaned snapshots and partitures linked to those songs to the same user
  - assigns orphaned templates (music_task_template.user_id is null or empty) to the same user
  - if exactly one app user exists, --email is optional
  - if multiple app users exist, --email is required

Options:
  --email    target app user email
  --dry-run  print counts without mutating data
  --help     show this message
`);
}

async function tableExists(db, tableName) {
  const result = await db.execute({
    sql: "select name from sqlite_master where type = 'table' and name = ? limit 1",
    args: [tableName],
  });

  return Boolean(result.rows[0]);
}

async function requireTable(db, tableName, message) {
  if (!(await tableExists(db, tableName))) {
    throw new Error(message);
  }
}

async function getTargetUser(db, requestedEmail) {
  if (requestedEmail) {
    const result = await db.execute({
      sql: "select id, email, name from app_user where lower(email) = ? limit 1",
      args: [requestedEmail],
    });
    const row = result.rows[0];
    if (!row) {
      throw new Error(`No app user found for email: ${requestedEmail}`);
    }

    return {
      id: String(row.id),
      email: String(row.email),
      name: row.name == null ? null : String(row.name),
    };
  }

  const result = await db.execute({
    sql: "select id, email, name from app_user order by created_at asc",
  });

  if (result.rows.length === 0) {
    throw new Error("No app users exist yet. Register a user first, then rerun this migration.");
  }

  if (result.rows.length > 1) {
    throw new Error("Multiple app users exist. Rerun with --email user@example.com to choose the owner.");
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name == null ? null : String(row.name),
  };
}

async function countOrphanedSongs(db) {
  const result = await db.execute({
    sql: "select count(*) as total from songs where user_id is null or trim(user_id) = ''",
  });
  return Number(result.rows[0]?.total ?? 0);
}

async function countOrphanedSnapshotsForSongs(db) {
  if (!(await tableExists(db, "music_song_snapshot"))) {
    return 0;
  }

  const result = await db.execute({
    sql: `
      select count(*) as total
      from music_song_snapshot
      where (user_id is null or trim(user_id) = '')
        and songId in (select id from songs where user_id is null or trim(user_id) = '')
    `,
  });
  return Number(result.rows[0]?.total ?? 0);
}

async function countOrphanedPartituresForSongs(db) {
  if (!(await tableExists(db, "song_partitures"))) {
    return 0;
  }

  const result = await db.execute({
    sql: `
      select count(*) as total
      from song_partitures
      where (user_id is null or trim(user_id) = '')
        and song_id in (select id from songs where user_id is null or trim(user_id) = '')
    `,
  });
  return Number(result.rows[0]?.total ?? 0);
}

async function countOrphanedTemplates(db) {
  if (!(await tableExists(db, "music_task_template"))) {
    return 0;
  }

  const result = await db.execute({
    sql: "select count(*) as total from music_task_template where user_id is null or trim(user_id) = ''",
  });
  return Number(result.rows[0]?.total ?? 0);
}

async function assignLegacyOwnership(db, userId) {
  const songResult = await db.execute({
    sql: "update songs set user_id = ? where user_id is null or trim(user_id) = ''",
    args: [userId],
  });

  const snapshotResult = (await tableExists(db, "music_song_snapshot"))
    ? await db.execute({
      sql: `
        update music_song_snapshot
        set user_id = ?
        where (user_id is null or trim(user_id) = '')
          and songId in (select id from songs where user_id = ?)
      `,
      args: [userId, userId],
    })
    : { rowsAffected: 0 };

  const partitureResult = (await tableExists(db, "song_partitures"))
    ? await db.execute({
      sql: `
        update song_partitures
        set user_id = ?
        where (user_id is null or trim(user_id) = '')
          and song_id in (select id from songs where user_id = ?)
      `,
      args: [userId, userId],
    })
    : { rowsAffected: 0 };

  const templateResult = (await tableExists(db, "music_task_template"))
    ? await db.execute({
      sql: "update music_task_template set user_id = ? where user_id is null or trim(user_id) = ''",
      args: [userId],
    })
    : { rowsAffected: 0 };

  return {
    songs: Number(songResult.rowsAffected ?? 0),
    snapshots: Number(snapshotResult.rowsAffected ?? 0),
    partitures: Number(partitureResult.rowsAffected ?? 0),
    templates: Number(templateResult.rowsAffected ?? 0),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const db = createClient({
    url: readEnv("MUSIC_TURSO_DATABASE_URL"),
    authToken: readEnv("MUSIC_TURSO_AUTH_TOKEN"),
  });

  await requireTable(
    db,
    "songs",
    "The songs table does not exist in this database. Run the app against the intended music database, then rerun this migration.",
  );
  await requireTable(
    db,
    "app_user",
    "The app_user table does not exist yet. Register a user in the app first, then rerun this migration.",
  );

  const user = await getTargetUser(db, options.email);
  const counts = {
    songs: await countOrphanedSongs(db),
    snapshots: await countOrphanedSnapshotsForSongs(db),
    partitures: await countOrphanedPartituresForSongs(db),
    templates: await countOrphanedTemplates(db),
  };

  console.log(`Target user: ${user.email}${user.name ? ` (${user.name})` : ""}`);
  console.log(`Orphaned songs: ${counts.songs}`);
  console.log(`Orphaned snapshots linked to orphaned songs: ${counts.snapshots}`);
  console.log(`Orphaned partitures linked to orphaned songs: ${counts.partitures}`);
  console.log(`Orphaned templates: ${counts.templates}`);

  if (options.dryRun) {
    console.log("Dry run complete. No records were changed.");
    return;
  }

  const updated = await assignLegacyOwnership(db, user.id);
  console.log("Migration complete.");
  console.log(`Assigned songs: ${updated.songs}`);
  console.log(`Assigned snapshots: ${updated.snapshots}`);
  console.log(`Assigned partitures: ${updated.partitures}`);
  console.log(`Assigned templates: ${updated.templates}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});