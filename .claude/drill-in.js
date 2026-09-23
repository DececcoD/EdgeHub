const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto("http://localhost:3000/opportunities", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Opportunity Finder", { timeout: 15000 });

  const firstLink = page.locator("table tbody tr td a").first();
  await firstLink.click();
  await page.waitForSelector("text=Current book prices", { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".claude/opportunities-4-into-analyzer.png", fullPage: true });

  console.log("SCREENSHOT_OK");
  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})();
