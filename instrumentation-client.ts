/**
 * Browser-side Sentry init - current @sentry/nextjs convention (v11),
 * verified against their live docs and the installed package's webpack
 * config (which warns on the older sentry.client.config.ts filename).
 * NEXT_PUBLIC_ prefix since this is baked in at build time, same rule as
 * NEXT_PUBLIC_AUTH_PROVIDER/NEXT_PUBLIC_BILLING_PROVIDER elsewhere in this
 * app - a runtime-only env var here would never take effect.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1
});
