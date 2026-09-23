const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto("http://localhost:3000/alerts", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Live", { timeout: 10000 });
  console.log("PAGE_LOADED_SSE_MODULE_SHOULD_BE_LOADED");

  const outcomeId = await page.evaluate(async () => {
    const res = await fetch("/api/v1/opportunities");
    const json = await res.json();
    return json.data[0].outcomeId;
  });

  const created = await page.evaluate(async (subjectId) => {
    const res = await fetch("/api/v1/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectLabel: "Cross-process Redis test alert",
        subjectType: "outcome",
        subjectId,
        conditionType: "edge_threshold",
        threshold: -100,
        channel: "in_app",
        quietHoursStart: "00:00",
        quietHoursEnd: "00:00",
        cooldownSeconds: 0
      })
    });
    return res.json();
  }, outcomeId);
  console.log("CREATED_ALERT:", created.data?.id);

  console.log("WAITING_FOR_EXTERNAL_PUBLISH...");
  // The external publish (a genuinely separate Node process, simulating
  // the ingestion CLI) happens from the bash side, not from this script.
  await page.waitForSelector("text=Cross-process Redis test alert", { timeout: 15000 });
  console.log("TOAST_APPEARED_FROM_REMOTE_TICK -> ok");

  await browser.close();
})();
