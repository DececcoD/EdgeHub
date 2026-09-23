const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Top opportunities", { timeout: 15000 });
  await page.screenshot({ path: ".claude/dashboard.png", fullPage: true });

  console.log("SCREENSHOT_OK");
  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));

  await browser.close();
})();
