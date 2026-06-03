import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { deleteMusicTaskTemplate, updateMusicTaskTemplate } from "@/lib/music/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const template = await updateMusicTaskTemplate(user.id, id, body);
    return jsonResponse({ template });
  } catch (error) {
    const message = (error as Error).message || "Failed to update template";
    return errorResponse(message, message === "Template not found" ? 404 : 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(_request);
    const { id } = await context.params;
    await deleteMusicTaskTemplate(user.id, id);
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = (error as Error).message || "Failed to delete template";
    return errorResponse(message, message === "Template not found" ? 404 : 400);
  }
}