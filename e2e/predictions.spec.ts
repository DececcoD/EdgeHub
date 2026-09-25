import { test, expect } from "@playwright/test";

test("prediction markets: matched/unmatched sections render real fixture data", async ({ page }) => {
  await page.goto("/predictions");
  await expect(page.getByText("Fed cuts rates below 4.50% by December")).toBeVisible();
  await expect(page.getByText("Government shutdown occurs before year end")).toBeVisible();
});

test("prediction portfolio: manually add a position and settle it as won", async ({ page }) => {
  const marketTitle = `E2E Test Market ${Date.now()}`;

  await page.goto("/predictions");
  await page.getByRole("button", { name: "Add a position manually" }).click();
  await page.getByLabel("Market", { exact: true }).fill(marketTitle);
  await page.getByLabel("Market ID (from the provider)").fill(`E2E-${Date.now()}`);
  await page.getByRole("button", { name: "Save position" }).click();

  const row = page.getByRole("row", { name: new RegExp(marketTitle) });
  await expect(row).toBeVisible();
  await expect(row.getByText("open", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "won" }).click();
  await expect(row.getByText("Settled")).toBeVisible();
  await expect(row.getByText("won", { exact: true })).toBeVisible();
});
