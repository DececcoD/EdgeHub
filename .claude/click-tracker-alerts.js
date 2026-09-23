const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function shot(page, file, label, errors) {
  await page.screenshot({ path: file, fullPage: true });
  console.log(`SHOT ${label} -> ${file} | errors so far: ${errors.length}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`[console] ${msg.text()}`); });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${String(err)}`));
  page.on("response", (res) => { if (res.status() >= 400) errors.push(`[http ${res.status()}] ${res.url()}`); });

  // ===================== TRACKER =====================
  await page.goto("http://localhost:3000/tracker", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Bet tracker", { timeout: 15000 });
  await shot(page, ".claude/tracker-1-initial.png", "tracker (seeded state)", errors);

  await page.click('button:has-text("Add a bet manually")');
  const betForm = page.locator("form", { hasText: "Selection" });
  await betForm.locator("label:has-text('Event') input").fill("Smoke Test Event - Chiefs @ Ravens");
  await betForm.locator("label:has-text('League') select").selectOption("nfl");
  await betForm.locator("label:has-text('Market') select").selectOption("spread");
  await betForm.locator("label:has-text('Selection') input").fill("Ravens -3.5");
  await betForm.locator("label:has-text('Sportsbook') select").selectOption("caesars");
  await betForm.locator("label:has-text('Odds (American)') input").fill("-105");
  await betForm.locator("label:has-text('Stake ($)') input").fill("15");
  await shot(page, ".claude/tracker-2-form-filled.png", "tracker (manual form filled)", errors);

  await betForm.locator('button[type="submit"]:has-text("Save bet")').click();
  // Wait for the actual new row, not just "networkidle" - avoids screenshotting mid-save.
  await page.waitForSelector("text=Smoke Test Event - Chiefs @ Ravens", { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(page, ".claude/tracker-3-after-add.png", "tracker (after manual add)", errors);

  // Settle the newly added open bet as "won" - target by substring, case-insensitive.
  const newBetRow = page.locator("tr", { hasText: "Smoke Test Event - Chiefs @ Ravens" });
  await newBetRow.locator("button", { hasText: "won" }).click();
  await page.waitForFunction(
    () => {
      const row = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Smoke Test Event"));
      return row && row.textContent.includes("Settled");
    },
    { timeout: 15000 }
  );
  await shot(page, ".claude/tracker-4-settled-won.png", "tracker (settled won)", errors);

  // CSV import: write a temp CSV and upload it.
  const csvPath = path.join(__dirname, "smoke-import.csv");
  fs.writeFileSync(
    csvPath,
    [
      "eventLabel,leagueKey,marketType,selectionLabel,sportsbookKey,placedAt,oddsAmerican,stakeAmount,notes",
      "Suns @ Lakers,nba,moneyline,Lakers,fanduel,2026-09-18T00:00:00Z,-120,20,imported",
      "Bad Row,zzz,moneyline,Lakers,fanduel,2026-09-18T00:00:00Z,-120,20,should be rejected"
    ].join("\n")
  );
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await page.waitForSelector("text=Suns @ Lakers", { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(page, ".claude/tracker-5-csv-import.png", "tracker (after CSV import)", errors);

  // ===================== ALERTS =====================
  await page.goto("http://localhost:3000/alerts", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Your alerts", { timeout: 15000 });
  await shot(page, ".claude/alerts-1-initial.png", "alerts (seeded state)", errors);

  await page.click('button:has-text("Create alert")');
  const alertForm = page.locator("form", { hasText: "What to watch" });
  await alertForm.locator("label:has-text('What to watch') input").fill("Smoke Test Alert - Chiefs @ 49ers");
  await alertForm.locator("label:has-text('Condition') select").selectOption("odds_threshold");
  await alertForm.locator("label:has-text('Threshold') input").fill("150");
  await alertForm.locator("label:has-text('Channel') select").selectOption("email");
  await shot(page, ".claude/alerts-2-form-filled.png", "alerts (create form filled)", errors);

  await alertForm.locator('button[type="submit"]:has-text("Save alert")').click();
  await page.waitForSelector("text=Smoke Test Alert - Chiefs @ 49ers", { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(page, ".claude/alerts-3-after-create.png", "alerts (after create)", errors);

  // Pause the new alert.
  const newAlertRow = page.locator("li", { hasText: "Smoke Test Alert - Chiefs @ 49ers" });
  await newAlertRow.locator("button", { hasText: "Pause" }).click();
  await page.waitForFunction(
    () => {
      const li = [...document.querySelectorAll("li")].find((el) => el.textContent.includes("Smoke Test Alert"));
      // status renders lowercase in the DOM ("paused"); CSS text-transform:uppercase
      // only affects paint, never textContent.
      return li && li.textContent.includes("paused");
    },
    { timeout: 15000 }
  );
  await shot(page, ".claude/alerts-4-paused.png", "alerts (new alert paused)", errors);

  // Delete a seeded alert to prove that control works too.
  const seededAlertRow = page.locator("li", { hasText: "Lions @ Packers" });
  await seededAlertRow.locator("button", { hasText: "Delete" }).click();
  await page.waitForFunction(() => !document.body.textContent.includes("Lions @ Packers"), { timeout: 15000 });
  await shot(page, ".claude/alerts-5-deleted.png", "alerts (seeded alert deleted)", errors);

  console.log("ALL_ERRORS:", JSON.stringify(errors, null, 2));
  await browser.close();
})();
