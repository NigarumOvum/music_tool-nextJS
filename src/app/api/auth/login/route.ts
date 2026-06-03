import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { loginUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ email?: string; password?: string }>(request, {});
    const user = await loginUser({
      email: body.email || "",
      password: body.password || "",
    });
    return jsonResponse({ user });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to login", 400);
  }
}