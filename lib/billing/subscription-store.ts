/**
 * Postgres-backed subscription state for real billing (Section 7.1,
 * "webhook-driven entitlement state"). Separate from lib/db/user-profile.ts
 * (which owns auth/preferences) since this is specifically the Stripe
 * <-> Subscription row mapping - the webhook is the only writer of `plan`
 * once real billing is active; see app/api/v1/account/plan/route.ts.
 */
import { prisma } from "../db/prisma";
import type { Plan } from "../types";

/** Returns the existing Stripe customer ID for a user, or null if they've never checked out. */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub?.stripeCustomerId ?? null;
}

/** Persists a newly-created Stripe customer ID against the user's subscription row. */
export async function setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  await prisma.subscription.upsert({
    where: { userId },
    update: { stripeCustomerId },
    create: { userId, plan: "free", stripeCustomerId }
  });
}

export async function findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
  const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId } });
  return sub?.userId ?? null;
}

/** The plan a user is on right now, before a webhook-driven sync changes it - used to give the audit trail a real before/after, not just an after. */
export async function getCurrentPlan(userId: string): Promise<Plan | null> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return (sub?.plan as Plan | undefined) ?? null;
}

/**
 * The webhook's main write path: reconciles our local Subscription row with
 * what Stripe reports as the current state of a subscription. Called from
 * checkout.session.completed and customer.subscription.updated/deleted.
 */
export async function syncSubscriptionFromStripe(params: {
  userId: string;
  plan: Plan;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  await prisma.subscription.upsert({
    where: { userId: params.userId },
    update: {
      plan: params.plan,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      status: params.status,
      currentPeriodEnd: params.currentPeriodEnd
    },
    create: {
      userId: params.userId,
      plan: params.plan,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      status: params.status,
      currentPeriodEnd: params.currentPeriodEnd
    }
  });
}
