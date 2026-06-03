import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { deleteSongPart, upsertSongPart } from "@/lib/music/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const kind = body.kind === "layer" ? "layer" : "section";
    const name = typeof body.name === "string" ? body.name : "";
    const song = await upsertSongPart(id, user.id, kind, name, (body.text as string | null) ?? null, body.json as string | Record<string, unknown> | null | undefined);
    return jsonResponse({ song });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to save song part", 400);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const kind = body.kind === "layer" ? "layer" : "section";
    const name = typeof body.name === "string" ? body.name : "";
    const song = await deleteSongPart(id, user.id, kind, name);
    return jsonResponse({ song });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to delete song part", 400);
  }
}