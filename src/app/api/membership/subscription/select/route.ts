import { errorResponse, jsonResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createSubscription, getPlan } from "@/lib/membership";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<{ planId?: string }>(request, {});
    const plan = body.planId ? await getPlan(body.planId) : null;
    if (!plan || !plan.isActive) {
      return errorResponse("Plan not found", 404);
    }
    if (plan.priceCents > 0) {
      return errorResponse("This plan requires PayPal checkout", 400);
    }
    const subscription = await createSubscription({ userId: user.id, planId: plan.id });
    const { updateSubscription } = await import("@/lib/membership");
    await updateSubscription(subscription.id, {
      status: "active",
      currentPeriodStart: new Date().toISOString(),
    });
    return jsonResponse({ subscription: { ...subscription, status: "active" } }, 201);
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to select plan", 400);
  }
}
