import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requestPasswordReset } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ email?: string }>(request, {});
    await requestPasswordReset(body.email || "");
    return jsonResponse({ ok: true, message: "If the email exists, a reset link has been sent." });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to request password reset", 400);
  }
}