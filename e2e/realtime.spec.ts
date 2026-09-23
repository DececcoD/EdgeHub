import { test, expect } from "@playwright/test";
import { getSampleOutcomeId } from "./helpers";

/**
 * Locks in the two cross-tab regressions this session found and fixed by
 * hand each time (real-time push, then cross-process alert evaluation) as
 * permanent, repeatable tests instead of one-off manual Playwright runs.
 * Only exercises the default in-process bus - the Redis cross-process path
 * (lib/realtime/bus.ts's RedisBus) needs a running Redis instance CI
 * doesn't have, and was already verified manually; see DECISIONS.md.
 */

test("tick propagation: Simulate market tick on one tab flashes another, untouched tab", async ({ browser }) => {
  const context = await browser.newContext();
  const tabA = await context.newPage();
  const tabB = await context.newPage();

  await tabA.goto("/markets");
  await tabB.goto("/markets");
  await expect(tabA.getByText("Live", { exact: true })).toBeVisible();
  await expect(tabB.getByText("Live", { exact: true })).toBeVisible();

  const dotB = tabB.locator('[title="Real-time odds push connection"] span').first();

  await tabA.getByRole("button", { name: "Simulate market tick" }).click();
  await expect(dotB).toHaveClass(/animate-tick-up/, { timeout: 5000 });

  await context.close();
});

test("alert firing: a tick on one tab shows a live toast on another tab", async ({ browser, request }) => {
  const outcomeId = await getSampleOutcomeId(request);

  const context = await browser.newContext();
  const tabA = await context.newPage();
  const tabB = await context.newPage();

  await tabA.goto("/markets");
  await tabB.goto("/dashboard");
  await expect(tabB.getByText("Live", { exact: true })).toBeVisible();

  // Quiet hours disabled (start === end) and cooldown 0, per lib/alerts/
  // evaluate.ts, so this fires on the very next tick deterministically -
  // not dependent on the wall-clock time the suite happens to run at.
  const alertRes = await context.request.post("/api/v1/alerts", {
    data: {
      subjectLabel: `E2E realtime alert ${Date.now()}`,
      subjectType: "outcome",
      subjectId: outcomeId,
      conditionType: "edge_threshold",
      threshold: -1000,
      channel: "in_app",
      quietHoursStart: "00:00",
      quietHoursEnd: "00:00",
      cooldownSeconds: 0
    }
  });
  expect(alertRes.ok()).toBeTruthy();

  await tabA.getByRole("button", { name: "Simulate market tick" }).click();
  await expect(tabB.getByRole("status")).toBeVisible({ timeout: 5000 });

  await context.close();
});
