/**
 * Real session resolution via Clerk (Section 7.1). Clerk owns identity and
 * credentials; this resolves an authenticated Clerk request down to our own
 * local `User` row (Postgres), which is what every screen/route actually
 * reads (plan, preferences) via the MockSession shape.
 *
 * Requires middleware.ts's clerkMiddleware() to have run on this request -
 * auth() throws a clear, actionable error otherwise (Clerk's own message,
 * not something we need to wrap).
 */
import { auth, clerkClient } from "@clerk/nextjs/server";
import { findByClerkUserId, createFromClerkUser } from "../../db/user-profile";
import type { MockSession } from "../../types";

export async function getClerkSession(): Promise<MockSession | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await findByClerkUserId(clerkUserId);
  if (existing) return existing;

  // Defensive fallback: the user.created webhook may not have landed yet -
  // Clerk's own docs are explicit that "webhook deliveries are not
  // guaranteed." Fetch the email directly and create the local row now
  // rather than leaving a just-signed-up user with no profile.
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error(`Clerk user ${clerkUserId} has no email address on file - cannot create a local profile.`);
  }

  return createFromClerkUser({ clerkUserId, email });
}
