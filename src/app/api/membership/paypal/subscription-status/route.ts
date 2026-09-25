import { errorResponse, jsonResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { findSubscriptionByPaypalId, updateSubscription } from "@/lib/membership";
import { getPaypalSubscription } from "@/lib/membership-paypal";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const { searchParams } = new URL(request.url);
    const paypalSubscriptionId = searchParams.get("paypalSubscriptionId");
    if (!paypalSubscriptionId) {
      return errorResponse("paypalSubscriptionId is required", 400);
    }
    const remote = await getPaypalSubscription(paypalSubscriptionId);
    const status = String(remote.status ?? "UNKNOWN");
    const local = await findSubscriptionByPaypalId(paypalSubscriptionId);
    if (!local || local.userId !== user.id) {
      return errorResponse("Subscription not found", 404);
    }
    if (status === "ACTIVE") {
      const billing = remote.billing_info as
        | { last_payment?: { time?: string }; next_billing_time?: string }
        | undefined;
      await updateSubscription(local.id, {
        status: "active",
        currentPeriodStart: billing?.last_payment?.time ?? new Date().toISOString(),
        currentPeriodEnd: billing?.next_billing_time ?? null,
      });
    }
    return jsonResponse({ status, active: status === "ACTIVE" });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to check subscription", 400);
  }
}
