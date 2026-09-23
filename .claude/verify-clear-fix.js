const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 300 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.goto("http://localhost:3000/markets?league=nfl&q=Ravens", { waitUntil: "networkidle" });
  await page.waitForSelector('input[aria-label="Search teams or events"]');
  const beforeClear = await page.inputValue('input[aria-label="Search teams or events"]');

  await page.click('button:has-text("Clear")');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  const afterClear = await page.inputValue('input[aria-label="Search teams or events"]');

  await page.screenshot({ path: ".claude/filter-clear-fix.png" });
  console.log("before clear:", JSON.stringify(beforeClear));
  console.log("after clear:", JSON.stringify(afterClear));
  console.log("FIXED:", afterClear === "");
  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})();
