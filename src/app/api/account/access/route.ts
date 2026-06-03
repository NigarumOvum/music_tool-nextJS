import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { MANAGEABLE_PAGES, isManagedPageKey } from "@/lib/access";
import { listRegisteredUsersWithAccess, requireAdminApiUser, updateRegisteredUserAccess } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdminApiUser(request);
    const users = await listRegisteredUsersWithAccess();
    return jsonResponse({ pages: MANAGEABLE_PAGES, users });
  } catch (error) {
    const message = (error as Error).message || "Failed to load access settings";
    return errorResponse(message, message === "Forbidden" ? 403 : 400);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiUser(request);
    const body = await parseJsonBody<{ userId?: string; pageKey?: string; canAccess?: boolean }>(request, {});
    const userId = body.userId || "";
    const pageKey = body.pageKey || "";

    if (!userId) {
      throw new Error("User is required");
    }

    if (!isManagedPageKey(pageKey)) {
      throw new Error("Invalid page key");
    }

    await updateRegisteredUserAccess({
      targetUserId: userId,
      pageKey,
      canAccess: Boolean(body.canAccess),
      actingUserId: admin.id,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = (error as Error).message || "Failed to update access";
    return errorResponse(message, message === "Forbidden" ? 403 : 400);
  }
}