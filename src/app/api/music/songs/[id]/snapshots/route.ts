import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createMusicSnapshot, listMusicSnapshots } from "@/lib/music/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(_request);
    const { id } = await context.params;
    const snapshots = await listMusicSnapshots(id, user.id);
    return jsonResponse({ snapshots });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load snapshots");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const snapshot = await createMusicSnapshot({
      songId: id,
      userId: user.id,
      snapshotType: typeof body.snapshotType === "string" ? body.snapshotType : "manual",
      note: typeof body.note === "string" ? body.note : null,
      payload: body.payload as never,
    });
    return jsonResponse({ snapshot }, 201);
  } catch (error) {
    const message = (error as Error).message || "Failed to create snapshot";
    return errorResponse(message, message === "Song not found" ? 404 : 400);
  }
}