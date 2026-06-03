import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createSong, listSongs } from "@/lib/music/db";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const songs = await listSongs(user.id, search);
    return jsonResponse({ songs });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load songs");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const song = await createSong(user.id, body);
    return jsonResponse({ song }, 201);
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to create song", 400);
  }
}