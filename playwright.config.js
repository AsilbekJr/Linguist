import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright konfiguratsiyasi.
 *
 * Ilgari `e2e/smoke.spec.js` bor edi, lekin config ham, @playwright/test ham
 * yo'q edi — ya'ni bu test hech qachon ishlamagan va "testlar bor" degan
 * yolg'on taassurot berardi. Endi config bor; paketni o'rnatgandan keyin
 * `npx playwright test` ishlaydi.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Auditoriya asosan mobil — mobil viewport ham tekshiriladi
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
