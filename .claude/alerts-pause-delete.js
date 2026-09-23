const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`[console] ${msg.text()}`); });
  page.on("response", (res) => { if (res.status() >= 400) errors.push(`[http ${res.status()}] ${res.url()}`); });

  await page.goto("http://localhost:3000/alerts", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Smoke Test Alert - Chiefs @ 49ers", { timeout: 15000 });

  // Resume the already-paused smoke test alert (status is lowercase "paused" in the DOM).
  const smokeRow = page.locator("li", { hasText: "Smoke Test Alert - Chiefs @ 49ers" });
  await smokeRow.locator("button", { hasText: "Resume" }).click();
  await page.waitForFunction(
    () => {
      const li = [...document.querySelectorAll("li")].find((el) => el.textContent.includes("Smoke Test Alert"));
      return li && li.textContent.includes("active");
    },
    { timeout: 15000 }
  );
  await page.screenshot({ path: ".claude/alerts-4-resumed.png", fullPage: true });
  console.log("SHOT alerts (resumed) -> ok");

  // Delete a seeded alert.
  const seededRow = page.locator("li", { hasText: "Lions @ Packers" });
  await seededRow.locator("button", { hasText: "Delete" }).click();
  await page.waitForFunction(() => !document.body.textContent.includes("Lions @ Packers"), { timeout: 15000 });
  await page.screenshot({ path: ".claude/alerts-5-deleted.png", fullPage: true });
  console.log("SHOT alerts (seeded alert deleted) -> ok");

  console.log("ALL_ERRORS:", JSON.stringify(errors));
  await browser.close();
})();
