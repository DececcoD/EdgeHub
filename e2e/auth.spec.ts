import { test, expect } from "@playwright/test";

/**
 * One test, one page/context, run sequentially - signup, logout, and login
 * all depend on the session cookie set by the previous step, and Playwright
 * gives every `test()` block a fresh, cookie-less context by default.
 */
test("mock auth round trip: signup -> logout -> login -> unknown email rejected", async ({ page }) => {
  const email = `e2e-${Date.now()}@edgehub.app`;

  await page.goto("/signup");
  await page.getByLabel(/I confirm I meet the applicable age/).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Set your preferences")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("One quick example")).toBeVisible();
  await page.getByRole("button", { name: "Go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(`never-signed-up-${Date.now()}@edgehub.app`);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/No account found for that email/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
