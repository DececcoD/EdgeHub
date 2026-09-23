import { test, expect, type Page } from "@playwright/test";
import { getSampleOutcomeId } from "./helpers";

/**
 * Every core route should render inside its layout shell with no console
 * errors and no server error status - the cheapest possible regression
 * guard against a route that silently throws in mock mode. Not a
 * feature-level check (see the other specs for that); just "does this
 * page come up at all."
 */

async function expectCleanLoad(page: Page, route: string) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  const response = await page.goto(route);
  expect(response?.status(), `${route} returned ${response?.status()}`).toBeLessThan(400);
  await expect(page.getByRole("link", { name: "EdgeHub", exact: true }).first()).toBeVisible();
  expect(errors, `console/page errors on ${route}: ${errors.join(" | ")}`).toEqual([]);
}

const APP_ROUTES = ["/dashboard", "/markets", "/opportunities", "/tracker", "/portfolio", "/alerts", "/learn", "/account", "/admin"];

const PUBLIC_ROUTES = ["/", "/pricing", "/calculator", "/faq", "/methodology", "/responsible-use", "/privacy", "/terms", "/login", "/signup"];

test.describe("smoke: authenticated app routes", () => {
  for (const route of APP_ROUTES) {
    test(`${route} loads`, async ({ page }) => {
      await expectCleanLoad(page, route);
    });
  }

  test("/analyzer/:outcomeId loads for a real outcome", async ({ page, request }) => {
    const outcomeId = await getSampleOutcomeId(request);
    await expectCleanLoad(page, `/analyzer/${outcomeId}`);
  });

  test("/analyzer/:outcomeId 404s for a bogus outcome", async ({ page }) => {
    const response = await page.goto("/analyzer/not-a-real-outcome-id");
    expect(response?.status()).toBe(404);
  });
});

test.describe("smoke: public marketing routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} loads`, async ({ page }) => {
      await expectCleanLoad(page, route);
    });
  }
});
