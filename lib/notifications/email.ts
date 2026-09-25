/**
 * Email alert delivery - PRD Section 10.2 ("Channels: in-app and email at
 * MVP") was never actually built: `AlertDef.channel` has always accepted
 * "email", but lib/alerts/evaluate.ts never branched on it, so selecting
 * Email did nothing different from In-app. This is the real send path.
 *
 * Same seam pattern as every other integration here (lib/data-source.ts,
 * lib/observability/capture.ts): gated on RESEND_API_KEY, a complete no-op
 * (structurally logged, not silent) when unset - "zero config to run"
 * still holds. Not live-tested against a real Resend account - no
 * account exists in this environment - same disclosed gap as Stripe/
 * Clerk/Sentry elsewhere in this project.
 *
 * Verified directly against Resend's live docs (2026-09-24), not assumed:
 * `resend.emails.send()` returns `{ data, error }` rather than throwing on
 * an API-level failure (a network-level failure - DNS, timeout - can still
 * throw, so this is wrapped in try/catch regardless). `onboarding@
 * resend.dev` is their own documented sandbox From-address that works
 * with no custom domain/DNS verification - the default here, overridable
 * once a real sending domain is verified.
 */
import { Resend } from "resend";
import { getAppUrl } from "../billing/stripe";
import { captureException, log } from "../observability";

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "EdgeHub <onboarding@resend.dev>";
}

// Constructed fresh per call rather than cached as a module singleton -
// alert emails are a low-frequency operation, and this sidesteps any
// concern about a cached client outliving an env var change (e.g. a
// stale RESEND_API_KEY surviving a hot-reload in dev).
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface AlertEmailParams {
  to: string;
  subjectLabel: string;
  message: string;
  triggeredAt: string; // ISO
}

/**
 * PRD 10.2's exact content requirements: "Every message includes market
 * identity, trigger evidence, timestamp, and manage-alert link" and "Loss-
 * chasing language and urgency pressure are prohibited" - the copy below
 * states the fact and links back, nothing more, matching the same neutral
 * tone create-alert-form.tsx's own in-app copy already commits to.
 */
export async function sendAlertEmail(params: AlertEmailParams): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    log.info("alert_email_skipped_not_configured", { to: params.to });
    return false;
  }

  const manageAlertUrl = `${getAppUrl()}/alerts`;
  const subject = `EdgeHub alert: ${params.subjectLabel}`;
  const html = [
    `<p><strong>${escapeHtml(params.subjectLabel)}</strong></p>`,
    `<p>${escapeHtml(params.message)}</p>`,
    `<p style="color:#666;font-size:13px">Triggered at ${escapeHtml(params.triggeredAt)}</p>`,
    `<p><a href="${manageAlertUrl}">Manage this alert</a></p>`
  ].join("\n");

  try {
    const { data, error } = await resend.emails.send({ from: fromAddress(), to: params.to, subject, html });
    if (error) {
      captureException(new Error(error.message), { source: "resend", to: params.to });
      return false;
    }
    log.info("alert_email_sent", { to: params.to, resendId: data?.id });
    return true;
  } catch (err) {
    captureException(err, { source: "resend", to: params.to });
    return false;
  }
}
