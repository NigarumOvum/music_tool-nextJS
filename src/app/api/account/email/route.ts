import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requestEmailChange, requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<{ password?: string; newEmail?: string }>(request, {});
    if (!body.password || !body.newEmail) {
      throw new Error("Password and new email are required");
    }
    const result = await requestEmailChange({
      userId: user.id,
      password: body.password,
      newEmail: body.newEmail,
    });
    return jsonResponse(result);
  } catch (error) {
    const message = (error as Error).message || "Failed to request email change";
    const status = message === "Unauthorized" ? 401 : 400;
    return errorResponse(message, status);
  }
}
