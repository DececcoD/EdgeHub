"use client";

/**
 * Last-resort error boundary - Next.js requires this to render its own
 * <html>/<body> (it replaces the entire root layout on a crash), so it
 * deliberately doesn't import next/font, ClerkProvider, or any other app
 * component that could itself be implicated in the crash. Previously this
 * app had no equivalent file at all: an unhandled render error fell
 * through to Next's default, unstyled error screen with nothing reporting
 * it anywhere.
 */
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-paper-0 p-6 text-ink-950 dark:bg-ink-950 dark:text-paper-0">
        <div className="max-w-sm rounded-xs border border-paper-200 p-6 text-center dark:border-ink-800">
          <p className="font-display text-lg font-semibold">Something went wrong</p>
          <p className="mt-2 text-sm text-paper-muted dark:text-ink-muted">
            This screen failed to load. Nothing was changed or lost - your tracker, alerts, and watchlist are unaffected.
          </p>
          {error.digest && <p className="mt-2 font-mono text-xs text-paper-muted dark:text-ink-muted">Reference: {error.digest}</p>}
          <button
            onClick={reset}
            className="mt-4 inline-flex items-center rounded-xs bg-ink-950 px-3 py-1.5 text-sm font-medium text-paper-0 hover:opacity-90 dark:bg-signal dark:text-ink-950"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
