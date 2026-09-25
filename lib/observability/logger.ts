/**
 * Structured logging - previously every log call in this app was a raw
 * `console.log`/`console.error` with no consistent shape, scattered across
 * 5 files (webhooks, realtime, ingestion). Always active, zero config,
 * matching the project's own "zero config to run" property - nothing here
 * depends on an external service. See ../observability/capture.ts for the
 * companion error-tracking seam (Sentry, gated on SENTRY_DSN).
 *
 * Emits one JSON object per line to stdout/stderr - the standard shape for
 * a log collector (CloudWatch, Datadog, etc.) to parse without a custom
 * grammar. Falls back to a human-readable line in development, since a
 * wall of single-line JSON is hard to read in a local terminal.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

function write(level: LogLevel, event: string, fields?: LogFields) {
  const record = { level, event, time: new Date().toISOString(), ...fields };
  const sink = level === "error" || level === "warn" ? console.error : console.log;

  if (process.env.NODE_ENV === "production") {
    sink(JSON.stringify(record));
  } else {
    const extra = fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
    sink(`[${level.toUpperCase()}] ${event}${extra}`);
  }
}

export const log = {
  debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields)
};
