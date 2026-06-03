import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { confirmEmail } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ token?: string }>(request, {});
    await confirmEmail(body.token || "");
    return jsonResponse({ ok: true, message: "Your email is now confirmed." });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to confirm email", 400);
  }
}