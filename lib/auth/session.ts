/**
 * The single seam every screen/route reads through for identity - mirrors
 * lib/data-source.ts's pattern exactly. AUTH_PROVIDER (default "mock")
 * picks the implementation; callers never branch on it themselves.
 */
import { cookies } from "next/headers";
import { ensureDemoUser, getUserById } from "./user-store";
import { getClerkSession } from "./providers/clerk";
import type { MockSession } from "../types";

export const SESSION_COOKIE = "eh_session"; // mock mode only

/**
 * `secure: true` unconditionally would break local dev - browsers only
 * attach Secure cookies over HTTPS (with a special-case exemption for
 * literally "localhost", which isn't reliable enough to depend on for
 * every dev setup, e.g. testing against a LAN IP or a custom hosts-file
 * domain). Gating on NODE_ENV is the standard fix: real deployments always
 * run as "production", so this is never accidentally left insecure there.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

const IS_CLERK = process.env.AUTH_PROVIDER === "clerk";

function getMockSession(): MockSession | null {
  const userId = cookies().get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user) return null;
  return { userId: user.userId, email: user.email, plan: user.plan, role: user.role, preferences: user.preferences };
}

/** Server-only. Returns null if no one is signed in - never substitutes the demo account. */
export async function getSession(): Promise<MockSession | null> {
  return IS_CLERK ? getClerkSession() : getMockSession();
}

/**
 * Server-only. In mock mode, falls back to the seeded demo account so every
 * screen is viewable pre-signup - that's a deliberate mock-only convenience,
 * not something that should ever happen in real mode. In Clerk mode, a null
 * session here means middleware.ts's clerkMiddleware() failed to protect
 * this route - that's a configuration bug to surface loudly, not a case to
 * paper over by handing back a demo user's private data.
 */
export async function getSessionOrDemo(): Promise<MockSession> {
  const session = await getSession();
  if (session) return session;

  if (IS_CLERK) {
    throw new Error(
      "No authenticated session found in Clerk mode. This route should be protected by middleware.ts's clerkMiddleware() - check the matcher config."
    );
  }

  const demo = ensureDemoUser();
  return { userId: demo.userId, email: demo.email, plan: demo.plan, role: demo.role, preferences: demo.preferences };
}
