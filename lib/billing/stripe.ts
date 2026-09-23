/**
 * Stripe client singleton - Section 7.1 "Stripe Billing/Checkout - webhook-
 * driven entitlement state." Only constructed when actually used (real
 * billing mode); throws a clear error rather than a cryptic SDK failure if
 * STRIPE_SECRET_KEY is missing when it's needed.
 */
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set - real billing mode requires it. See .env.example.");
  }
  client = new Stripe(key);
  return client;
}

export const PRICE_ID_BY_PLAN: Record<"pro" | "elite", string | undefined> = {
  pro: process.env.STRIPE_PRICE_ID_PRO,
  elite: process.env.STRIPE_PRICE_ID_ELITE
};

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
