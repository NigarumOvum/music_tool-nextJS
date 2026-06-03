import { createClient } from "@libsql/client";

import type {
  MusicPartRecord,
  MusicPartitureRecord,
  MusicSongDetail,
  MusicSongDraftInput,
  MusicSongRecord,
  MusicSongSummary,
  MusicTaskTemplateRecord,
  MusicTemplatePartKind,
  MusicTemplateSongField,
  MusicTemplateTargetType,
} from "@/lib/music/types";

type NullableString = string | null | undefined;

const SONG_UPDATE_FIELDS = new Set([
  "title",
  "topic",
  "emotion",
  "genre",
  "language",
  "reference_text",
  "lyrics_text",
  "song_json",
  "melody_json",
  "midi_blueprints_json",
  "production_json",
  "metadata_json",
  "bpm",
  "musical_key",
  "structure_text",
  "hook_summary",
  "vocal_style",
  "instrumentation",
  "mood_tags_json",
  "project_slug",
  "project_dir",
  "saved_at",
  "enhanced_from_song_id",
  "enhanced_from_title",
  "has_arrangement_midi",
]);

const MUSIC_TEMPLATE_TARGET_TYPES: MusicTemplateTargetType[] = ["song-field", "part"];
const MUSIC_TEMPLATE_SONG_FIELDS: MusicTemplateSongField[] = [
  "title",
  "topic",
  "emotion",
  "reference_text",
  "lyrics_text",
  "structure_text",
  "song_json",
  "production_json",
  "metadata_json",
];
const MUSIC_TEMPLATE_PART_KINDS: MusicTemplatePartKind[] = ["section", "layer"];

let client: ReturnType<typeof createClient> | null = null;
let supportTablesReady = false;

async function ensureColumn(table: string, column: string, definition: string) {
  const db = getMusicClient();
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((row) => String((row as Record<string, unknown>).name) === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function getMusicClient() {
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

function normalizeNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid numeric value");
  }

  return parsed;
}

function stringifyJson(value: unknown, fallback: unknown = null) {
  if (value === undefined) {
    return fallback === null ? null : JSON.stringify(fallback, null, 2);
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      JSON.parse(trimmed);
    } catch {
      throw new Error("Invalid JSON payload");
    }

    return trimmed;
  }

  return JSON.stringify(value, null, 2);
}

function normalizeMoodTags(value: string | string[] | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }

  return stringifyJson(value);
}

function mapSongRow(row: Record<string, unknown>): MusicSongRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    topic: (row.topic as string | null) ?? null,
    emotion: (row.emotion as string | null) ?? null,
    genre: (row.genre as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    reference_text: (row.reference_text as string | null) ?? null,
    lyrics_text: (row.lyrics_text as string | null) ?? null,
    song_json: String(row.song_json ?? "{}"),
    melody_json: (row.melody_json as string | null) ?? null,
    midi_blueprints_json: (row.midi_blueprints_json as string | null) ?? null,
    production_json: (row.production_json as string | null) ?? null,
    metadata_json: (row.metadata_json as string | null) ?? null,
    bpm: (row.bpm as number | null) ?? null,
    musical_key: (row.musical_key as string | null) ?? null,
    structure_text: (row.structure_text as string | null) ?? null,
    hook_summary: (row.hook_summary as string | null) ?? null,
    vocal_style: (row.vocal_style as string | null) ?? null,
    instrumentation: (row.instrumentation as string | null) ?? null,
    mood_tags_json: (row.mood_tags_json as string | null) ?? null,
    project_slug: (row.project_slug as string | null) ?? null,
    project_dir: (row.project_dir as string | null) ?? null,
    saved_at: (row.saved_at as string | null) ?? null,
    enhanced_from_song_id: (row.enhanced_from_song_id as string | null) ?? null,
    enhanced_from_title: (row.enhanced_from_title as string | null) ?? null,
    has_arrangement_midi: Number(row.has_arrangement_midi ?? 0),
    arrangement_midi_bytes: (row.arrangement_midi_bytes as number | null) ?? null,
    arrangement_midi_sha256: (row.arrangement_midi_sha256 as string | null) ?? null,
    backup_run_id: String(row.backup_run_id ?? "manual"),
    synced_at: String(row.synced_at),
  };
}

