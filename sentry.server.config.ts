/**
 * Server-runtime Sentry init, imported by instrumentation.ts's register()
 * hook when NEXT_RUNTIME === "nodejs". No SENTRY_DSN set (the default) ->
 * Sentry.init({dsn: undefined}) is a documented no-op that never sets up a
 * transport (verified against the installed @sentry/core source, not
 * assumed) - same "zero config to run" property as every other
 * integration in this app.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1
});
