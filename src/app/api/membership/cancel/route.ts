import { errorResponse, jsonResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getUserSubscription, updateSubscription } from "@/lib/membership";
import { cancelPaypalSubscription } from "@/lib/membership-paypal";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const subscription = await getUserSubscription(user.id);
    if (!subscription || (subscription.status !== "active" && subscription.status !== "past_due")) {
      return errorResponse("No active subscription to cancel", 400);
    }
    if (subscription.paypalSubscriptionId) {
      try {
        await cancelPaypalSubscription(subscription.paypalSubscriptionId);
      } catch (error) {
        // PayPal cancel is best-effort (already cancelled remotely, etc.).
        console.warn("PayPal subscription cancel failed:", (error as Error).message);
      }
    }
    await updateSubscription(subscription.id, { status: "cancelled", cancelAtPeriodEnd: false });
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to cancel subscription", 400);
  }
}