function mapPartRows(rows: Array<Record<string, unknown>>, nameKey: "section_name" | "layer_name"): MusicPartRecord[] {
  return rows.map((row) => ({
    name: String(row[nameKey]),
    text: (row[nameKey === "section_name" ? "section_text" : "layer_text"] as string | null) ?? null,
    json: String(row[nameKey === "section_name" ? "section_json" : "layer_json"] ?? "{}"),
  }));
}

async function ensureMusicSupportTables() {
  if (supportTablesReady) {
    return;
  }

  const db = getMusicClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS songs (
      id text PRIMARY KEY NOT NULL,
      user_id text,
      title text NOT NULL,
      topic text,
      emotion text,
      genre text,
      language text,
      reference_text text,
      lyrics_text text,
      song_json text NOT NULL,
      melody_json text,
      midi_blueprints_json text,
      production_json text,
      metadata_json text,
      bpm real,
      musical_key text,
      structure_text text,
      hook_summary text,
      vocal_style text,
      instrumentation text,
      mood_tags_json text,
      project_slug text,
      project_dir text,
      saved_at text,
      enhanced_from_song_id text,
      enhanced_from_title text,
      has_arrangement_midi integer NOT NULL DEFAULT 0,
      arrangement_midi blob,
      arrangement_midi_bytes integer,
      arrangement_midi_sha256 text,
      backup_run_id text NOT NULL DEFAULT 'manual',
      synced_at text NOT NULL
    )
  `);
  await ensureColumn("songs", "user_id", "text");
  await ensureColumn("songs", "topic", "text");
  await ensureColumn("songs", "emotion", "text");
  await ensureColumn("songs", "genre", "text");
  await ensureColumn("songs", "language", "text");
  await ensureColumn("songs", "reference_text", "text");
  await ensureColumn("songs", "lyrics_text", "text");
  await ensureColumn("songs", "song_json", "text NOT NULL DEFAULT '{}' ");
  await ensureColumn("songs", "melody_json", "text");
  await ensureColumn("songs", "midi_blueprints_json", "text");
  await ensureColumn("songs", "production_json", "text");
  await ensureColumn("songs", "metadata_json", "text");
  await ensureColumn("songs", "bpm", "real");
  await ensureColumn("songs", "musical_key", "text");
  await ensureColumn("songs", "structure_text", "text");
  await ensureColumn("songs", "hook_summary", "text");
  await ensureColumn("songs", "vocal_style", "text");
  await ensureColumn("songs", "instrumentation", "text");
  await ensureColumn("songs", "mood_tags_json", "text");
  await ensureColumn("songs", "project_slug", "text");
  await ensureColumn("songs", "project_dir", "text");
  await ensureColumn("songs", "saved_at", "text");
  await ensureColumn("songs", "enhanced_from_song_id", "text");
  await ensureColumn("songs", "enhanced_from_title", "text");
  await ensureColumn("songs", "has_arrangement_midi", "integer NOT NULL DEFAULT 0");
  await ensureColumn("songs", "arrangement_midi", "blob");
  await ensureColumn("songs", "arrangement_midi_bytes", "integer");
  await ensureColumn("songs", "arrangement_midi_sha256", "text");
  await ensureColumn("songs", "backup_run_id", "text NOT NULL DEFAULT 'manual'");
  await ensureColumn("songs", "synced_at", "text NOT NULL DEFAULT ''");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS song_sections (
      song_id text NOT NULL,
      section_name text NOT NULL,
      section_json text NOT NULL,
      section_text text,
      synced_at text NOT NULL,
      PRIMARY KEY (song_id, section_name)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS song_layers (
      song_id text NOT NULL,
      layer_name text NOT NULL,
      layer_json text NOT NULL,
      layer_text text,
      synced_at text NOT NULL,
      PRIMARY KEY (song_id, layer_name)
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS song_sections_song_idx
    ON song_sections (song_id, synced_at)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS song_layers_song_idx
    ON song_layers (song_id, synced_at)
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS music_task_template (
      id text PRIMARY KEY NOT NULL,
      user_id text,
      name text NOT NULL,
      category text,
      description text,
      targetType text NOT NULL,
      targetField text,
      targetKinds text,
      instructions text NOT NULL,
      createdAt text NOT NULL,
      updatedAt text NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS music_task_template_name_idx
    ON music_task_template (name, createdAt)
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS song_partitures (
      id text PRIMARY KEY NOT NULL,
      song_id text NOT NULL,
      user_id text,
      instrument text NOT NULL,
      slot integer NOT NULL,
      title text NOT NULL,
      content text NOT NULL,
      format text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS song_partitures_song_idx
    ON song_partitures (song_id, instrument, slot)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS songs_user_idx
    ON songs (user_id, saved_at, synced_at)
  `);
  await ensureColumn("music_task_template", "user_id", "text");
  await ensureColumn("song_partitures", "user_id", "text");
  await db.execute(`
    CREATE INDEX IF NOT EXISTS music_task_template_user_idx
    ON music_task_template (user_id, name)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS song_partitures_user_idx
    ON song_partitures (user_id, song_id, instrument, slot)
  `);

  supportTablesReady = true;
}

