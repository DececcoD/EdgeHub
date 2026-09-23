/**
 * Alert evaluation - previously a complete gap: AlertDef/AlertEvent existed
 * in the schema and Alerts was one of the 9 core screens, but nothing ever
 * actually checked whether a condition was met. Runs on every odds tick,
 * local or remote (mock's "Simulate market tick" button, or a real
 * ingestion run) - triggered centrally by lib/alerts/tick-listener.ts's
 * subscription to the realtime bus, not called directly from any one
 * route. See that file's header for why a single, central reaction point
 * is what actually closes the local-vs-remote-tick gap, rather than
 * calling this from every place that can publish a tick.
 *
 * Alerts themselves are always mock (lib/mock/user-data.ts) regardless of
 * USE_MOCK_DATA/AUTH_PROVIDER - the ingestion swap never extended to
 * per-user activity data (tracker/alerts/watchlist), only market data. This
 * evaluator reads odds through lib/data-source.ts (so it's correct in
 * either mode) but reads/writes alerts only through the mock store.
 */
import { findOutcome, getPriceHistory } from "../data-source";
import { getUserById } from "../auth/user-store";
import { listAllActiveAlerts, markAlertTriggered, recordAlertEvent, setAlertStatus } from "../mock/user-data";
import { decimalToImpliedProbability, americanToDecimal } from "../calc/odds";
import { realtimeBus } from "../realtime/bus";
import type { AlertDef } from "../types";

const MOVEMENT_WINDOW_MINUTES = 60; // matches the create-alert form's own label: "moves within 60 minutes"

interface EvalResult {
  fired: boolean;
  message: string;
}

async function evaluateCondition(alert: AlertDef, now: Date): Promise<EvalResult | null> {
  if (alert.subjectType !== "outcome") return null; // never actually creatable via the UI today - see create-alert-form.tsx

  const found = await findOutcome(alert.subjectId);
  if (!found) return null; // outcome no longer resolvable (e.g. stale seed data) - nothing to evaluate
  const { market, outcome } = found;

  switch (alert.conditionType) {
    case "odds_threshold": {
      // Compared in decimal, not American: decimal odds increase
      // monotonically with how good the price is for the bettor on either
      // side of the line, so ">=" means "reached at least this good"
      // regardless of whether the threshold/current price are positive or
      // negative American numbers - comparing the American values
      // directly would flip meaning depending on sign.
      if (!outcome.bestQuote) return { fired: false, message: "" };
      const thresholdDecimal = americanToDecimal(alert.threshold);
      const fired = outcome.bestQuote.decimalOdds >= thresholdDecimal;
      return { fired, message: `Best price reached ${outcome.bestQuote.americanOdds > 0 ? "+" : ""}${outcome.bestQuote.americanOdds} at ${outcome.bestQuote.sportsbookName}.` };
    }

    case "edge_threshold": {
      if (outcome.edgePp === null) return { fired: false, message: "" };
      const fired = outcome.edgePp >= alert.threshold;
      return { fired, message: `Displayed edge reached ${outcome.edgePp.toFixed(1)}pp.` };
    }

    case "book_spread": {
      const eligible = outcome.quotes.filter((q) => q.freshness === "current" || q.freshness === "aging");
      if (eligible.length < 2) return { fired: false, message: "" };
      const sorted = [...eligible].sort((a, b) => b.decimalOdds - a.decimalOdds);
      const bestP = decimalToImpliedProbability(sorted[0]!.decimalOdds);
      const secondP = decimalToImpliedProbability(sorted[1]!.decimalOdds);
      const gapPp = Math.abs(bestP - secondP) * 100;
      const fired = gapPp >= alert.threshold;
      return { fired, message: `Best-vs-second-best gap reached ${gapPp.toFixed(1)}pp (${sorted[0]!.sportsbookName} vs ${sorted[1]!.sportsbookName}).` };
    }

    case "movement": {
      if (!outcome.bestQuote) return { fired: false, message: "" };
      const history = await getPriceHistory(alert.subjectId);
      if (history.length < 2) return { fired: false, message: "" };
      const cutoff = now.getTime() - MOVEMENT_WINDOW_MINUTES * 60_000;
      const sorted = [...history].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      const past = [...sorted].reverse().find((h) => new Date(h.at).getTime() <= cutoff) ?? sorted[0]!;

      const currentP = decimalToImpliedProbability(outcome.bestQuote.decimalOdds);
      const pastP = decimalToImpliedProbability(past.decimalOdds);
      const movedPp = Math.abs(currentP - pastP) * 100;
      const fired = movedPp >= alert.threshold;
      return { fired, message: `Probability moved ${movedPp.toFixed(1)}pp in the last ${MOVEMENT_WINDOW_MINUTES} minutes.` };
    }

    case "start_reminder": {
      const minutesUntilStart = (new Date(market.event.startAt).getTime() - now.getTime()) / 60_000;
      const fired = minutesUntilStart >= 0 && minutesUntilStart <= alert.threshold;
      return { fired, message: `${market.event.away.name} @ ${market.event.home.name} starts in ${Math.max(0, Math.round(minutesUntilStart))} minutes.` };
    }

    default:
      return null;
  }
}

function isWithinCooldown(alert: AlertDef, now: Date): boolean {
  if (!alert.lastTriggeredAt) return false;
  return (now.getTime() - new Date(alert.lastTriggeredAt).getTime()) / 1000 < alert.cooldownSeconds;
}

/**
 * Quiet hours suppress the notification entirely rather than queuing it for
 * delivery afterward - a stated simplification, not a full "defer and
 * deliver later" implementation. Evaluated in the alert owner's own
 * timezone preference, falling back to UTC if unset.
 */
function isWithinQuietHours(alert: AlertDef, now: Date): boolean {
  const timezone = getUserById(alert.userId)?.preferences.timezone ?? "UTC";
  let localTime: string;
  try {
    localTime = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  } catch {
    localTime = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  }

  const [start, end] = [alert.quietHoursStart, alert.quietHoursEnd];
  if (start === end) return false;
  // Overnight windows (e.g. 23:00 -> 07:00) wrap past midnight; same-day windows don't.
  return start < end ? localTime >= start && localTime < end : localTime >= start || localTime < end;
}

export async function evaluateAlerts(now: Date = new Date()): Promise<{ fired: number; evaluated: number }> {
  const alerts = listAllActiveAlerts();
  let fired = 0;

  for (const alert of alerts) {
    if (isWithinCooldown(alert, now)) continue;

    const result = await evaluateCondition(alert, now);
    if (!result?.fired) continue;
    if (isWithinQuietHours(alert, now)) continue; // condition met, but suppressed for now - not recorded, not re-checked until it re-fires after quiet hours

    markAlertTriggered(alert.userId, alert.id, now.toISOString());
    if (alert.conditionType === "start_reminder") {
      // One-shot by nature - re-arming it would just repeat the same reminder every tick until the event starts.
      setAlertStatus(alert.userId, alert.id, "expired");
    }

    recordAlertEvent(alert.userId, {
      alertId: alert.id,
      subjectLabel: alert.subjectLabel,
      conditionType: alert.conditionType,
      message: result.message,
      triggeredAt: now.toISOString()
    });

    await realtimeBus.publish({
      type: "alert_fired",
      userId: alert.userId,
      alertId: alert.id,
      subjectLabel: alert.subjectLabel,
      message: result.message,
      at: now.toISOString()
    });

    fired += 1;
  }

  return { fired, evaluated: alerts.length };
}
