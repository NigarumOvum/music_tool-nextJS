import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { runOllamaJson } from "@/lib/music/ollama";

interface EnhanceResponse {
  updatedValue?: string;
  text?: string | null;
  json?: Record<string, unknown> | null;
  notes?: string;
}

function createPrompt(body: Record<string, unknown>) {
  const songContext = JSON.stringify(body.song ?? {}, null, 2);

  if (body.targetType === "song-field") {
    const expectsJson = typeof body.fieldName === "string" && body.fieldName.endsWith("_json");
    const schema = expectsJson
      ? '{"updatedValue": {"valid": "json object or array"}, "notes": "short rationale"}'
      : '{"updatedValue": "updated field content", "notes": "short rationale"}';

    return {
      systemPrompt: `You are a senior music production copilot. Improve the requested song field while keeping the song coherent. Return JSON only with this schema: ${schema}`,
      userPrompt: `Song context:\n${songContext}\n\nField: ${String(body.fieldName || "")}\nCurrent value:\n${String(body.currentValue ?? "")}\n\nInstructions:\n${String(body.instructions || "")}`,
    };
  }

  return {
    systemPrompt: 'You are a senior music production copilot. Improve the requested section or layer while keeping it consistent with the song. Return JSON only with this schema: {"text":"updated descriptive text","json":{"updated":"structured object"},"notes":"short rationale"}',
    userPrompt: `Song context:\n${songContext}\n\nTarget type: ${String(body.targetType || "")}\nName: ${String(body.name || "")}\nCurrent text:\n${String(body.textValue ?? "")}\n\nCurrent JSON:\n${String(body.jsonValue ?? "{}")}\n\nInstructions:\n${String(body.instructions || "")}`,
  };
}

export async function POST(request: Request) {
  try {
    await requireApiUser(request);
    const body = await parseJsonBody<Record<string, unknown>>(request, {});

    if (!body.instructions || !body.targetType) {
      return errorResponse("targetType and instructions are required", 400);
    }

    const { systemPrompt, userPrompt } = createPrompt(body);
    const result = await runOllamaJson<EnhanceResponse>(systemPrompt, userPrompt);
    return jsonResponse({ result });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to enhance content");
  }
}