import { test, expect } from "@playwright/test";

/**
 * lib/auth/require-admin.ts gates /admin on session.role === "admin" - the
 * seeded demo account is the one mock-mode account with that role; every
 * freshly signed-up account defaults to "user" and should get a real 404,
 * not just a hidden link (DECISIONS.md's 2026-09-22 RBAC note).
 */

test("the seeded demo account (role=admin) reaches the admin console", async ({ page }) => {
  // No session cookie at all -> mock mode's demo-account fallback, which is admin.
  await page.goto("/admin");
  await expect(page.getByText("Provider health")).toBeVisible();
  await expect(page.getByText("Mapping review queue")).toBeVisible();
});

test("a freshly signed-up account (role=user) gets a real 404, not a redirect", async ({ page }) => {
  const email = `e2e-nonadmin-${Date.now()}@edgehub.app`;

  await page.goto("/signup");
  await page.getByLabel(/I confirm I meet the applicable age/).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Provider health")).not.toBeVisible();
});
