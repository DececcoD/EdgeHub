const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  // Demo user (mock-mode admin) - no signup, relies on getSessionOrDemo()'s fallback.
  const demoPage = await browser.newPage();
  const demoRes = await demoPage.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  console.log("DEMO_ADMIN_STATUS:", demoRes.status());
  const demoHasPanel = (await demoPage.locator("text=Provider health").count()) > 0;
  console.log("DEMO_SEES_ADMIN_PANEL:", demoHasPanel);

  // A brand-new signed-up user - role defaults to "user", should be blocked.
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();

  const signupRes = await freshPage.request.post("http://localhost:3000/api/auth/signup", {
    data: { email: `rbac-smoke-${Date.now()}@example.com` }
  });
  console.log("SIGNUP_STATUS:", signupRes.status());
  const cookies = await freshContext.cookies();
  const sessionCookie = cookies.find((c) => c.name === "eh_session");
  console.log("GOT_SESSION_COOKIE:", Boolean(sessionCookie));

  const blockedRes = await freshPage.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  console.log("FRESH_USER_ADMIN_STATUS:", blockedRes.status());
  const blockedText = await freshPage.locator("body").innerText();
  console.log("FRESH_USER_SEES_404:", blockedText.includes("404") || blockedText.toLowerCase().includes("not found"));

  await browser.close();
})();
