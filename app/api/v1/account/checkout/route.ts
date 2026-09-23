/**
 * Starts a real Stripe Checkout session for a plan upgrade (Section 7.1).
 * Only meaningful in real billing mode - the mock PlanSelector never calls
 * this route, since it PATCHes /api/v1/account/plan directly instead.
 */
import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { apiError, parseBody } from "@/lib/api/error";
import { checkoutSchema } from "@/lib/api/schemas";

export async function POST(request: Request) {
  if (process.env.BILLING_PROVIDER !== "stripe") {
    return apiError("NOT_FOUND", "Real billing is not enabled.", 404);
  }

  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, checkoutSchema);
  if (!parsed.ok) return parsed.response;
  const { plan } = parsed.body;

  const url = await createCheckoutSession({ userId: session.userId, email: session.email, plan });
  return NextResponse.json({ data: { url } });
}
