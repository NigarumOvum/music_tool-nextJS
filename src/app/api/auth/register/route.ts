import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { registerUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ name?: string; email?: string; password?: string }>(request, {});
    const user = await registerUser({
      name: body.name || null,
      email: body.email || "",
      password: body.password || "",
    });
    return jsonResponse({ user }, 201);
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to register", 400);
  }
}