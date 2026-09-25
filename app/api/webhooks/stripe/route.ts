/**
 * The sole writer of `plan` in real billing mode (Section 7.1: "webhook-
 * driven entitlement state"). Neither the Checkout flow nor any client PATCH
 * sets plan directly - only a confirmed Stripe event does, so a user can
 * never grant themselves a paid plan without actually paying.
 *
 * Must read the RAW request body for signature verification - calling
 * request.json() first would re-serialize the payload and break the
 * signature check, since Stripe signs the exact bytes it sent.
 */
import Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe";
import { findUserIdByStripeCustomerId, getCurrentPlan, syncSubscriptionFromStripe } from "@/lib/billing/subscription-store";
import { captureException, captureMessage } from "@/lib/observability/capture";
import { recordAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import type { Plan } from "@/lib/types";

function planFromMetadata(metadata: Stripe.Metadata): Plan | null {
  return metadata.plan === "pro" || metadata.plan === "elite" ? metadata.plan : null;
}

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === "string" ? customer : customer.id;
}

async function syncFromSubscriptionObject(subscription: Stripe.Subscription, fallbackPlan?: Plan) {
  const stripeCustomerId = customerIdOf(subscription.customer);
  const userId = subscription.metadata.userId ?? (await findUserIdByStripeCustomerId(stripeCustomerId));
  if (!userId) {
    captureMessage("Stripe subscription has no userId metadata and no matching local customer - cannot sync", { subscriptionId: subscription.id });
    return;
  }

  const plan = fallbackPlan ?? planFromMetadata(subscription.metadata) ?? "free";
  const firstItem = subscription.items.data[0];
  const currentPeriodEnd = firstItem ? new Date(firstItem.current_period_end * 1000) : null;

  const previousPlan = await getCurrentPlan(userId);

  await syncSubscriptionFromStripe({
    userId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd
  });

  // PRD Section 12.2: audit logging is a required security control. A plan
  // change is real money/entitlement changing hands - exactly the kind of
  // event worth a tamper-evident trail, not just the webhook's own success log.
  await recordAuditLog(prisma, {
    actorType: "system",
    actorId: userId,
    action: "plan_synced",
    objectType: "subscription",
    objectId: subscription.id,
    before: previousPlan ? { plan: previousPlan } : undefined,
    after: { plan, status: subscription.status }
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    captureException(error, { route: "webhooks/stripe", stage: "verify" });
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
        await syncFromSubscriptionObject(subscription);
        break;
      }

      case "customer.subscription.updated": {
        await syncFromSubscriptionObject(event.data.object);
        break;
      }

      case "customer.subscription.deleted": {
        // Cancellation always reverts to free, regardless of what plan
        // metadata says - the subscription that granted it no longer exists.
        await syncFromSubscriptionObject(event.data.object, "free");
        break;
      }

      case "invoice.payment_failed": {
        // Section 11.2 runbook: "retry idempotently; retain prior
        // entitlement during grace period" - Stripe's own retry schedule
        // and subscription.status transitions (active -> past_due ->
        // unpaid/canceled) already drive that; nothing to do here beyond
        // logging until a dedicated dunning/notification flow exists.
        captureMessage("Invoice payment failed", { customerId: customerIdOf(event.data.object.customer!) });
        break;
      }

      default:
        break;
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    captureException(error, { route: "webhooks/stripe", stage: "handle", eventType: event.type });
    return new Response("Internal error", { status: 500 }); // 500 tells Stripe to retry
  }
}
