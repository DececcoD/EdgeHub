const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const pageA = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageB = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await pageA.goto("http://localhost:3000/alerts", { waitUntil: "networkidle" });
  await pageB.goto("http://localhost:3000/alerts", { waitUntil: "networkidle" });
  await pageA.waitForSelector("text=Live", { timeout: 10000 });
  await pageB.waitForSelector("text=Live", { timeout: 10000 });
  console.log("BOTH_TABS_LIVE -> ok");

  // Grab a real outcomeId from the running app (mirrors what the Analyzer's
  // "Create alert" link would pass in, just done via fetch here).
  const outcomeId = await pageA.evaluate(async () => {
    const res = await fetch("/api/v1/opportunities");
    const json = await res.json();
    return json.data[0].outcomeId;
  });
  console.log("USING_OUTCOME_ID:", outcomeId);

  // Create a test alert with quiet hours disabled (start === end - the API
  // already supports this override, the UI form just never exposes it) so
  // this test isn't at the mercy of what the real wall-clock hour happens
  // to be right now.
  const created = await pageA.evaluate(async (subjectId) => {
    const res = await fetch("/api/v1/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectLabel: "Live smoke test alert",
        subjectType: "outcome",
        subjectId,
        conditionType: "edge_threshold",
        threshold: -100, // guaranteed true, isolates this test to the push path itself
        channel: "in_app",
        quietHoursStart: "00:00",
        quietHoursEnd: "00:00",
        cooldownSeconds: 0
      })
    });
    return res.json();
  }, outcomeId);
  console.log("CREATED_ALERT:", created.data?.id);

  // Trigger a tick from page A - page B is never touched again after this.
  await pageA.evaluate(() => fetch("/api/v1/simulate-tick", { method: "POST" }));
  console.log("TRIGGERED_TICK");

  // Give the SSE push + toast render time on page B, with zero interaction there.
  await pageB.waitForSelector("text=Live smoke test alert", { timeout: 8000 });
  console.log("TOAST_APPEARED_ON_UNTOUCHED_TAB_B -> ok");

  await pageB.screenshot({ path: ".claude/alert-toast-on-page-b.png", fullPage: false });

  // Confirm the Recent triggers panel also picked it up via router.refresh().
  await pageB.waitForSelector("text=Displayed edge reached", { timeout: 8000 });
  console.log("RECENT_TRIGGERS_PANEL_UPDATED -> ok");

  await browser.close();
})();
