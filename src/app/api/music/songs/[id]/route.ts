import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getSongDetail, updateSong, deleteSong } from "@/lib/music/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(_request);
    const { id } = await context.params;
    const song = await getSongDetail(id, user.id);

    if (!song) {
      return errorResponse("Song not found", 404);
    }

    return jsonResponse({ song });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load song");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const song = await updateSong(id, user.id, body);
    return jsonResponse({ song });
  } catch (error) {
    const message = (error as Error).message || "Failed to update song";
    return errorResponse(message, message === "Song not found" ? 404 : 400);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    await deleteSong(id, user.id);
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = (error as Error).message || "Failed to delete song";
    return errorResponse(message, message === "Song not found" ? 404 : 400);
  }
}