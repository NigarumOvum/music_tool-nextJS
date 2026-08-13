import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireAdminApiUser, updateRegisteredUserProfile } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminApiUser(request);
    const body = await parseJsonBody<{ userId?: string; name?: string | null }>(request, {});
    const userId = body.userId || "";

    if (!userId) {
      throw new Error("User is required");
    }

    if (!("name" in body)) {
      throw new Error("Name is required");
    }

    const name = typeof body.name === "string" ? body.name : null;
    await updateRegisteredUserProfile({
      targetUserId: userId,
      name,
      actingUserId: admin.id,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = (error as Error).message || "Failed to update user";
    const status = message === "Forbidden" ? 403 : message === "Unauthorized" ? 401 : 400;
    return errorResponse(message, status);
  }
}
