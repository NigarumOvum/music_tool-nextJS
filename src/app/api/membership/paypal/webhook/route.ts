import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import {
  findSubscriptionByOrderId,
  findSubscriptionByPaypalId,
  updatePaymentByOrderId,
  updateSubscription,
} from "@/lib/membership";
import { getPaypalWebhookEvent } from "@/lib/membership-paypal";

type WebhookResource = {
  id?: string;
  status?: string;
  billing_info?: { last_payment?: { time?: string }; next_billing_time?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
};

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ id?: string; event_type?: string; resource?: WebhookResource }>(
      request,
      {},
    );
    if (!body.id || !body.event_type) {
      return errorResponse("Invalid webhook payload", 400);
    }

    // Verify the event by fetching it back from PayPal over server-to-server auth.
    const remote = (await getPaypalWebhookEvent(body.id)) as {
      id?: string;
      event_type?: string;
      resource?: WebhookResource;
    };
    if (remote.id !== body.id || remote.event_type !== body.event_type) {
      return errorResponse("Webhook event could not be verified", 400);
    }
    const resource = remote.resource ?? body.resource ?? {};

    switch (body.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subscription = resource.id ? await findSubscriptionByPaypalId(resource.id) : null;
        if (subscription) {
          await updateSubscription(subscription.id, {
            status: "active",
            currentPeriodStart:
              resource.billing_info?.last_payment?.time ?? new Date().toISOString(),
            currentPeriodEnd: resource.billing_info?.next_billing_time ?? null,
          });
        }
        break;
      }
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subscription = resource.id ? await findSubscriptionByPaypalId(resource.id) : null;
        if (subscription) {
          await updateSubscription(subscription.id, {
            status: body.event_type === "BILLING.SUBSCRIPTION.EXPIRED" ? "expired" : "cancelled",
          });
        }
        break;
      }
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        const subscription = resource.id ? await findSubscriptionByPaypalId(resource.id) : null;
        if (subscription) {
          await updateSubscription(subscription.id, { status: "past_due" });
        }
        break;
      }
      case "PAYMENT.CAPTURE.COMPLETED":
      case "PAYMENT.CAPTURE.REFUNDED": {
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await updatePaymentByOrderId(
            orderId,
            body.event_type === "PAYMENT.CAPTURE.COMPLETED"
              ? { status: "captured", paypalCaptureId: resource.id }
              : { status: "refunded" },
            remote,
          ).catch(() => undefined);
          if (body.event_type === "PAYMENT.CAPTURE.COMPLETED") {
            const subscription = await findSubscriptionByOrderId(orderId);
            if (subscription && subscription.status === "pending") {
              await updateSubscription(subscription.id, {
                status: "active",
                currentPeriodStart: new Date().toISOString(),
              });
            }
          }
        }
        break;
      }
      default:
        break;
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse((error as Error).message || "Webhook handling failed", 400);
  }
}
