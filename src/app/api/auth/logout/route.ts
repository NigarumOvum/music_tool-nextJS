import { jsonResponse } from "@/lib/api";
import { logoutUser } from "@/lib/auth";

export async function POST(request: Request) {
  await logoutUser(request);
  return jsonResponse({ ok: true });
}