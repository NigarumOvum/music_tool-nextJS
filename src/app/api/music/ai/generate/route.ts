import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { runOllamaJson } from "@/lib/music/ollama";

function stringifyIfNeeded(value: unknown, fallback: unknown = null) {
  if (value === null || value === undefined) {
    return fallback === null ? null : JSON.stringify(fallback, null, 2);
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

type GeneratedPartInput = {
  name?: string;
  text?: string | null;
  json?: unknown;
};

type GeneratedDraftInput = {
  song?: Record<string, unknown>;
  sections?: GeneratedPartInput[];
  layers?: GeneratedPartInput[];
  notes?: string | null;
};

function normalizeGeneratedParts(parts: unknown) {
  if (!Array.isArray(parts)) {
    return [];
  }

  return parts.map((part) => {
    const value = (part || {}) as GeneratedPartInput;
    return {
      name: value.name || "untitled_part",
      text: value.text || null,
      json: stringifyIfNeeded(value.json, {}),
    };
  });
}

export async function POST(request: Request) {
  try {
    await requireApiUser(request);
    const body = await parseJsonBody<Record<string, unknown>>(request, {});

    if (!body.prompt || !body.genre || !body.language) {
      return errorResponse("prompt, genre, and language are required", 400);
    }

    const systemPrompt = 'You are a senior songwriter and music producer. Return JSON only with this schema: {"song":{"title":"","topic":"","emotion":"","genre":"","language":"","reference_text":"","lyrics_text":"","song_json":{},"melody_json":{},"midi_blueprints_json":{},"production_json":{},"metadata_json":{},"bpm":120,"musical_key":"C Minor","structure_text":"","hook_summary":"","vocal_style":"","instrumentation":"","mood_tags_json":[]},"sections":[{"name":"verse_1","text":"","json":{}}],"layers":[{"name":"drums","text":"","json":{}}],"notes":"short rationale"}';
    const userPrompt = `Generate a production-ready song draft with rich structure and arrangement guidance.\n\nPrompt:\n${String(body.prompt)}\n\nRequired properties:\n${JSON.stringify({
      title: body.title || null,
      topic: body.topic || null,
      emotion: body.emotion || null,
      genre: body.genre,
      language: body.language,
      bpm: body.bpm || null,
      musical_key: body.musical_key || null,
      vocal_style: body.vocal_style || null,
      instrumentation: body.instrumentation || null,
    }, null, 2)}`;

    const draft = await runOllamaJson<GeneratedDraftInput>(systemPrompt, userPrompt);
    const normalizedDraft = {
      song: {
        title: draft.song?.title || body.title || "Untitled Song",
        topic: draft.song?.topic || body.topic || null,
        emotion: draft.song?.emotion || body.emotion || null,
        genre: draft.song?.genre || body.genre,
        language: draft.song?.language || body.language,
        reference_text: draft.song?.reference_text || null,
        lyrics_text: draft.song?.lyrics_text || null,
        song_json: stringifyIfNeeded(draft.song?.song_json, {}),
        melody_json: stringifyIfNeeded(draft.song?.melody_json, {}),
        midi_blueprints_json: stringifyIfNeeded(draft.song?.midi_blueprints_json, {}),
        production_json: stringifyIfNeeded(draft.song?.production_json, {}),
        metadata_json: stringifyIfNeeded(draft.song?.metadata_json, {}),
        bpm: draft.song?.bpm || body.bpm || null,
        musical_key: draft.song?.musical_key || body.musical_key || null,
        structure_text: draft.song?.structure_text || null,
        hook_summary: draft.song?.hook_summary || null,
        vocal_style: draft.song?.vocal_style || body.vocal_style || null,
        instrumentation: draft.song?.instrumentation || body.instrumentation || null,
        mood_tags_json: stringifyIfNeeded(draft.song?.mood_tags_json, []),
      },
      sections: normalizeGeneratedParts(draft.sections),
      layers: normalizeGeneratedParts(draft.layers),
      notes: draft.notes || null,
    };

    return jsonResponse({ draft: normalizedDraft });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to generate song draft");
  }
}