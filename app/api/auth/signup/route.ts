/**
 * Mock signup - Section 4.2 New User Flow. A real deployment swaps this for
 * Supabase Auth or Clerk (Section 7.1); this only exists so the onboarding
 * flow is exercisable end-to-end in the prototype.
 */
import { NextResponse } from "next/server";
import { createUser, updatePreferences } from "@/lib/auth/user-store";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { apiError, parseBody } from "@/lib/api/error";
import { signupSchema } from "@/lib/api/schemas";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`signup:${getClientKey(request)}`, { limit: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) {
    const res = apiError("RATE_LIMITED", "Too many signup attempts - try again shortly.", 429, { retryable: true });
    res.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return res;
  }

  const parsed = await parseBody(request, signupSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const user = createUser(body.email.toLowerCase(), "free");
  updatePreferences(user.userId, {
    oddsFormat: body.oddsFormat ?? "american",
    favoriteLeagues: body.favoriteLeagues ?? [],
    favoriteBooks: body.favoriteBooks ?? [],
    timezone: body.timezone ?? "UTC",
    onboardedAt: new Date().toISOString()
  });

  const response = NextResponse.json({ data: { userId: user.userId, email: user.email } }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, user.userId, SESSION_COOKIE_OPTIONS);
  return response;
}