async function requireOwnedSong(songId: string, userId: string) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const result = await db.execute({
    sql: "select id from songs where id = ? and user_id = ? limit 1",
    args: [songId, userId],
  });

  if (!result.rows[0]) {
    throw new Error("Song not found");
  }
}

export async function listSongs(userId: string, search?: string) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const normalizedSearch = search?.trim();
  let sql = `
    select
      songs.id,
      songs.title,
      songs.topic,
      songs.emotion,
      songs.genre,
      songs.language,
      songs.bpm,
      songs.musical_key,
      songs.hook_summary,
      songs.vocal_style,
      songs.instrumentation,
      songs.project_slug,
      songs.saved_at,
      songs.synced_at,
      (select count(*) from song_sections where song_sections.song_id = songs.id) as section_count,
      (select count(*) from song_layers where song_layers.song_id = songs.id) as layer_count
    from songs
    where songs.user_id = ?
  `;
  const args: string[] = [userId];

  if (normalizedSearch) {
    sql += `
      and (
        songs.title like ? or
        coalesce(songs.topic, '') like ? or
        coalesce(songs.genre, '') like ? or
        coalesce(songs.language, '') like ?
      )
    `;
    const searchValue = `%${normalizedSearch}%`;
    args.push(searchValue, searchValue, searchValue, searchValue);
  }

  sql += " order by coalesce(songs.saved_at, songs.synced_at) desc, songs.title asc";
  const result = await db.execute({ sql, args });

  return result.rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    topic: (row.topic as string | null) ?? null,
    emotion: (row.emotion as string | null) ?? null,
    genre: (row.genre as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    bpm: (row.bpm as number | null) ?? null,
    musical_key: (row.musical_key as string | null) ?? null,
    hook_summary: (row.hook_summary as string | null) ?? null,
    vocal_style: (row.vocal_style as string | null) ?? null,
    instrumentation: (row.instrumentation as string | null) ?? null,
    project_slug: (row.project_slug as string | null) ?? null,
    saved_at: (row.saved_at as string | null) ?? null,
    synced_at: String(row.synced_at),
    section_count: Number(row.section_count ?? 0),
    layer_count: Number(row.layer_count ?? 0),
  })) as MusicSongSummary[];
}

