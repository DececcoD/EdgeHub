/**
 * Opens a real Stripe Billing Portal session (Section 7.1) so a paying user
 * can update their card, change plan, or cancel outside our own UI.
 */
import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { createPortalSession } from "@/lib/billing/checkout";
import { apiError } from "@/lib/api/error";

export async function POST() {
  if (process.env.BILLING_PROVIDER !== "stripe") {
    return apiError("NOT_FOUND", "Real billing is not enabled.", 404);
  }

  const session = await getSessionOrDemo();
  const url = await createPortalSession(session.userId);
  return NextResponse.json({ data: { url } });
}
