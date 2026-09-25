import { errorResponse, jsonResponse } from "@/lib/api";
import { listPlans } from "@/lib/membership";

export async function GET() {
  try {
    const plans = await listPlans();
    return jsonResponse({ plans });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load plans");
  }
}