export async function getSongDetail(id: string, userId: string) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const songResult = await db.execute({ sql: "select * from songs where id = ? and user_id = ? limit 1", args: [id, userId] });
  const songRow = songResult.rows[0];
  if (!songRow) {
    return null;
  }

  const [sectionsResult, layersResult] = await Promise.all([
    db.execute({ sql: "select song_id, section_name, section_json, section_text from song_sections where song_id = ? order by section_name asc", args: [id] }),
    db.execute({ sql: "select song_id, layer_name, layer_json, layer_text from song_layers where song_id = ? order by layer_name asc", args: [id] }),
  ]);

  return {
    song: mapSongRow(songRow as Record<string, unknown>),
    sections: mapPartRows(sectionsResult.rows as Array<Record<string, unknown>>, "section_name"),
    layers: mapPartRows(layersResult.rows as Array<Record<string, unknown>>, "layer_name"),
  } satisfies MusicSongDetail;
}

export async function createSong(userId: string, input: MusicSongDraftInput) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const now = isoNow();
  const id = crypto.randomUUID();
  const title = (input.title || "Untitled Song").trim();
  const record = {
    id,
    user_id: userId,
    title,
    topic: normalizeText(input.topic),
    emotion: normalizeText(input.emotion),
    genre: normalizeText(input.genre),
    language: normalizeText(input.language),
    reference_text: normalizeText(input.reference_text),
    lyrics_text: normalizeText(input.lyrics_text),
    song_json: stringifyJson(input.song_json ?? { title }, { title }) || JSON.stringify({ title }, null, 2),
    melody_json: stringifyJson(input.melody_json),
    midi_blueprints_json: stringifyJson(input.midi_blueprints_json),
    production_json: stringifyJson(input.production_json),
    metadata_json: stringifyJson(input.metadata_json),
    bpm: normalizeNumber(input.bpm),
    musical_key: normalizeText(input.musical_key),
    structure_text: normalizeText(input.structure_text),
    hook_summary: normalizeText(input.hook_summary),
    vocal_style: normalizeText(input.vocal_style),
    instrumentation: normalizeText(input.instrumentation),
    mood_tags_json: normalizeMoodTags(input.mood_tags_json) ?? null,
    project_slug: normalizeText(input.project_slug),
    project_dir: normalizeText(input.project_dir),
    saved_at: now,
    enhanced_from_song_id: normalizeText(input.enhanced_from_song_id),
    enhanced_from_title: normalizeText(input.enhanced_from_title),
    has_arrangement_midi: 0,
    arrangement_midi: null,
    arrangement_midi_bytes: null,
    arrangement_midi_sha256: null,
    backup_run_id: normalizeText(input.backup_run_id) || "music-tool-generated",
    synced_at: now,
  };

  await db.execute({
    sql: `
      insert into songs (
        id, user_id, title, topic, emotion, genre, language, reference_text, lyrics_text,
        song_json, melody_json, midi_blueprints_json, production_json, metadata_json,
        bpm, musical_key, structure_text, hook_summary, vocal_style, instrumentation,
        mood_tags_json, project_slug, project_dir, saved_at, enhanced_from_song_id,
        enhanced_from_title, has_arrangement_midi, arrangement_midi, arrangement_midi_bytes,
        arrangement_midi_sha256, backup_run_id, synced_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      record.id,
      record.user_id,
      record.title,
      record.topic,
      record.emotion,
      record.genre,
      record.language,
      record.reference_text,
      record.lyrics_text,
      record.song_json,
      record.melody_json,
      record.midi_blueprints_json,
      record.production_json,
      record.metadata_json,
      record.bpm,
      record.musical_key,
      record.structure_text,
      record.hook_summary,
      record.vocal_style,
      record.instrumentation,
      record.mood_tags_json,
      record.project_slug,
      record.project_dir,
      record.saved_at,
      record.enhanced_from_song_id,
      record.enhanced_from_title,
      record.has_arrangement_midi,
      record.arrangement_midi,
      record.arrangement_midi_bytes,
      record.arrangement_midi_sha256,
      record.backup_run_id,
      record.synced_at,
    ],
  });

  for (const section of input.sections || []) {
    await upsertSongPart(id, userId, "section", section.name, section.text ?? null, section.json ?? {});
  }

  for (const layer of input.layers || []) {
    await upsertSongPart(id, userId, "layer", layer.name, layer.text ?? null, layer.json ?? {});
  }

  return getSongDetail(id, userId);
}

export async function updateSong(id: string, userId: string, updates: Record<string, unknown>) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const entries = Object.entries(updates).filter(([key, value]) => SONG_UPDATE_FIELDS.has(key) && value !== undefined);

  if (entries.length === 0) {
    const existing = await getSongDetail(id, userId);
    if (!existing) {
      throw new Error("Song not found");
    }
    return existing;
  }

  const assignments: string[] = [];
  const args: Array<string | number | null> = [];

  for (const [key, value] of entries) {
    let normalizedValue: string | number | null | undefined;

    if (key === "bpm") {
      normalizedValue = normalizeNumber(value as number | string | null | undefined);
    } else if (key === "has_arrangement_midi") {
      normalizedValue = value ? 1 : 0;
    } else if (key === "song_json") {
      normalizedValue = stringifyJson(value, {}) || JSON.stringify({}, null, 2);
    } else if (key.endsWith("_json")) {
      normalizedValue = key === "mood_tags_json"
        ? normalizeMoodTags(value as string | string[] | null | undefined)
        : stringifyJson(value);
    } else {
      normalizedValue = normalizeText(value as NullableString);
    }

    assignments.push(`${key} = ?`);
    args.push(normalizedValue ?? null);
  }

  assignments.push("synced_at = ?");
  args.push(isoNow());
  args.push(userId);
  args.push(id);

  const result = await db.execute({
    sql: `update songs set ${assignments.join(", ")} where user_id = ? and id = ?`,
    args,
  });

  if ((result.rowsAffected ?? 0) === 0) {
    throw new Error("Song not found");
  }

  const updated = await getSongDetail(id, userId);
  if (!updated) {
    throw new Error("Song not found");
  }

  return updated;
}

export async function upsertSongPart(
  songId: string,
  userId: string,
  kind: "section" | "layer",
  name: string,
  text: string | null,
  json: string | Record<string, unknown> | null | undefined,
) {
  await requireOwnedSong(songId, userId);
  const db = getMusicClient();
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Part name is required");
  }

  const normalizedJson = stringifyJson(json ?? {}, {}) || JSON.stringify({}, null, 2);
  const normalizedText = normalizeText(text);
  const syncedAt = isoNow();

  if (kind === "section") {
    await db.execute({
      sql: `
        insert into song_sections (song_id, section_name, section_json, section_text, synced_at)
        values (?, ?, ?, ?, ?)
        on conflict(song_id, section_name)
        do update set section_json = excluded.section_json, section_text = excluded.section_text, synced_at = excluded.synced_at
      `,
      args: [songId, normalizedName, normalizedJson, normalizedText, syncedAt],
    });
  } else {
    await db.execute({
      sql: `
        insert into song_layers (song_id, layer_name, layer_json, layer_text, synced_at)
        values (?, ?, ?, ?, ?)
        on conflict(song_id, layer_name)
        do update set layer_json = excluded.layer_json, layer_text = excluded.layer_text, synced_at = excluded.synced_at
      `,
      args: [songId, normalizedName, normalizedJson, normalizedText, syncedAt],
    });
  }

  return getSongDetail(songId, userId);
}

export async function deleteSongPart(songId: string, userId: string, kind: "section" | "layer", name: string) {
  await requireOwnedSong(songId, userId);
  const db = getMusicClient();
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Part name is required");
  }

  if (kind === "section") {
    await db.execute({
      sql: "delete from song_sections where song_id = ? and section_name = ?",
      args: [songId, normalizedName],
    });
  } else {
    await db.execute({
      sql: "delete from song_layers where song_id = ? and layer_name = ?",
      args: [songId, normalizedName],
    });
  }

  return getSongDetail(songId, userId);
}

function normalizeTargetKinds(value: unknown): MusicTemplatePartKind[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item))
        .filter((item): item is MusicTemplatePartKind => MUSIC_TEMPLATE_PART_KINDS.includes(item as MusicTemplatePartKind)),
    ),
  );
}

function normalizeTemplatePayload(input: Record<string, unknown>) {
  const name = String(input.name || "").trim();
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const instructions = String(input.instructions || "").trim();
  const targetType = String(input.targetType || "") as MusicTemplateTargetType;
  const targetField = typeof input.targetField === "string" ? input.targetField.trim() : "";
  const targetKinds = normalizeTargetKinds(input.targetKinds);

  if (!name) {
    throw new Error("Template name is required");
  }

  if (!MUSIC_TEMPLATE_TARGET_TYPES.includes(targetType)) {
    throw new Error("Invalid template target type");
  }

  if (!instructions) {
    throw new Error("Template instructions are required");
  }

  if (targetType === "song-field") {
    if (!MUSIC_TEMPLATE_SONG_FIELDS.includes(targetField as MusicTemplateSongField)) {
      throw new Error("A valid song target field is required");
    }

    return {
      name,
      category: category || null,
      description: description || null,
      targetType,
      targetField: targetField as MusicTemplateSongField,
      targetKinds: [] as MusicTemplatePartKind[],
      instructions,
    };
  }

  if (targetKinds.length === 0) {
    throw new Error("At least one part kind is required");
  }

  return {
    name,
    category: category || null,
    description: description || null,
    targetType,
    targetField: null,
    targetKinds,
    instructions,
  };
}

function mapTemplateRow(row: Record<string, unknown>): MusicTaskTemplateRecord {
  let targetKinds: MusicTemplatePartKind[] = [];
  try {
    targetKinds = normalizeTargetKinds(row.targetKinds ? JSON.parse(String(row.targetKinds)) : []);
  } catch {
    targetKinds = [];
  }

  return {
    id: String(row.id),
    name: String(row.name),
    category: (row.category as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    targetType: row.targetType as MusicTemplateTargetType,
    targetField: (row.targetField as MusicTemplateSongField | null) ?? null,
    targetKinds,
    instructions: String(row.instructions),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export async function listMusicTaskTemplates(userId: string) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const result = await db.execute({
    sql: "select * from music_task_template where user_id = ? order by name asc, createdAt asc",
    args: [userId],
  });

  return result.rows.map((row) => mapTemplateRow(row as Record<string, unknown>));
}

export async function createMusicTaskTemplate(userId: string, input: Record<string, unknown>) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const payload = normalizeTemplatePayload(input);
  const now = isoNow();
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: payload.name,
    category: payload.category,
    description: payload.description,
    targetType: payload.targetType,
    targetField: payload.targetField,
    targetKinds: JSON.stringify(payload.targetKinds),
    instructions: payload.instructions,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute({
    sql: `
      insert into music_task_template (
        id, user_id, name, category, description, targetType, targetField, targetKinds, instructions, createdAt, updatedAt
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      row.id,
      row.user_id,
      row.name,
      row.category,
      row.description,
      row.targetType,
      row.targetField,
      row.targetKinds,
      row.instructions,
      row.createdAt,
      row.updatedAt,
    ],
  });

  return mapTemplateRow(row);
}

