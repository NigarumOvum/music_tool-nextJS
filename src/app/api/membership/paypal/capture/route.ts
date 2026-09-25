import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import {
  createSubscription,
  findSubscriptionByOrderId,
  getPlan,
  updatePaymentByOrderId,
  updateSubscription,
} from "@/lib/membership";
import { capturePaypalOrder } from "@/lib/membership-paypal";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<{ orderId?: string }>(request, {});
    if (!body.orderId) {
      return errorResponse("orderId is required", 400);
    }
    const capture = await capturePaypalOrder(body.orderId);
    const units = (capture.purchase_units as Array<Record<string, unknown>> | undefined) ?? [];
    const payments = units[0]?.payments as
      | { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }> }
      | undefined;
    const completed = payments?.captures?.find((item) => item.status === "COMPLETED");
    if (!completed) {
      await updatePaymentByOrderId(body.orderId, { status: "failed" }, capture).catch(() => undefined);
      return errorResponse("PayPal capture did not complete", 400);
    }

    const referenceId = String(units[0]?.reference_id ?? "");
    const plan = referenceId ? await getPlan(referenceId) : null;
    if (!plan) {
      return errorResponse("Plan for this order was not found", 400);
    }
    const expected = (plan.priceCents / 100).toFixed(2);
    if (completed.amount?.value !== expected || completed.amount?.currency_code !== plan.currency) {
      return errorResponse("Captured amount does not match the plan price", 400);
    }

    const now = new Date().toISOString();
    let subscription = await findSubscriptionByOrderId(body.orderId);
    if (!subscription || subscription.userId !== user.id) {
      subscription = await createSubscription({
        userId: user.id,
        planId: plan.id,
        paypalOrderId: body.orderId,
      });
    }
    await updateSubscription(subscription.id, {
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: null,
    });
    await updatePaymentByOrderId(
      body.orderId,
      { status: "captured", paypalCaptureId: completed.id, subscriptionId: subscription.id },
      capture,
    ).catch(() => undefined);

    return jsonResponse({ ok: true, subscriptionId: subscription.id, captureId: completed.id });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to capture PayPal order", 400);
  }
}
