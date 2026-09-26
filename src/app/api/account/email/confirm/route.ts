import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { confirmEmailChange, requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<{ token?: string }>(request, {});
    if (!body.token) {
      throw new Error("Token is required");
    }
    const result = await confirmEmailChange({ userId: user.id, token: body.token });
    return jsonResponse({ ok: true, email: result.email });
  } catch (error) {
    const message = (error as Error).message || "Failed to confirm email change";
    const status = message === "Unauthorized" ? 401 : 400;
    return errorResponse(message, status);
  }
}
