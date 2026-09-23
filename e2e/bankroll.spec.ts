import { test, expect } from "@playwright/test";
import { getSampleOutcomeId } from "./helpers";

/**
 * One test, one page - the Account form and the Analyzer suggestion panel
 * both read the same server-side bankroll state, so this walks all three
 * states (none -> set with sizing off -> sizing on) in sequence rather than
 * fighting over shared mock state across parallel tests.
 */
test("bankroll: set on Account, see the gated suggestion appear on Analyzer", async ({ page, request }) => {
  const outcomeId = await getSampleOutcomeId(request);

  // Start clean regardless of what a previous run left behind.
  await page.goto("/account");
  const removeButton = page.getByRole("button", { name: "Remove bankroll" });
  if (await removeButton.isVisible()) {
    await removeButton.click();
    await page.waitForLoadState("networkidle");
  }

  await page.goto(`/analyzer/${outcomeId}`);
  await expect(page.getByText("Set up a bankroll in")).toBeVisible();

  await page.goto("/account");
  await page.getByLabel("Starting bankroll ($)").fill("1000");
  await page.getByRole("button", { name: "Save bankroll" }).click();
  await expect(page.getByRole("button", { name: "Remove bankroll" })).toBeVisible();

  await page.goto(`/analyzer/${outcomeId}`);
  await expect(page.getByText("Stake sizing is turned off")).toBeVisible();

  await page.goto("/account");
  await page.getByLabel(/Show a suggested stake size/).check();
  await page.getByRole("button", { name: "Save bankroll" }).click();

  await page.goto(`/analyzer/${outcomeId}`);
  const stakePanel = page.locator("section", { has: page.getByText("Suggested stake size") });
  const noEdge = stakePanel.getByText("No positive edge detected");
  const suggestion = stakePanel.getByText("Full Kelly");

  await expect(noEdge.or(suggestion)).toBeVisible();

  // Clean up so a re-run starts from the same "no bankroll" state.
  await page.goto("/account");
  await page.getByRole("button", { name: "Remove bankroll" }).click();
  await expect(page.getByRole("button", { name: "Save bankroll" })).toBeVisible();
});
