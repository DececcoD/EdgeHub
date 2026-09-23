const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`[console] ${msg.text()}`); });
  page.on("response", (res) => { if (res.status() >= 400) errors.push(`[http ${res.status()}] ${res.url()}`); });

  await page.goto("http://localhost:3000/account", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Plan and billing", { timeout: 15000 });
  console.log("LOADED /account -> ok");

  // Mock mode: subtitle should still say "Mock billing", no "Manage billing" button.
  const subtitleText = await page.locator("text=Mock billing for this prototype").count();
  console.log("MOCK_SUBTITLE_PRESENT:", subtitleText > 0);
  const manageBillingCount = await page.locator("button", { hasText: "Manage billing" }).count();
  console.log("MANAGE_BILLING_BUTTON_COUNT (expect 0 in mock mode):", manageBillingCount);

  await page.screenshot({ path: ".claude/billing-1-account-mock.png", fullPage: true });

// Returns the button text inside whichever plan card contains `label` (e.g. "Elite").
async function planCardButtonText(page, label) {
  return page.evaluate((lbl) => {
    const p = [...document.querySelectorAll("p")].find((el) => el.textContent === lbl);
    const card = p?.closest("div");
    return card?.querySelector("button")?.textContent ?? null;
  }, label);
}

  // Switch to Elite via the existing mock PATCH path - should still work exactly as before.
  await page.locator("button", { hasText: "Switch to Elite" }).click();
  await page.waitForFunction(
    () => {
      const p = [...document.querySelectorAll("p")].find((el) => el.textContent === "Elite");
      return p?.closest("div")?.querySelector("button")?.textContent === "Current plan";
    },
    { timeout: 15000 }
  );
  await page.screenshot({ path: ".claude/billing-2-account-elite.png", fullPage: true });
  console.log("SWITCHED_TO_ELITE -> ok, Elite card button:", await planCardButtonText(page, "Elite"));
  console.log("Pro card button now:", await planCardButtonText(page, "Pro"));

  // Switch back to Pro to leave the demo user in its original state.
  await page.locator("button", { hasText: "Switch to Pro" }).click();
  await page.waitForFunction(
    () => {
      const p = [...document.querySelectorAll("p")].find((el) => el.textContent === "Pro");
      return p?.closest("div")?.querySelector("button")?.textContent === "Current plan";
    },
    { timeout: 15000 }
  );
  console.log("SWITCHED_BACK_TO_PRO -> ok");

  console.log("ALL_ERRORS:", JSON.stringify(errors));
  await browser.close();
})();
