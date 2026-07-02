import { expect, test } from '@playwright/test';

/**
 * Happy-path E2E against a running Evenly instance (app + Postgres).
 * Covers: register → dashboard → create group → add a split expense.
 * The test registers its own throwaway user — no pre-seeded data required.
 */

test('a new user can register, create a group and add a split expense', async ({ page }) => {
  const email = `e2e+${Date.now()}@evenly.test`;

  // --- Register ---------------------------------------------------------
  await page.goto('/register');
  await page.locator('input[autocomplete="name"]').fill('Robin Tester');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="new-password"]').fill('E2e-Throwaway-Pw-1!');
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByText('Robin Tester').first()).toBeVisible();

  // --- Create a group ---------------------------------------------------
  await page.goto('/groups');
  await page.getByRole('button', { name: 'New group' }).first().click();
  await page.getByPlaceholder('e.g. Apartment, Trip to Lisbon').fill('Roadtrip E2E');
  await page.getByRole('button', { name: 'Create group' }).click();

  // The dialog navigates to the new group page.
  await page.waitForURL(/\/groups\/[a-z0-9]+/i, { timeout: 20_000 });
  const groupUrl = page.url();
  await expect(page.getByText('Roadtrip E2E').first()).toBeVisible();

  // --- Add an expense ---------------------------------------------------
  await page.goto(`${groupUrl}/expenses/new`);
  await page.getByPlaceholder('e.g. Groceries, Dinner, Taxi').fill('Fuel and snacks');
  await page.locator('input[inputmode="decimal"]').first().fill('48');
  await page.getByRole('button', { name: 'Add expense' }).click();

  // Back on the group page, the expense is listed.
  await page.waitForURL(
    (url) => url.toString().startsWith(groupUrl) && !url.toString().includes('/expenses/new'),
    {
      timeout: 20_000,
    },
  );
  await expect(page.getByText('Fuel and snacks').first()).toBeVisible({ timeout: 15_000 });
});
