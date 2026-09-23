import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements, hasQuotaRemaining } from "@/lib/billing/entitlements";
import { createAlert, listAlerts } from "@/lib/mock/user-data";
import { apiError, parseBody } from "@/lib/api/error";
import { createAlertSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSessionOrDemo();
  return NextResponse.json({ data: listAlerts(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);
  const active = listAlerts(session.userId).filter((a) => a.status === "active");

  if (!hasQuotaRemaining(entitlements.activeAlertLimit, active.length)) {
    return apiError("ALERT_LIMIT_REACHED", `The ${entitlements.label} plan supports up to ${entitlements.activeAlertLimit} active alerts.`, 429);
  }

  const parsed = await parseBody(request, createAlertSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  // subjectId is optional at the API boundary: the standalone "Create alert"
  // form on the Alerts page has no specific market to point at (only the
  // Analyzer's "Create alert" link pre-fills a real outcome id), so a
  // freeform alert gets a synthetic id derived from its label instead of
  // being rejected as missing a required field.
  const subjectId =
    body.subjectId && body.subjectId.length > 0
      ? body.subjectId
      : `custom_${body.subjectLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now()}`;

  const alert = createAlert({
    userId: session.userId,
    subjectLabel: body.subjectLabel,
    subjectType: body.subjectType,
    subjectId,
    conditionType: body.conditionType,
    threshold: body.threshold,
    channel: body.channel,
    quietHoursStart: body.quietHoursStart,
    quietHoursEnd: body.quietHoursEnd,
    cooldownSeconds: body.cooldownSeconds
  });

  return NextResponse.json({ data: alert }, { status: 201 });
}
