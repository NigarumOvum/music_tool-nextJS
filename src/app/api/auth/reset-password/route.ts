import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { resetPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ token?: string; password?: string }>(request, {});
    await resetPassword(body.token || "", body.password || "");
    return jsonResponse({ ok: true, message: "Password updated. You can log in with the new password." });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to reset password", 400);
  }
}