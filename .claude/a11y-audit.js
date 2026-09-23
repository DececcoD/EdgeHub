const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const STATIC_PAGES = [
  "/", "/pricing", "/faq", "/methodology", "/responsible-use", "/privacy", "/terms",
  "/calculator", "/login", "/signup",
  "/dashboard", "/markets", "/opportunities", "/analyzer", "/tracker", "/portfolio",
  "/alerts", "/learn", "/account", "/admin"
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {};

  for (const path of STATIC_PAGES) {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
    const axeResults = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    results[path] = axeResults.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      nodeCount: v.nodes.length,
      sampleHtml: v.nodes[0]?.html?.slice(0, 200)
    }));
  }

  // Dynamic analyzer page with a real outcomeId.
  const outcomeId = await page.evaluate(async () => {
    const res = await fetch("/api/v1/opportunities");
    const json = await res.json();
    return json.data[0].outcomeId;
  });
  await page.goto(`http://localhost:3000/analyzer/${outcomeId}`, { waitUntil: "networkidle" });
  const analyzerAxe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  results[`/analyzer/${outcomeId}`] = analyzerAxe.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    nodeCount: v.nodes.length,
    sampleHtml: v.nodes[0]?.html?.slice(0, 200)
  }));

  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})();
