/**
 * Edge-runtime Sentry init (middleware.ts runs here), imported by
 * instrumentation.ts's register() hook when NEXT_RUNTIME === "edge". Same
 * no-op-when-unconfigured behavior as sentry.server.config.ts - see that
 * file's header.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1
});
