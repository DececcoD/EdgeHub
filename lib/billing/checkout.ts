/**
 * Checkout/Portal session creation - the two entry points a real user hits
 * when changing plan or managing billing (Section 7.1). Neither of these
 * ever writes `plan` directly - that only happens via the webhook
 * (app/api/webhooks/stripe/route.ts) once Stripe confirms payment.
 */
import { getStripeClient, PRICE_ID_BY_PLAN, getAppUrl } from "./stripe";
import { getStripeCustomerId, setStripeCustomerId } from "./subscription-store";

async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const existing = await getStripeCustomerId(userId);
  if (existing) return existing;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({ email, metadata: { userId } });
  await setStripeCustomerId(userId, customer.id);
  return customer.id;
}

export async function createCheckoutSession(params: { userId: string; email: string; plan: "pro" | "elite" }): Promise<string> {
  const priceId = PRICE_ID_BY_PLAN[params.plan];
  if (!priceId) {
    throw new Error(`No Stripe price configured for the ${params.plan} plan - set STRIPE_PRICE_ID_${params.plan.toUpperCase()} in .env.`);
  }

  const stripe = getStripeClient();
  const customerId = await ensureStripeCustomer(params.userId, params.email);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: params.userId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { userId: params.userId, plan: params.plan } },
    success_url: `${getAppUrl()}/account?checkout=success`,
    cancel_url: `${getAppUrl()}/account?checkout=cancelled`
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}

export async function createPortalSession(userId: string): Promise<string> {
  const customerId = await getStripeCustomerId(userId);
  if (!customerId) {
    throw new Error("No Stripe customer on file yet - complete a Checkout session before opening the billing portal.");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/account`
  });
  return session.url;
}
