/**
 * Mock plan change / real plan sync. In real billing mode (Section 7.1)
 * this route refuses to change plan at all - only a confirmed Stripe webhook
 * (app/api/webhooks/stripe/route.ts) may do that, so a user can never grant
 * themselves a paid plan without actually paying. It stays open in mock
 * mode, and in real-auth-but-mock-billing mode, since no real charge is
 * involved either way there.
 */
import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { updatePlan as updateMockPlan } from "@/lib/auth/user-store";
import { updatePlan as updateRealPlan } from "@/lib/db/user-profile";
import { apiError, parseBody } from "@/lib/api/error";
import { updatePlanSchema } from "@/lib/api/schemas";
import type { Plan } from "@/lib/types";

const IS_CLERK = process.env.AUTH_PROVIDER === "clerk";
const IS_STRIPE = process.env.BILLING_PROVIDER === "stripe";

export async function PATCH(request: Request) {
  if (IS_STRIPE) {
    return apiError(
      "FORBIDDEN",
      "Plan changes go through Stripe Checkout/Portal in real billing mode - see /api/v1/account/checkout.",
      403
    );
  }

  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, updatePlanSchema);
  if (!parsed.ok) return parsed.response;
  const { plan } = parsed.body;

  const updated = IS_CLERK
    ? await updateRealPlan(session.userId, plan as Plan)
    : updateMockPlan(session.userId, plan as Plan);

  if (!updated) return apiError("NOT_FOUND", "Session user not found.", 404);
  return NextResponse.json({ data: { plan: updated.plan } });
}
