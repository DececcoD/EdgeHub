const { chromium } = require("playwright");

async function shot(page, path, label, errors) {
  await page.screenshot({ path, fullPage: true });
  console.log(`SHOT ${label} -> ${path} | errors so far: ${errors.length}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${String(err)}`));
  page.on("response", (res) => {
    if (res.status() >= 400) errors.push(`[http ${res.status()}] ${res.url()}`);
  });

  // --- Markets ---
  await page.goto("http://localhost:3000/markets", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Markets", { timeout: 15000 });
  await shot(page, ".claude/markets-1-all.png", "markets (unfiltered)", errors);

  // Filter to NFL
  await page.selectOption('select[aria-label="League"]', "nfl");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await shot(page, ".claude/markets-2-nfl.png", "markets (NFL filter)", errors);

  // Search a team
  await page.fill('input[aria-label="Search teams or events"]', "Ravens");
  await page.click('button:has-text("Search")');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await shot(page, ".claude/markets-3-search.png", "markets (search Ravens)", errors);

  // Clear filters, then simulate a market tick and see it reflect
  await page.click('button:has-text("Clear")');
  await page.waitForLoadState("networkidle");
  await page.click('button:has-text("Simulate market tick")');
  await page.waitForTimeout(1200); // let tick-flash animation play + router.refresh
  await shot(page, ".claude/markets-4-tick.png", "markets (after simulated tick)", errors);

  // --- Opportunities ---
  await page.goto("http://localhost:3000/opportunities", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Opportunity Finder", { timeout: 15000 });
  await shot(page, ".claude/opportunities-1-all.png", "opportunities (unfiltered)", errors);

  await page.selectOption('select[aria-label="Minimum edge"]', "2");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await shot(page, ".claude/opportunities-2-minedge.png", "opportunities (edge >= 2pp)", errors);

  await page.selectOption('select[aria-label="League"]', "nba");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await shot(page, ".claude/opportunities-3-nba-minedge.png", "opportunities (NBA + edge >= 2pp)", errors);

  // Click into the first row's matchup link -> Analyzer, to prove the row->detail path works
  const firstLink = page.locator("table tbody tr td a").first();
  const hasRow = (await firstLink.count()) > 0;
  if (hasRow) {
    await firstLink.click();
    await page.waitForSelector("text=Current book prices", { timeout: 15000 });
    await shot(page, ".claude/opportunities-4-into-analyzer.png", "clicked into analyzer from opportunities row", errors);
  } else {
    console.log("No opportunity rows matched NBA + edge>=2pp filter combo - skipping drill-in shot");
  }

  console.log("ALL_ERRORS:", JSON.stringify(errors, null, 2));
  await browser.close();
})();
