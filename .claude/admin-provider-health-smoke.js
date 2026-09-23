const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`[console] ${msg.text()}`); });
  page.on("response", (res) => { if (res.status() >= 400) errors.push(`[http ${res.status()}] ${res.url()}`); });

  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Provider health", { timeout: 15000 });
  console.log("LOADED /admin -> ok");

  const rowText = await page.locator("table").nth(0).innerText();
  console.log("PROVIDER_HEALTH_TABLE:\n", rowText);

  await page.screenshot({ path: ".claude/admin-provider-health.png", fullPage: true });
  console.log("ALL_ERRORS:", JSON.stringify(errors));
  await browser.close();
})();
