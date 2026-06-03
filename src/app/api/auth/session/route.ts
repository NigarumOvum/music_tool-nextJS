import { errorResponse, jsonResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    return jsonResponse({ user });
  } catch (error) {
    return errorResponse((error as Error).message || "Unauthorized", 401);
  }
}