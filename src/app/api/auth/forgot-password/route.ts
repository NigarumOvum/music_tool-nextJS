import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requestPasswordReset } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ email?: string }>(request, {});
    const resetUrl = await requestPasswordReset(body.email || "");
    return jsonResponse({
      ok: true,
      message: resetUrl
        ? "Email delivery is paused — use the link below to reset instead."
        : "If the email exists, a reset link has been sent.",
      resetUrl,
    });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to request password reset", 400);
  }
}