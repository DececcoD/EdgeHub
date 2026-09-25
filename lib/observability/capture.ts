/**
 * Error-tracking seam - the same "one switch every caller reads through"
 * pattern as lib/data-source.ts/lib/auth/session.ts/lib/billing/client-
 * mode.ts. Callers never touch @sentry/nextjs directly; they call
 * captureException() here, which always logs structurally (../logger.ts)
 * and additionally reports to Sentry whenever SENTRY_DSN is configured.
 *
 * Verified directly against the installed @sentry/core package (not
 * assumed): Sentry.init()/captureException() store and read client state
 * via `globalThis.__SENTRY__` (lib/../../../node_modules/@sentry/core/
 * build/cjs/carrier.js's getGlobalSingleton()) - a true global, not a
 * module-scoped variable. That's the exact reason Sentry's own documented
 * instrumentation.ts pattern actually works despite this project's own
 * earlier, hard-won finding that instrumentation.ts compiles into an
 * isolated bundle that does NOT share module-scoped state with route
 * handlers (see lib/alerts/tick-listener.ts's header) - Sentry's design
 * sidesteps that specific problem by never relying on module-scope state
 * in the first place. Different mechanism, so the earlier finding doesn't
 * apply here - confirmed by reading the source, not assumed from either
 * finding generalizing to the other.
 *
 * With no SENTRY_DSN set (the default - no Sentry account exists to test
 * against in this environment), Sentry.captureException() is a documented
 * safe no-op (confirmed: @sentry/core's client only sets up a DSN-
 * dependent transport when options.dsn is truthy) - so this file behaves
 * identically whether or not the SDK is configured, same "zero config to
 * run" property as every other integration here.
 */
import * as Sentry from "@sentry/nextjs";
import { log, type LogFields } from "./logger";

export function captureException(error: unknown, context?: LogFields): void {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message, { ...context, stack: error instanceof Error ? error.stack : undefined });
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, context?: LogFields): void {
  log.warn(message, context);
  Sentry.captureMessage(message, context ? { extra: context } : undefined);
}
