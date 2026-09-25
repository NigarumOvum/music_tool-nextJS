import type { MembershipPlan } from "@/lib/membership";

export type PaypalMode = "sandbox" | "live";

export function getPaypalMode(): PaypalMode {
  return process.env.PAYPAL_MODE?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

function getPaypalBaseUrl(mode: PaypalMode) {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function getCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("PayPal is not configured (missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
  }
  return { clientId, clientSecret };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getPaypalAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const mode = getPaypalMode();
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(`${getPaypalBaseUrl(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PayPal auth failed (${response.status})`);
  }
  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in ?? 0) * 1000,
  };
  return cachedToken.value;
}

async function paypalFetch(path: string, init: RequestInit & { token?: string } = {}) {
  const mode = getPaypalMode();
  const token = init.token ?? (await getPaypalAccessToken());
  const response = await fetch(`${getPaypalBaseUrl(mode)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { message?: string }).message ||
      (payload as { details?: Array<{ description?: string }> }).details?.[0]?.description ||
      `PayPal request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as Record<string, unknown>;
}

function moneyOf(plan: MembershipPlan) {
  return {
    currency_code: plan.currency,
    value: (plan.priceCents / 100).toFixed(2),
  };
}

function findApproveLink(payload: Record<string, unknown>): string | null {
  const links = payload.links as Array<{ rel?: string; href?: string }> | undefined;
  return links?.find((link) => link.rel === "approve")?.href ?? null;
}

/** One-time payment (e.g. Studio Lifetime). Frontend approves via the JS SDK. */
export async function createPaypalOrder(plan: MembershipPlan) {
  if (plan.billingInterval !== "one_time" || plan.priceCents <= 0) {
    throw new Error("Plan does not support one-time PayPal checkout");
  }
  const payload = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: plan.id,
          description: `${plan.name} membership`,
          amount: moneyOf(plan),
        },
      ],
    }),
  });
  return { orderId: String(payload.id), approveUrl: findApproveLink(payload) };
}

export async function capturePaypalOrder(orderId: string) {
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getPaypalOrder(orderId: string) {
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

async function ensureProductId(plan: MembershipPlan): Promise<string> {
  const payload = await paypalFetch("/v1/catalogs/products", {
    method: "POST",
    headers: { "PayPal-Request-Id": `product-${plan.id}` },
    body: JSON.stringify({
      name: `Music Tool ${plan.name}`,
      description: plan.description ?? plan.name,
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
  return String(payload.id);
}

async function createBillingPlan(plan: MembershipPlan, productId: string): Promise<string> {
  const payload = await paypalFetch("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      name: `Music Tool ${plan.name}`,
      description: plan.description ?? plan.name,
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: moneyOf(plan) },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 2,
      },
    }),
  });
  return String(payload.id);
}

/** Recurring membership (e.g. Pro Creator). Creates the PayPal billing plan on first use. */
export async function ensurePaypalBillingPlan(plan: MembershipPlan): Promise<string> {
  if (plan.billingInterval !== "monthly") {
    throw new Error("Plan does not support PayPal subscriptions");
  }
  if (plan.paypalPlanId) return plan.paypalPlanId;
  const productId = await ensureProductId(plan);
  const billingPlanId = await createBillingPlan(plan, productId);
  const { setPlanPaypalId } = await import("@/lib/membership");
  await setPlanPaypalId(plan.id, billingPlanId);
  return billingPlanId;
}

export function getAppBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export async function createPaypalSubscription(plan: MembershipPlan) {
  const billingPlanId = await ensurePaypalBillingPlan(plan);
  const baseUrl = getAppBaseUrl();
  const payload = await paypalFetch("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: billingPlanId,
      application_context: {
        brand_name: "Music Tool",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${baseUrl}/membership?approved=1`,
        cancel_url: `${baseUrl}/membership?cancelled=1`,
      },
    }),
  });
  return {
    subscriptionId: String(payload.id),
    approveUrl: findApproveLink(payload),
    status: String(payload.status ?? "APPROVAL_PENDING"),
  };
}

export async function getPaypalSubscription(subscriptionId: string) {
  return paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "GET",
  });
}

export async function cancelPaypalSubscription(subscriptionId: string, reason = "Cancelled by member") {
  await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/**
 * Verify a webhook event by fetching it back from PayPal over the
 * server-to-server API (avoids signature plumbing, still authenticated).
 */
export async function getPaypalWebhookEvent(eventId: string) {
  return paypalFetch(`/v1/notifications/webhooks-events/${encodeURIComponent(eventId)}`, {
    method: "GET",
  });
}
