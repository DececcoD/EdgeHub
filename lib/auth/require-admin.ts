/**
 * Admin console gate (Section 12.3: RBAC + MFA required before a real
 * launch). Two independent checks:
 *
 *  - RBAC: session.role === "admin", our own app-level concept (not a
 *    Clerk Organization role - Orgs are a multi-tenant feature this
 *    single-tenant app has no use for). Works in both mock and real mode.
 *    Grant is never self-service; see DEPLOYMENT.md for how to grant it.
 *  - MFA: real Clerk mode only, via auth.protect({ reverification:
 *    "strict_mfa" }) - verified directly against the installed SDK's type
 *    definitions (SessionVerificationTypes = 'strict_mfa' | 'strict' |
 *    'moderate' | 'lax'; "strict_mfa" is the shorthand for requiring a
 *    recently-verified second factor). This only checks that the CURRENT
 *    session recently verified two factors - it does not force a user's
 *    account to have 2FA configured at all. That's a Clerk project-level
 *    setting ("Require MFA"), a Dashboard config step, not app code - see
 *    DEPLOYMENT.md.
 *
 * Mock mode has no MFA story at all, by design: mock auth has no password
 * or any other first factor to begin with (see lib/auth/user-store.ts's
 * own docstring), so simulating a second factor on top of that would be
 * fiction, not a meaningful stand-in.
 */
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getSessionOrDemo } from "./session";
import type { MockSession } from "../types";

const IS_CLERK = process.env.AUTH_PROVIDER === "clerk";

export async function requireAdmin(): Promise<MockSession> {
  const session = await getSessionOrDemo();
  if (session.role !== "admin") notFound();

  if (IS_CLERK) {
    await auth.protect({ reverification: "strict_mfa" });
  }

  return session;
}
