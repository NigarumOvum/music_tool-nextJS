import { errorResponse, jsonResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getUserSubscription, listUserPayments } from "@/lib/membership";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const subscription = await getUserSubscription(user.id);
    const payments = await listUserPayments(user.id, 10);
    return jsonResponse({ subscription, payments });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load subscription");
  }
}
