import { describe, expect, it, vi } from "vitest";
import { ensureDemoUser } from "../auth/user-store";
import { listAlerts, listAlertEvents, createAlert } from "../mock/user-data";
import { listOpportunities } from "../mock/store";
import { evaluateAlerts } from "./evaluate";

const { sendAlertEmailMock } = vi.hoisted(() => ({ sendAlertEmailMock: vi.fn().mockResolvedValue(true) }));
vi.mock("../notifications/email", () => ({ sendAlertEmail: sendAlertEmailMock }));

// Fixed to noon UTC, same calendar day as the actual test run (so event
// startAt comparisons - generated relative to real Date.now() at module
// load - stay meaningful) but outside the demo alerts' default 23:00-07:00
// quiet-hours window, which the real wall clock is inside roughly a third
// of the time - exactly what made this flaky before this fix.
function daytimeNow(): Date {
  const now = new Date();
  now.setUTCHours(12, 0, 0, 0);
  return now;
}

describe("evaluateAlerts", () => {
  const demo = ensureDemoUser();

  it("fires the seeded edge_threshold alert, since its threshold is set just under the outcome's real current edge", async () => {
    const before = listAlerts(demo.userId).find((a) => a.conditionType === "edge_threshold")!;
    expect(before.status).toBe("active");
    expect(before.lastTriggeredAt).toBeNull();

    const result = await evaluateAlerts(daytimeNow());
    expect(result.fired).toBeGreaterThanOrEqual(1);

    const after = listAlerts(demo.userId).find((a) => a.id === before.id)!;
    expect(after.lastTriggeredAt).not.toBeNull();

    const events = listAlertEvents(demo.userId);
    expect(events.some((e) => e.alertId === before.id)).toBe(true);
  });

  it("expires the seeded start_reminder alert once it fires, since a start reminder is inherently one-shot", async () => {
    const before = listAlerts(demo.userId).find((a) => a.conditionType === "start_reminder");
    if (!before) return; // already expired by a prior test in this file - evaluateAlerts() is idempotent either way

    await evaluateAlerts(daytimeNow());
    const after = listAlerts(demo.userId).find((a) => a.id === before.id)!;
    expect(after.status).toBe("expired");
  });

  it("respects cooldown - does not refire the same alert on the very next tick", async () => {
    await evaluateAlerts(daytimeNow());
    const beforeSecondCall = listAlertEvents(demo.userId).length;
    await evaluateAlerts(daytimeNow());
    const afterSecondCall = listAlertEvents(demo.userId).length;
    expect(afterSecondCall).toBe(beforeSecondCall);
  });

  it("never throws for an alert whose subjectId doesn't resolve to a real outcome", async () => {
    createAlert({
      userId: demo.userId,
      subjectLabel: "Nonexistent outcome",
      subjectType: "outcome",
      subjectId: "not_a_real_outcome_id",
      conditionType: "edge_threshold",
      threshold: 0,
      channel: "in_app",
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      cooldownSeconds: 0
    });

    await expect(evaluateAlerts(daytimeNow())).resolves.toBeDefined();
  });

  it("suppresses firing during the alert owner's quiet hours without recording an event", async () => {
    createAlert({
      userId: demo.userId,
      subjectLabel: "Quiet hours test",
      subjectType: "outcome",
      subjectId: listAlerts(demo.userId).find((a) => a.conditionType === "edge_threshold")!.subjectId,
      conditionType: "edge_threshold",
      threshold: -100, // always true, isolating this test to the quiet-hours check alone
      channel: "in_app",
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      cooldownSeconds: 0
    });

    const nightTime = new Date();
    nightTime.setUTCHours(2, 0, 0, 0); // inside the 23:00-07:00 UTC window
    const eventsBefore = listAlertEvents(demo.userId).length;
    await evaluateAlerts(nightTime);
    expect(listAlertEvents(demo.userId).length).toBe(eventsBefore);
  });

  it("sends an email for a channel:'email' alert, with the user's real address and the fired message - PRD 10.2", async () => {
    sendAlertEmailMock.mockClear();
    // Not listAlerts().find(conditionType === "edge_threshold") - the
    // "never throws" test above also creates an edge_threshold alert (with
    // a deliberately bad subjectId) that gets unshift()ed ahead of the
    // real seeded one, so that lookup silently resolves to the wrong
    // alert here. Getting a real outcome straight from the opportunity
    // feed avoids depending on which alert happens to be first.
    const targetSubjectId = listOpportunities()[0]!.outcomeId;

    createAlert({
      userId: demo.userId,
      subjectLabel: "Email channel test",
      subjectType: "outcome",
      subjectId: targetSubjectId,
      conditionType: "edge_threshold",
      threshold: -100, // always true
      channel: "email",
      quietHoursStart: "00:00",
      quietHoursEnd: "00:00", // disabled - start === end
      cooldownSeconds: 0
    });

    await evaluateAlerts(daytimeNow());

    expect(sendAlertEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: demo.email, subjectLabel: "Email channel test" })
    );
  });

  it("never calls sendAlertEmail for a channel:'in_app' alert", async () => {
    sendAlertEmailMock.mockClear();
    const targetSubjectId = listOpportunities()[0]!.outcomeId;

    createAlert({
      userId: demo.userId,
      subjectLabel: "In-app channel test",
      subjectType: "outcome",
      subjectId: targetSubjectId,
      conditionType: "edge_threshold",
      threshold: -100,
      channel: "in_app",
      quietHoursStart: "00:00",
      quietHoursEnd: "00:00",
      cooldownSeconds: 0
    });

    await evaluateAlerts(daytimeNow());
    // Not .not.toHaveBeenCalled() - the previous test's own channel:"email"
    // alert has cooldownSeconds: 0 and is still active, so it legitimately
    // refires on every subsequent evaluateAlerts() call at this same fixed
    // timestamp too. This test only cares that THIS alert never triggered
    // a send, not that the mock is untouched by an unrelated sibling.
    expect(sendAlertEmailMock).not.toHaveBeenCalledWith(expect.objectContaining({ subjectLabel: "In-app channel test" }));
  });
});
