import type {
  MembershipPayment,
  MembershipPlan,
  MembershipSubscription,
} from "@/lib/membership";

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || "Request failed");
  }
  return payload as T;
}

export function fetchPlans() {
  return requestJson<{ plans: MembershipPlan[] }>("/api/membership/plans");
}

export function fetchPaypalConfig() {
  return requestJson<{
    clientId: string | null;
    mode: "sandbox" | "live";
    currency: string;
    configured: boolean;
  }>("/api/membership/config");
}

export function fetchSubscriptionState() {
  return requestJson<{
    subscription: (MembershipSubscription & { plan: MembershipPlan | null }) | null;
    payments: MembershipPayment[];
  }>("/api/membership/subscription");
}

export function selectFreePlan(planId: string) {
  return requestJson<{ subscription: MembershipSubscription }>("/api/membership/subscription/select", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}

export function createPaypalOrder(planId: string) {
  return requestJson<{ orderId: string }>("/api/membership/paypal/order", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}

export function capturePaypalOrder(orderId: string) {
  return requestJson<{ ok: true; subscriptionId: string; captureId: string }>(
    "/api/membership/paypal/capture",
    { method: "POST", body: JSON.stringify({ orderId }) },
  );
}

export function createPaypalSubscription(planId: string) {
  return requestJson<{ subscriptionId: string; approveUrl: string | null; localId: string }>(
    "/api/membership/paypal/subscription",
    { method: "POST", body: JSON.stringify({ planId }) },
  );
}

export function confirmPaypalSubscription(paypalSubscriptionId: string) {
  return requestJson<{ status: string; active: boolean }>(
    `/api/membership/paypal/subscription-status?paypalSubscriptionId=${encodeURIComponent(paypalSubscriptionId)}`,
  );
}

export function cancelSubscription() {
  return requestJson<{ ok: true }>("/api/membership/cancel", { method: "POST" });
}

export function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
  }).format(priceCents / 100);
}
