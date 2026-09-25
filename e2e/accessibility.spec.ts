import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { getSampleOutcomeId } from "./helpers";

/**
 * Formalizes the manual QA pass (DECISIONS.md, 2026-09-22) into a permanent
 * regression guard: axe-core against WCAG 2.0/2.1/2.2 AA across the same
 * routes that pass found and fixed one real violation class in (color-
 * contrast on the signal/caution/risk/info accent palette, fixed via
 * -text variants - see tailwind.config.ts).
 */
const STATIC_ROUTES = [
  "/",
  "/pricing",
  "/calculator",
  "/faq",
  "/methodology",
  "/responsible-use",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/dashboard",
  "/markets",
  "/opportunities",
  "/predictions",
  "/tracker",
  "/portfolio",
  "/alerts",
  "/learn",
  "/account",
  "/admin"
];

for (const route of STATIC_ROUTES) {
  test(`axe: ${route} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("axe: /analyzer/:outcomeId has no WCAG 2.2 AA violations", async ({ page, request }) => {
  const outcomeId = await getSampleOutcomeId(request);
  await page.goto(`/analyzer/${outcomeId}`);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
