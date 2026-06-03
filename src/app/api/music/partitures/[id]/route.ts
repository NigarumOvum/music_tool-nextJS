import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { deleteSongPartiture, updateSongPartiture } from "@/lib/music/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const partiture = await updateSongPartiture(id, user.id, body);
    return jsonResponse({ partiture });
  } catch (error) {
    const message = (error as Error).message || "Failed to update partiture";
    return errorResponse(message, message === "Partiture not found" ? 404 : 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(_request);
    const { id } = await context.params;
    await deleteSongPartiture(id, user.id);
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = (error as Error).message || "Failed to delete partiture";
    return errorResponse(message, message === "Partiture not found" ? 404 : 400);
  }
}