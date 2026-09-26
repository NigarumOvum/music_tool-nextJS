import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { changePasswordByEmail } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ email?: string; currentPassword?: string; nextPassword?: string }>(
      request,
      {},
    );
    if (!body.email || !body.currentPassword || !body.nextPassword) {
      throw new Error("Email, current and new passwords are required");
    }
    await changePasswordByEmail({
      email: body.email,
      currentPassword: body.currentPassword,
      nextPassword: body.nextPassword,
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to change password", 400);
  }
}
