import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { ensureUserCanAccessPage, requireApiUser } from "@/lib/auth";
import { getMusicTaskTemplateById, getSongDetail, updateSong } from "@/lib/music/db";
import {
  buildPromptMessages,
  extractPromptSourceText,
  parsePromptOutput,
} from "@/lib/music/prompt-runner";
import { runOllamaJson } from "@/lib/music/ollama";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);

    if (!(await ensureUserCanAccessPage(user, "prompt-library"))) {
      throw new Error("Forbidden");
    }

    const body = await parseJsonBody<{
      templateId?: string;
      songId?: string;
      apply?: boolean;
    }>(request, {});

    const templateId = body.templateId || "";
    const songId = body.songId || "";

    if (!templateId) {
      throw new Error("Template is required");
    }

    if (!songId) {
      throw new Error("Song is required");
    }

    if (!(await ensureUserCanAccessPage(user, "song-studio"))) {
      throw new Error("Forbidden");
    }

    const [template, detail] = await Promise.all([
      getMusicTaskTemplateById(user.id, templateId),
      getSongDetail(songId, user.id),
    ]);

    if (!template) {
      throw new Error("Template not found");
    }

    if (!detail) {
      throw new Error("Song not found");
    }

    const { sourceText, targetLabel } = extractPromptSourceText(detail, template);
    const { systemPrompt, userPrompt } = buildPromptMessages(template, detail, sourceText);
    const raw = await runOllamaJson<Record<string, unknown>>(systemPrompt, userPrompt);
    const output = parsePromptOutput(raw);

    let applied = false;
    if (body.apply && template.targetType === "song-field" && template.targetField) {
      await updateSong(songId, user.id, {
        [template.targetField]: output,
      });
      applied = true;
    }

    return jsonResponse({
      output,
      targetLabel,
      templateId: template.id,
      songId,
      applied,
    });
  } catch (error) {
    const message = (error as Error).message || "Failed to run prompt";
    const status = message === "Unauthorized"
      ? 401
      : message === "Forbidden"
        ? 403
        : 400;
    return errorResponse(message, status);
  }
}
