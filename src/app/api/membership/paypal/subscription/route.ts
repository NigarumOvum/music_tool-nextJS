import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createSubscription, getPlan } from "@/lib/membership";
import { createPaypalSubscription } from "@/lib/membership-paypal";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<{ planId?: string }>(request, {});
    const plan = body.planId ? await getPlan(body.planId) : null;
    if (!plan || !plan.isActive) {
      return errorResponse("Plan not found", 404);
    }
    if (plan.billingInterval !== "monthly" || plan.priceCents <= 0) {
      return errorResponse("Plan does not support PayPal subscriptions", 400);
    }
    const { subscriptionId, approveUrl } = await createPaypalSubscription(plan);
    const subscription = await createSubscription({
      userId: user.id,
      planId: plan.id,
      paypalSubscriptionId: subscriptionId,
    });
    return jsonResponse({ subscriptionId, approveUrl, localId: subscription.id }, 201);
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to create PayPal subscription", 400);
  }
}
