"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Crown, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { MembershipPayment, MembershipPlan, MembershipSubscription } from "@/lib/membership";
import {
  cancelSubscription,
  capturePaypalOrder,
  confirmPaypalSubscription,
  createPaypalOrder,
  createPaypalSubscription,
  fetchPaypalConfig,
  fetchPlans,
  fetchSubscriptionState,
  formatPrice,
  selectFreePlan,
} from "@/lib/membership-client";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => { render: (target: HTMLElement) => void };
    };
  }
}

function loadPaypalSdk(clientId: string, currency: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk="1"]');
  if (existing) {
    if (window.paypal) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.paypalSdk = "1";
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.body.appendChild(script);
  });
}

export function MembershipClient() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [subscription, setSubscription] = useState<(MembershipSubscription & { plan: MembershipPlan | null }) | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [config, setConfig] = useState<{ clientId: string | null; mode: string; currency: string; configured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const paypalButtonsRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    const [plansRes, stateRes, configRes] = await Promise.all([
      fetchPlans(),
      fetchSubscriptionState(),
      fetchPaypalConfig(),
    ]);
    setPlans(plansRes.plans);
    setSubscription(stateRes.subscription);
    setPayments(stateRes.payments);
    setConfig(configRes);
    return { stateRes, configRes };
  }, []);

  useEffect(() => {
    // Initial membership state load (same pattern as production-studio catalog load).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
      .then(async ({ stateRes }) => {
        // Returning from PayPal subscription approval — confirm against PayPal.
        if (searchParams.get("approved") === "1" && stateRes.subscription?.paypalSubscriptionId) {
          try {
            await confirmPaypalSubscription(stateRes.subscription.paypalSubscriptionId);
            const updated = await fetchSubscriptionState();
            setSubscription(updated.subscription);
            setPayments(updated.payments);
            toast.success("Subscription confirmed");
          } catch (error) {
            toast.error((error as Error).message);
          }
        }
        if (searchParams.get("cancelled") === "1") {
          toast.message("PayPal checkout was cancelled");
        }
      })
      .catch((error) => toast.error((error as Error).message))
      .finally(() => setLoading(false));
  }, [refresh, searchParams]);

  // Render PayPal one-time buttons for the selected plan.
  useEffect(() => {
    if (!payingPlanId || !config?.clientId || !paypalButtonsRef.current || !window.paypal) return;
    const planId = payingPlanId;
    paypalButtonsRef.current.innerHTML = "";
    try {
      window.paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
          createOrder: async () => {
            const { orderId } = await createPaypalOrder(planId);
            return orderId;
          },
          onApprove: async (data: unknown) => {
            const orderId = String((data as { orderID?: string }).orderID ?? "");
            setBusyPlan(planId);
            try {
              await capturePaypalOrder(orderId);
              toast.success("Payment captured — membership active");
              const updated = await fetchSubscriptionState();
              setSubscription(updated.subscription);
              setPayments(updated.payments);
              setPayingPlanId(null);
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusyPlan(null);
            }
          },
          onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : "PayPal checkout failed");
          },
          onCancel: () => toast.message("PayPal checkout was cancelled"),
        })
        .render(paypalButtonsRef.current);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [payingPlanId, config, sdkReady]);

  async function handlePlanAction(plan: MembershipPlan) {
    if (plan.priceCents === 0) {
      setBusyPlan(plan.id);
      try {
        await selectFreePlan(plan.id);
        toast.success(`You're on the ${plan.name} plan`);
        const updated = await fetchSubscriptionState();
        setSubscription(updated.subscription);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setBusyPlan(null);
      }
      return;
    }
    if (!config?.configured) {
      toast.error("PayPal is not configured yet (see PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
      return;
    }
    if (plan.billingInterval === "monthly") {
      setBusyPlan(plan.id);
      try {
        const { approveUrl } = await createPaypalSubscription(plan.id);
        if (!approveUrl) throw new Error("PayPal did not return an approval link");
        window.location.assign(approveUrl);
      } catch (error) {
        toast.error((error as Error).message);
        setBusyPlan(null);
      }
      return;
    }
    // One-time plan → inline PayPal buttons.
    try {
      await loadPaypalSdk(config.clientId!, config.currency);
      setSdkReady(true);
      setPayingPlanId(plan.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel your membership? Paid access stays until the change takes effect.")) return;
    try {
      await cancelSubscription();
      toast.success("Membership cancelled");
      const updated = await fetchSubscriptionState();
      setSubscription(updated.subscription);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="panel flex min-h-[280px] items-center justify-center rounded-[1.75rem]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brass)]" />
      </div>
    );
  }

  const activePlanId = subscription?.status === "active" ? subscription.planId : null;

  return (
    <div className="space-y-5">
      {/* Current membership */}
      <div className="panel glass-shine flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brass)] text-black">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <div className="eyebrow text-[0.62rem]">Current membership</div>
            <div className="text-lg font-black">
              {subscription?.plan?.name ?? "No membership yet"}
              {subscription ? (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                    subscription.status === "active"
                      ? "bg-[var(--color-success-surface)] text-[var(--color-mint)]"
                      : "bg-white/5 text-[var(--color-sand-2)]"
                  }`}
                >
                  {subscription.status.replace("_", " ")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--color-sand-2)]">
              {config ? `PayPal ${config.mode} mode · ${config.currency}` : ""}
              {!config?.configured ? " · PayPal not configured yet" : ""}
            </p>
          </div>
        </div>
        {subscription?.status === "active" && subscription.planId !== "free" ? (
          <button
            type="button"
            onClick={() => void handleCancel()}
            className="glass-pill flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:border-red-500/40"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancel
          </button>
        ) : null}
      </div>

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = activePlanId === plan.id;
          const busy = busyPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`panel glass-shine flex flex-col rounded-[1.75rem] p-5 ${
                isCurrent ? "border-[var(--color-brass)]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">{plan.name}</h3>
                {isCurrent ? (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--color-brass)]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">
                    <BadgeCheck className="h-3.5 w-3.5" /> Current
                  </span>
                ) : null}
              </div>
              <p className="mt-1 min-h-10 text-xs text-[var(--color-sand-2)]">{plan.description}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-black">{formatPrice(plan.priceCents, plan.currency)}</span>
                <span className="text-xs font-bold text-[var(--color-sand-2)]">
                  {plan.billingInterval === "monthly" ? "/ month" : plan.priceCents === 0 ? "forever" : "one-time"}
                </span>
              </div>
              <ul className="mt-3 flex-1 space-y-1.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-xs">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-mint)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || isCurrent}
                onClick={() => void handlePlanAction(plan)}
                className="mt-4 w-full rounded-xl bg-[var(--color-brass)] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-black transition hover:brightness-110 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  "Current plan"
                ) : plan.priceCents === 0 ? (
                  "Choose Free"
                ) : plan.billingInterval === "monthly" ? (
                  "Subscribe with PayPal"
                ) : (
                  "Pay with PayPal"
                )}
              </button>
              {payingPlanId === plan.id ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div ref={paypalButtonsRef} />
                  <button
                    type="button"
                    onClick={() => setPayingPlanId(null)}
                    className="mt-2 w-full text-center text-[11px] font-bold text-[var(--color-sand-2)] hover:text-white"
                  >
                    Cancel checkout
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Payment history */}
      <div className="panel glass-shine rounded-[1.75rem] p-5">
        <div className="eyebrow mb-3">Payment history</div>
        {payments.length === 0 ? (
          <p className="text-xs text-[var(--color-sand-2)]">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs"
              >
                <span className="font-bold">{formatPrice(payment.amountCents, payment.currency)}</span>
                <span className="text-[var(--color-sand-2)]">{payment.planId}</span>
                <span className="uppercase tracking-widest text-[10px] font-black text-[var(--color-sand-2)]">
                  {payment.status}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-sand-2)]">
                  {new Date(payment.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-sand-2)]">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-mint)]" />
          Payments are processed securely by PayPal. This site never sees your card details.
        </p>
      </div>
    </div>
  );
}
