const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Establish a real session first (as the demo user, via the mock cookie fallback).
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });

  async function req(method, url, body) {
    return page.evaluate(
      async ({ method, url, body }) => {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body !== undefined ? JSON.stringify(body) : undefined
        });
        const json = await res.json().catch(() => null);
        return { status: res.status, json };
      },
      { method, url, body }
    );
  }

  const results = {};

  // Preferences - exact shape preferences-form.tsx sends (full UserPreferences object, including onboardedAt).
  results.preferences = await req("PATCH", "/api/v1/account/preferences", {
    oddsFormat: "decimal",
    favoriteLeagues: ["nfl", "nba"],
    favoriteBooks: ["fanduel"],
    timezone: "America/New_York",
    onboardedAt: new Date().toISOString()
  });

  // Alerts - exact shape create-alert-form.tsx sends.
  const oppRes = await req("GET", "/api/v1/opportunities");
  const outcomeId = oppRes.json?.data?.[0]?.outcomeId;
  results.createAlert = await req("POST", "/api/v1/alerts", {
    subjectLabel: "Zod smoke test alert",
    subjectId: outcomeId,
    conditionType: "edge_threshold",
    threshold: 3,
    channel: "in_app",
    subjectType: "outcome"
  });
  const alertId = results.createAlert.json?.data?.id;
  if (alertId) {
    results.pauseAlert = await req("PATCH", `/api/v1/alerts/${alertId}`, { status: "paused" });
    results.deleteAlert = await req("DELETE", `/api/v1/alerts/${alertId}`);
  }

  // Tracker - exact shape create-bet-form.tsx sends.
  results.createBet = await req("POST", "/api/v1/tracker", {
    eventId: `manual_${Date.now()}`,
    eventLabel: "Zod Smoke Test Event",
    leagueKey: "nfl",
    marketType: "moneyline",
    selectionLabel: "Home Team",
    sportsbookKey: "fanduel",
    oddsAmerican: -110,
    stakeAmount: 25
  });
  const betId = results.createBet.json?.data?.id;
  if (betId) {
    results.settleBet = await req("PATCH", `/api/v1/tracker/${betId}`, { status: "won" });
  }

  // Watchlist - exact shape.
  if (outcomeId) {
    results.addWatchlist = await req("POST", "/api/v1/watchlist", { outcomeId });
    results.removeWatchlist = await req("DELETE", "/api/v1/watchlist", { outcomeId });
  }

  // CSV import.
  results.csvImport = await req("POST", "/api/v1/tracker/import", {
    csv: "eventLabel,leagueKey,marketType,selectionLabel,sportsbookKey,oddsAmerican,stakeAmount,placedAt\nZod Import Test,nfl,moneyline,Home,fanduel,-110,10,2026-09-01T12:00:00.000Z"
  });

  // Now confirm INVALID payloads are correctly rejected (proving validation is real, not a no-op).
  results.invalidAlertCondition = await req("POST", "/api/v1/alerts", {
    subjectLabel: "Bad",
    subjectType: "outcome",
    conditionType: "not_a_real_condition",
    threshold: 3
  });
  results.invalidPreferencesLeague = await req("PATCH", "/api/v1/account/preferences", {
    favoriteLeagues: ["not_a_real_league"]
  });
  results.invalidBetOdds = await req("POST", "/api/v1/tracker", {
    eventId: "x", eventLabel: "x", leagueKey: "nfl", marketType: "moneyline",
    selectionLabel: "x", sportsbookKey: "fanduel", oddsAmerican: 0, stakeAmount: 10
  });

  for (const [name, r] of Object.entries(results)) {
    console.log(`${name}: ${r.status}`);
  }

  const failures = Object.entries(results).filter(([name, r]) => {
    const shouldSucceed = !name.startsWith("invalid");
    return shouldSucceed ? r.status >= 400 : r.status < 400;
  });
  console.log("UNEXPECTED_RESULTS:", JSON.stringify(failures.map(([name, r]) => ({ name, status: r.status, json: r.json }))));

  await browser.close();
})();
