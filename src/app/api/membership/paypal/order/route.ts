import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getPlan, recordPayment } from "@/lib/membership";
import { createPaypalOrder } from "@/lib/membership-paypal";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<{ planId?: string }>(request, {});
    const plan = body.planId ? await getPlan(body.planId) : null;
    if (!plan || !plan.isActive) {
      return errorResponse("Plan not found", 404);
    }
    if (plan.billingInterval !== "one_time" || plan.priceCents <= 0) {
      return errorResponse("Plan does not support one-time PayPal checkout", 400);
    }
    const { orderId } = await createPaypalOrder(plan);
    await recordPayment({
      userId: user.id,
      planId: plan.id,
      paypalOrderId: orderId,
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: "created",
    });
    return jsonResponse({ orderId }, 201);
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to create PayPal order", 400);
  }
}
