import { test, expect } from '@playwright/test';

/**
 * Brauzer smoke testlari.
 *
 * Ishga tushirish:
 *   npm i -D @playwright/test && npx playwright install chromium
 *   cd server && npm run dev        (:5000)
 *   cd client && npm run dev        (:5173)
 *   npx playwright test
 *
 * Diqqat: bu testlar server mantiqini tekshirmaydi — buning uchun
 * `server/tests/` da 58 ta test bor va ular hech qanday brauzer talab qilmaydi.
 * Bu yerda faqat sahifalar ochilishi va marshrutlash tekshiriladi.
 */

test.describe('Linguist smoke', () => {
  test('kirish sahifasi ochiladi', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Xush kelibsiz/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByPlaceholder(/Email manzilingiz/i)).toBeVisible();
  });

  test('parolni tiklash sahifasiga o\'tish mumkin', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Parolni unutdingizmi/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: /Parolni unutdingizmi/i })).toBeVisible();
  });

  test('tiklash havolasi tokensiz ochilsa ogohlantiradi', async ({ page }) => {
    // Pochtadagi havola noto'g'ri nusxalanganda shu holat yuzaga keladi
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: /Havola to'liq emas/i })).toBeVisible();
  });

  test('ro\'yxatdan o\'tish sahifasi ochiladi', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('button', { name: /Ro'yxatdan|Sign up|Create/i })).toBeVisible();
  });
});
