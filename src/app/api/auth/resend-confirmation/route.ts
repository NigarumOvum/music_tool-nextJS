import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { resendEmailConfirmation } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ email?: string }>(request, {});
    await resendEmailConfirmation(body.email || "");
    return jsonResponse({ ok: true, message: "If the email exists, a confirmation message has been sent." });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to resend confirmation", 400);
  }
}