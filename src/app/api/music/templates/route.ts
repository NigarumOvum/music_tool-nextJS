import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createMusicTaskTemplate, listMusicTaskTemplates } from "@/lib/music/db";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const templates = await listMusicTaskTemplates(user.id);
    return jsonResponse({ templates });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load templates");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const template = await createMusicTaskTemplate(user.id, body);
    return jsonResponse({ template }, 201);
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to create template", 400);
  }
}