import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createMusicSnapshot, getSongDetail, restoreMusicSnapshot } from "@/lib/music/db";

type RouteContext = {
  params: Promise<{ snapshotId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { snapshotId } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const songId = await restoreMusicSnapshot(snapshotId, user.id);
    await createMusicSnapshot({
      songId,
      userId: user.id,
      snapshotType: "restore",
      note: typeof body.note === "string" ? body.note : "State restored from snapshot",
    });
    const song = await getSongDetail(songId, user.id);
    return jsonResponse({ song });
  } catch (error) {
    const message = (error as Error).message || "Failed to restore snapshot";
    return errorResponse(message, message === "Snapshot not found" ? 404 : 400);
  }
}