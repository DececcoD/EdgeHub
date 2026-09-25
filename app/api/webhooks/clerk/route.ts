/**
 * Primary sync path from Clerk identity -> our local `users` row (Section
 * 7.1/8.1). lib/auth/providers/clerk.ts has a defensive fallback for the
 * window before this fires, but this is the path that should normally
 * create/update the local profile - Clerk's own guidance is that
 * middleware must NOT protect this route (it can't carry a session).
 */
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createFromClerkUser } from "@/lib/db/user-profile";
import { captureException, captureMessage } from "@/lib/observability/capture";

export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    captureException(error, { route: "webhooks/clerk", stage: "verify" });
    return new Response("Webhook verification failed", { status: 400 });
  }

  try {
    if (event.type === "user.created") {
      const primaryEmail =
        event.data.email_addresses.find((e) => e.id === event.data.primary_email_address_id)?.email_address ??
        event.data.email_addresses[0]?.email_address;
      if (!primaryEmail) {
        captureMessage("Clerk user.created webhook had no email address - skipping local sync", { clerkUserId: event.data.id });
        return new Response("No email address on user", { status: 200 }); // 2xx: don't ask Clerk to retry a payload that will never have an email
      }
      await createFromClerkUser({ clerkUserId: event.data.id, email: primaryEmail });
    }

    if (event.type === "user.updated") {
      const primaryEmail =
        event.data.email_addresses.find((e) => e.id === event.data.primary_email_address_id)?.email_address ??
        event.data.email_addresses[0]?.email_address;
      if (primaryEmail) {
        await prisma.user.updateMany({ where: { clerkUserId: event.data.id }, data: { email: primaryEmail } });
      }
    }

    // user.deleted: intentionally not hard-deleting the local row here.
    // Section 8.3: "Soft-delete user content where legally appropriate" -
    // actual retention/deletion policy is a Phase 0 legal decision
    // (DECISIONS.md item 6), not something to hard-code into a webhook.

    return new Response("OK", { status: 200 });
  } catch (error) {
    captureException(error, { route: "webhooks/clerk", stage: "handle", eventType: event.type });
    // 500 tells Clerk to retry - correct here since this is our bug, not a
    // malformed payload.
    return new Response("Internal error", { status: 500 });
  }
}
