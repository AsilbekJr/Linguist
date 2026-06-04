/**
 * Smoke test — run with: npx playwright test (after npm install -D @playwright/test)
 * Requires client on :5173 and server on :5000 with valid test user.
 */
import { test, expect } from '@playwright/test';

test.describe('Linguist smoke', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Welcome Back|Log In/i)).toBeVisible({ timeout: 10000 });
  });
});
