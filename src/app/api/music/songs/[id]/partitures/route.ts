import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createSongPartiture, listSongPartitures } from "@/lib/music/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(_request);
    const { id } = await context.params;
    const partitures = await listSongPartitures(id, user.id);
    return jsonResponse({ partitures });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load partitures");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<Record<string, unknown>>(request, {});
    const partiture = await createSongPartiture(id, user.id, body);
    return jsonResponse({ partiture }, 201);
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to create partiture", 400);
  }
}