const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.goto("http://localhost:3000/alerts", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Your alerts", { timeout: 15000 });
  await page.screenshot({ path: ".claude/alerts-final.png", fullPage: true });

  await page.goto("http://localhost:3000/tracker", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Bet tracker", { timeout: 15000 });
  await page.screenshot({ path: ".claude/tracker-final.png", fullPage: true });

  console.log("DONE. console errors:", JSON.stringify(errors));
  await browser.close();
})();