export async function updateMusicTaskTemplate(userId: string, templateId: string, input: Record<string, unknown>) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const payload = normalizeTemplatePayload(input);
  const existing = await db.execute({
    sql: "select * from music_task_template where id = ? and user_id = ? limit 1",
    args: [templateId, userId],
  });

  if (!existing.rows[0]) {
    throw new Error("Template not found");
  }

  const updatedRow = {
    id: templateId,
    name: payload.name,
    category: payload.category,
    description: payload.description,
    targetType: payload.targetType,
    targetField: payload.targetField,
    targetKinds: JSON.stringify(payload.targetKinds),
    instructions: payload.instructions,
    createdAt: String((existing.rows[0] as Record<string, unknown>).createdAt),
    updatedAt: isoNow(),
  };

  await db.execute({
    sql: `
      update music_task_template
      set name = ?, category = ?, description = ?, targetType = ?, targetField = ?, targetKinds = ?, instructions = ?, updatedAt = ?
      where id = ?
    `,
    args: [
      updatedRow.name,
      updatedRow.category,
      updatedRow.description,
      updatedRow.targetType,
      updatedRow.targetField,
      updatedRow.targetKinds,
      updatedRow.instructions,
      updatedRow.updatedAt,
      templateId,
    ],
  });

  return mapTemplateRow(updatedRow);
}

