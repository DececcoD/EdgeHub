const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const cspViolations = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      consoleErrors.push(text);
      if (text.toLowerCase().includes("content security policy") || text.toLowerCase().includes("csp")) {
        cspViolations.push(text);
      }
    }
  });

  const pages = ["/", "/pricing", "/login", "/signup", "/dashboard", "/markets", "/opportunities", "/analyzer", "/tracker", "/portfolio", "/alerts", "/learn", "/account", "/admin", "/calculator"];
  for (const path of pages) {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
  }
  console.log("ALL_PAGES_LOADED_OK");

  // Exercise real interactivity: client components, forms, buttons.
  await page.goto("http://localhost:3000/markets", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Live", { timeout: 10000 });
  console.log("LIVE_INDICATOR_SSE_CONNECTED_OK");

  await page.locator("button", { hasText: "Simulate market tick" }).click();
  await page.waitForTimeout(1500);
  console.log("TICK_BUTTON_CLICKED_OK");

  await page.goto("http://localhost:3000/calculator", { waitUntil: "networkidle" });
  await page.fill('input[type="number"]', "150");
  console.log("CALCULATOR_INPUT_FILLED_OK");

  await page.goto("http://localhost:3000/account", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Plan and billing", { timeout: 10000 });
  console.log("ACCOUNT_PAGE_RENDERED_OK");

  console.log("CSP_VIOLATIONS:", JSON.stringify(cspViolations));
  console.log("ALL_CONSOLE_ERRORS:", JSON.stringify(consoleErrors));

  await browser.close();
})();
