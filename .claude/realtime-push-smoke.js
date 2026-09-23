const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  const pageA = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageB = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errorsA = [];
  const errorsB = [];
  pageA.on("console", (msg) => { if (msg.type() === "error") errorsA.push(msg.text()); });
  pageB.on("console", (msg) => { if (msg.type() === "error") errorsB.push(msg.text()); });

  await pageA.goto("http://localhost:3000/markets", { waitUntil: "networkidle" });
  await pageB.goto("http://localhost:3000/markets", { waitUntil: "networkidle" });

  // Confirm both tabs' LiveIndicator reached the "Live" SSE-connected state.
  await pageA.waitForSelector("text=Live", { timeout: 10000 });
  await pageB.waitForSelector("text=Live", { timeout: 10000 });
  console.log("BOTH_TABS_LIVE -> ok");

  // Track requests page B makes AFTER this point - if router.refresh() fires
  // on page B without any interaction there, it will issue a new RSC fetch
  // to the current URL.
  let pageBRefetchedAfterTick = false;
  const tickTime = Date.now();
  pageB.on("request", (req) => {
    if (Date.now() > tickTime && req.url().includes("/markets")) {
      pageBRefetchedAfterTick = true;
    }
  });

  // Click the tick button ONLY on page A.
  await pageA.locator("button", { hasText: "Simulate market tick" }).click();
  console.log("CLICKED_TICK_ON_PAGE_A");

  // Give the SSE push + page B's router.refresh() time to happen - page B
  // is never touched from here on.
  await pageB.waitForTimeout(3000);

  console.log("PAGE_B_AUTO_REFETCHED_WITHOUT_INTERACTION:", pageBRefetchedAfterTick);

  await pageA.screenshot({ path: ".claude/realtime-page-a-after-tick.png", fullPage: false });
  await pageB.screenshot({ path: ".claude/realtime-page-b-auto-updated.png", fullPage: false });

  console.log("ERRORS_A:", JSON.stringify(errorsA));
  console.log("ERRORS_B:", JSON.stringify(errorsB));

  await browser.close();
})();
