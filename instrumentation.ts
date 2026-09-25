/**
 * Next.js's official server-startup hook - see lib/alerts/tick-listener.ts
 * for this project's own earlier, hard-won finding that this file compiles
 * into an isolated bundle that does NOT share module-scoped state with
 * route handlers (why the alert-evaluation subscription lives in a route
 * handler instead, not here). Sentry's init doesn't hit that problem: it
 * stores its client on `globalThis.__SENTRY__` rather than module-scoped
 * state, verified directly against the installed @sentry/core source (see
 * lib/observability/capture.ts's header) - so this really is the right,
 * working place for Sentry specifically, even though it wasn't for the
 * alert listener.
 *
 * Requires `experimental.instrumentationHook: true` in next.config.mjs on
 * this Next 14.2.35 pin (confirmed via the installed package's own
 * config-shared.js: instrumentationHook defaults to false, still
 * experimental at this version - not stabilized-by-default the way it is
 * in later Next majors this project isn't on).
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
