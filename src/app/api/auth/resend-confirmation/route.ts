import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { resendEmailConfirmation } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ email?: string }>(request, {});
    const verificationUrl = await resendEmailConfirmation(body.email || "");
    return jsonResponse({
      ok: true,
      message: verificationUrl
        ? "Email delivery is paused — use the link below to confirm instead."
        : "If the email exists, a confirmation message has been sent.",
      verificationUrl,
    });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to resend confirmation", 400);
  }
}