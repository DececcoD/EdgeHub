/**
 * Route protection - only active in real-auth mode. In mock mode this is a
 * pure pass-through: getSessionOrDemo()'s demo-account fallback is what
 * makes every screen viewable pre-signup there, and Clerk's middleware
 * would have nothing to check (no real session ever exists in mock mode).
 *
 * Also where CSP is applied (Section 14 QA pass). Tried a per-request
 * nonce for script-src first - Next.js's own documented mechanism, and
 * the installed version genuinely wires a nonce all through its render
 * pipeline (app-render.js, verified by reading the source). It still
 * broke live: several routes in this app are statically generated at
 * build time (the marketing pages, login, signup, calculator - the ○
 * routes in `npm run build`'s output), and a nonce baked into HTML at
 * build time can never match the fresh per-request nonce a middleware
 * generates on every request - a real, documented Next.js limitation of
 * nonces vs. static optimization, not a bug in this setup. Forcing every
 * static page dynamic just to support nonces would trade away real
 * performance for a security property this app has low residual risk
 * for anyway (grepped: no `dangerouslySetInnerHTML` anywhere in the
 * codebase, so there's no first-party inline-script injection vector this
 * would even be protecting against). `'unsafe-inline'` on script-src -
 * live-verified this way, not just type-checked - keeps every other
 * directive (frame-ancestors, base-uri, form-action, object-src, connect-
 * src) strict.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const IS_CLERK = process.env.AUTH_PROVIDER === "clerk";

// Everything under (app) plus the account-scoped v1 API routes require a
// signed-in user. Public marketing pages, auth pages, and the Clerk webhook
// itself must stay reachable without a session.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/markets(.*)",
  "/opportunities(.*)",
  "/analyzer(.*)",
  "/tracker(.*)",
  "/portfolio(.*)",
  "/alerts(.*)",
  "/learn(.*)",
  "/account(.*)",
  "/admin(.*)",
  "/api/v1(.*)"
]);

// Sentry's browser SDK (instrumentation-client.ts) posts events straight
// to their ingest API - connect-src 'self' alone would silently CSP-block
// every client-side error report. Only added when a DSN is actually
// configured (the default has none, so connect-src stays exactly 'self').
// https://*.sentry.io covers Sentry's own SaaS; a self-hosted Sentry
// instance would need its own domain added here instead.
const connectSrc = process.env.NEXT_PUBLIC_SENTRY_DSN ? "connect-src 'self' https://*.sentry.io" : "connect-src 'self'";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  connectSrc,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

function withCsp(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP);
  return response;
}

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
  return withCsp(NextResponse.next());
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!IS_CLERK) return withCsp(NextResponse.next());
  return clerkAuthMiddleware(req, event);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"]
};
