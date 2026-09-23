import { test, expect } from "@playwright/test";
import { getSampleOutcomeId } from "./helpers";

test("tracker: manually add a bet and settle it as won", async ({ page }) => {
  const eventLabel = `E2E Test Event ${Date.now()}`;

  await page.goto("/tracker");
  await page.getByRole("button", { name: "Add a bet manually" }).click();
  await page.getByLabel("Event").fill(eventLabel);
  await page.getByLabel("Selection").fill("Test selection");
  await page.getByRole("button", { name: "Save bet" }).click();

  const row = page.getByRole("row", { name: new RegExp(eventLabel) });
  await expect(row).toBeVisible();
  await expect(row.getByText("open", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "won" }).click();
  await expect(row.getByText("Settled")).toBeVisible();
  await expect(row.getByText("won", { exact: true })).toBeVisible();
});

test("analyzer: save an outcome to the watchlist, then remove it", async ({ page, request }) => {
  const outcomeId = await getSampleOutcomeId(request);
  await page.goto(`/analyzer/${outcomeId}`);

  const saveButton = page.getByRole("button", { name: "Save to watchlist" });
  const removeButton = page.getByRole("button", { name: "Remove from watchlist" });

  // Normalize to "not saved" in case a previous run left it saved.
  if (await removeButton.isVisible()) {
    await removeButton.click();
    await expect(saveButton).toBeVisible();
  }

  await saveButton.click();
  await expect(removeButton).toBeVisible();

  await removeButton.click();
  await expect(saveButton).toBeVisible();
});

test("alerts: create an alert from the Alerts page form", async ({ page }) => {
  const subjectLabel = `E2E Test Alert ${Date.now()}`;

  await page.goto("/alerts");
  await page.getByRole("button", { name: "Create alert" }).click();
  await page.getByLabel("What to watch").fill(subjectLabel);
  await page.getByRole("button", { name: "Save alert" }).click();

  await expect(page.getByText(subjectLabel)).toBeVisible();
});
