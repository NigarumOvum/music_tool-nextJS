export interface MusicSongSummary {
  id: string;
  title: string;
  topic: string | null;
  emotion: string | null;
  genre: string | null;
  language: string | null;
  bpm: number | null;
  musical_key: string | null;
  hook_summary: string | null;
  vocal_style: string | null;
  instrumentation: string | null;
  project_slug: string | null;
  saved_at: string | null;
  synced_at: string;
  section_count: number;
  layer_count: number;
}

export interface MusicSongRecord {
  id: string;
  title: string;
  topic: string | null;
  emotion: string | null;
  genre: string | null;
  language: string | null;
  reference_text: string | null;
  lyrics_text: string | null;
  song_json: string;
  melody_json: string | null;
  midi_blueprints_json: string | null;
  production_json: string | null;
  metadata_json: string | null;
  bpm: number | null;
  musical_key: string | null;
  structure_text: string | null;
  hook_summary: string | null;
  vocal_style: string | null;
  instrumentation: string | null;
  mood_tags_json: string | null;
  project_slug: string | null;
  project_dir: string | null;
  saved_at: string | null;
  enhanced_from_song_id: string | null;
  enhanced_from_title: string | null;
  has_arrangement_midi: number;
  arrangement_midi_bytes: number | null;
  arrangement_midi_sha256: string | null;
  backup_run_id: string;
  synced_at: string;
}

export interface MusicPartRecord {
  name: string;
  text: string | null;
  json: string;
}

export interface MusicSongDetail {
  song: MusicSongRecord;
  sections: MusicPartRecord[];
  layers: MusicPartRecord[];
}

export interface MusicSongDraftInput {
  title?: string;
  topic?: string | null;
  emotion?: string | null;
  genre?: string | null;
  language?: string | null;
  reference_text?: string | null;
  lyrics_text?: string | null;
  song_json?: string | Record<string, unknown>;
  melody_json?: string | Record<string, unknown> | null;
  midi_blueprints_json?: string | Record<string, unknown> | null;
  production_json?: string | Record<string, unknown> | null;
  metadata_json?: string | Record<string, unknown> | null;
  bpm?: number | string | null;
  musical_key?: string | null;
  structure_text?: string | null;
  hook_summary?: string | null;
  vocal_style?: string | null;
  instrumentation?: string | null;
  mood_tags_json?: string | string[] | null;
  project_slug?: string | null;
  project_dir?: string | null;
  enhanced_from_song_id?: string | null;
  enhanced_from_title?: string | null;
  backup_run_id?: string | null;
  sections?: Array<{ name: string; text?: string | null; json?: string | Record<string, unknown> | null }>;
  layers?: Array<{ name: string; text?: string | null; json?: string | Record<string, unknown> | null }>;
}

export type MusicTemplateTargetType = "song-field" | "part";
export type MusicTemplatePartKind = "section" | "layer";
export type MusicTemplateSongField =
  | "title"
  | "topic"
  | "emotion"
  | "reference_text"
  | "lyrics_text"
  | "structure_text"
  | "song_json"
  | "production_json"
  | "metadata_json";

export interface MusicTaskTemplateRecord {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  targetType: MusicTemplateTargetType;
  targetField: MusicTemplateSongField | null;
  targetKinds: MusicTemplatePartKind[];
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface MusicPartitureRecord {
  id: string;
  songId: string;
  instrument: string;
  slot: number;
  title: string;
  content: string;
  format: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MusicSnapshotRecord {
  id: string;
  songId: string;
  snapshotType: string;
  note: string | null;
  createdAt: string;
}