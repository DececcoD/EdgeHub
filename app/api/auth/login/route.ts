/**
 * Mock login - no password, since there is no real credential store in this
 * prototype (Section 7.1's Supabase Auth/Clerk replaces this). Logging in
 * with any known email resumes that session; an unknown email is rejected
 * rather than silently creating an account, so /signup stays the one path
 * that creates a user.
 */
import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth/user-store";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { apiError, parseBody } from "@/lib/api/error";
import { loginSchema } from "@/lib/api/schemas";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  // No password means the only real risk here is a scripted loop probing
  // which emails exist via the 404 - rate limiting is the actual defense
  // this route has, not a defense-in-depth extra.
  const rateLimit = checkRateLimit(`login:${getClientKey(request)}`, { limit: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) {
    const res = apiError("RATE_LIMITED", "Too many login attempts - try again shortly.", 429, { retryable: true });
    res.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return res;
  }

  const parsed = await parseBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;
  const user = getUserByEmail(parsed.body.email.toLowerCase());
  if (!user) return apiError("NOT_FOUND", "No account found for that email. Try Start free instead.", 404);

  const response = NextResponse.json({ data: { userId: user.userId, email: user.email } });
  response.cookies.set(SESSION_COOKIE, user.userId, SESSION_COOKIE_OPTIONS);
  return response;
}
