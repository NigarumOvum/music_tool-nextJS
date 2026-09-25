import { errorResponse, jsonResponse } from "@/lib/api";
import { getPaypalMode } from "@/lib/membership-paypal";

export async function GET() {
  try {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() || null;
    return jsonResponse({
      clientId,
      mode: getPaypalMode(),
      currency: "USD",
      configured: Boolean(clientId && process.env.PAYPAL_CLIENT_SECRET?.trim()),
    });
  } catch (error) {
    return errorResponse((error as Error).message || "Failed to load payment config");
  }
}
