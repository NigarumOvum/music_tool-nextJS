import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { MANAGEABLE_PAGES, isManagedPageKey, type ManagedPageKey } from "@/lib/access";
import {
  listRegisteredUsersWithAccess,
  requireAdminApiUser,
  setRegisteredUserPageAccessMap,
  updateRegisteredUserAccess,
} from "@/lib/auth";

function isPageAccessMap(value: unknown): value is Record<ManagedPageKey, boolean> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return MANAGEABLE_PAGES.every((page) => typeof (value as Record<string, unknown>)[page.key] === "boolean");
}

export async function GET(request: Request) {
  try {
    await requireAdminApiUser(request);
    const users = await listRegisteredUsersWithAccess();
    return jsonResponse({ pages: MANAGEABLE_PAGES, users });
  } catch (error) {
    const message = (error as Error).message || "Failed to load access settings";
    const status = message === "Forbidden" ? 403 : message === "Unauthorized" ? 401 : 400;
    return errorResponse(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiUser(request);
    const body = await parseJsonBody<{
      userId?: string;
      pageKey?: string;
      canAccess?: boolean;
      pageAccess?: Record<ManagedPageKey, boolean>;
    }>(request, {});
    const userId = body.userId || "";

    if (!userId) {
      throw new Error("User is required");
    }

    if (body.pageAccess) {
      if (!isPageAccessMap(body.pageAccess)) {
        throw new Error("Invalid page access map");
      }

      await setRegisteredUserPageAccessMap({
        targetUserId: userId,
        pageAccess: body.pageAccess,
        actingUserId: admin.id,
      });

      return jsonResponse({ ok: true });
    }

    const pageKey = body.pageKey || "";

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
    const status = message === "Forbidden" ? 403 : message === "Unauthorized" ? 401 : 400;
    return errorResponse(message, status);
  }
}
