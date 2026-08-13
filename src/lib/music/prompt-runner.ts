import type {
  MusicSongDetail,
  MusicTaskTemplateRecord,
  MusicTemplateSongField,
} from "@/lib/music/types";

const SONG_FIELDS: MusicTemplateSongField[] = [
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

export function extractPromptSourceText(detail: MusicSongDetail, template: MusicTaskTemplateRecord) {
  if (template.targetType === "song-field") {
    const field = template.targetField;
    if (!field || !SONG_FIELDS.includes(field)) {
      throw new Error("Template target field is invalid");
    }

    const value = detail.song[field];
    return {
      targetLabel: field,
      sourceText: typeof value === "string" ? value : value == null ? "" : String(value),
    };
  }

  const chunks: string[] = [];
  if (template.targetKinds.includes("section")) {
    for (const section of detail.sections) {
      chunks.push(`[section:${section.name}]\n${section.text || ""}\n${section.json}`);
    }
  }
  if (template.targetKinds.includes("layer")) {
    for (const layer of detail.layers) {
      chunks.push(`[layer:${layer.name}]\n${layer.text || ""}\n${layer.json}`);
    }
  }

  return {
    targetLabel: template.targetKinds.join("+"),
    sourceText: chunks.join("\n\n"),
  };
}

export function buildPromptMessages(
  template: MusicTaskTemplateRecord,
  detail: MusicSongDetail,
  sourceText: string,
) {
  const systemPrompt = [
    "You are a music production assistant.",
    "Return valid JSON with exactly one string field named output.",
    "Do not include markdown fences.",
    template.instructions,
  ].join("\n\n");

  const userPrompt = [
    `Song title: ${detail.song.title}`,
    detail.song.genre ? `Genre: ${detail.song.genre}` : null,
    detail.song.language ? `Language: ${detail.song.language}` : null,
    detail.song.emotion ? `Emotion: ${detail.song.emotion}` : null,
    detail.song.musical_key ? `Key: ${detail.song.musical_key}` : null,
    detail.song.bpm ? `BPM: ${detail.song.bpm}` : null,
    "",
    `Target (${template.targetType}${template.targetField ? `: ${template.targetField}` : ""}):`,
    sourceText || "(empty)",
    "",
    template.description ? `Task notes: ${template.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, userPrompt };
}

export function parsePromptOutput(payload: unknown) {
  if (typeof payload === "string") {
    return payload.trim();
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.output === "string") {
      return record.output.trim();
    }
    if (typeof record.result === "string") {
      return record.result.trim();
    }
    if (typeof record.text === "string") {
      return record.text.trim();
    }
  }

  throw new Error("Prompt response did not include output text");
}
