import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // Docker (see Dockerfile) copies just this trimmed output, not the full node_modules tree.
  experimental: {
    typedRoutes: false,
    // Still an experimental flag on this pinned Next 14.2.35 (confirmed via
    // the installed package's config-shared.js - instrumentationHook
    // defaults to false at this version). Needed for instrumentation.ts's
    // register() hook (Sentry init) to run at all.
    instrumentationHook: true
  },
  // Section 14 QA pass - baseline security headers this app had none of
  // before. CSP is handled separately (see middleware.ts) since it needs a
  // per-request nonce for Next's inline hydration scripts, which a static
  // header here can't generate.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // clickjacking - this app has no legitimate reason to be framed
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // none of these are used anywhere in the app
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
        ]
      }
    ];
  }
};

/**
 * Only wraps the config (adding the build-time bundler plugin that
 * uploads source maps to Sentry) when there's a real project to upload
 * them to - SENTRY_AUTH_TOKEN, not just SENTRY_DSN, since the DSN alone is
 * enough for runtime error *capturing* (see sentry.server.config.ts) but
 * source-map upload needs real Sentry API credentials this environment
 * has no account to generate. Unwrapped, `npm run build` is byte-for-byte
 * the same as before this file existed - verified with zero env vars set,
 * the same invariant every other integration in this project maintains.
 * Not live-tested with a real authToken/org/project (no Sentry account
 * exists here to test against) - same disclosed gap as Stripe/Clerk.
 */
const sentryReady = Boolean(process.env.SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN);

export default sentryReady
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      disableLogger: true
    })
  : nextConfig;