export async function deleteMusicTaskTemplate(userId: string, templateId: string) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const result = await db.execute({
    sql: "delete from music_task_template where id = ? and user_id = ?",
    args: [templateId, userId],
  });

  if ((result.rowsAffected ?? 0) === 0) {
    throw new Error("Template not found");
  }
}

function mapPartitureRow(row: Record<string, unknown>): MusicPartitureRecord {
  return {
    id: String(row.id),
    songId: String(row.song_id),
    instrument: String(row.instrument),
    slot: Number(row.slot),
    title: String(row.title),
    content: String(row.content ?? ""),
    format: (row.format as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listSongPartitures(songId: string, userId: string) {
  await ensureMusicSupportTables();
  await requireOwnedSong(songId, userId);
  const db = getMusicClient();
  const result = await db.execute({
    sql: "select * from song_partitures where song_id = ? and user_id = ? order by instrument asc, slot asc, updated_at desc",
    args: [songId, userId],
  });

  return result.rows.map((row) => mapPartitureRow(row as Record<string, unknown>));
}

export async function createSongPartiture(
  songId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  await ensureMusicSupportTables();
  await requireOwnedSong(songId, userId);
  const db = getMusicClient();
  const now = isoNow();
  const row = {
    id: crypto.randomUUID(),
    song_id: songId,
    user_id: userId,
    instrument: normalizeText(input.instrument as string | null) || "guitar",
    slot: Math.max(1, Number(input.slot || 1)),
    title: normalizeText(input.title as string | null) || `Partiture ${Number(input.slot || 1)}`,
    content: String(input.content || ""),
    format: normalizeText(input.format as string | null),
    created_at: now,
    updated_at: now,
  };

  await db.execute({
    sql: `
      insert into song_partitures (id, song_id, user_id, instrument, slot, title, content, format, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      row.id,
      row.song_id,
      row.user_id,
      row.instrument,
      row.slot,
      row.title,
      row.content,
      row.format,
      row.created_at,
      row.updated_at,
    ],
  });

  return mapPartitureRow(row);
}

export async function updateSongPartiture(partitureId: string, userId: string, input: Record<string, unknown>) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const existing = await db.execute({
    sql: "select * from song_partitures where id = ? and user_id = ? limit 1",
    args: [partitureId, userId],
  });
  const row = existing.rows[0] as Record<string, unknown> | undefined;

  if (!row) {
    throw new Error("Partiture not found");
  }

  const next = {
    ...row,
    instrument: normalizeText(input.instrument as string | null) || String(row.instrument),
    slot: input.slot === undefined ? Number(row.slot) : Math.max(1, Number(input.slot || 1)),
    title: normalizeText(input.title as string | null) || String(row.title),
    content: input.content === undefined ? String(row.content ?? "") : String(input.content || ""),
    format: input.format === undefined ? ((row.format as string | null) ?? null) : normalizeText(input.format as string | null),
    updated_at: isoNow(),
  };

  await db.execute({
    sql: `
      update song_partitures
      set instrument = ?, slot = ?, title = ?, content = ?, format = ?, updated_at = ?
      where id = ?
    `,
    args: [next.instrument, next.slot, next.title, next.content, next.format, next.updated_at, partitureId],
  });

  return mapPartitureRow(next);
}

export async function deleteSongPartiture(partitureId: string, userId: string) {
  await ensureMusicSupportTables();
  const db = getMusicClient();
  const result = await db.execute({
    sql: "delete from song_partitures where id = ? and user_id = ?",
    args: [partitureId, userId],
  });

  if ((result.rowsAffected ?? 0) === 0) {
    throw new Error("Partiture not found");
  }
}