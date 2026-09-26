import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { changePassword, requireApiUser } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

function getSessionId(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator) === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separator + 1));
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<{ currentPassword?: string; nextPassword?: string }>(request, {});
    if (!body.currentPassword || !body.nextPassword) {
      throw new Error("Current and new passwords are required");
    }
    await changePassword({
      userId: user.id,
      currentPassword: body.currentPassword,
      nextPassword: body.nextPassword,
      keepSessionId: getSessionId(request),
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = (error as Error).message || "Failed to change password";
    const status = message === "Unauthorized" ? 401 : 400;
    return errorResponse(message, status);
  }
}
