import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { testUsers } from './fixtures.mts';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storageDir = path.join(__dirname, '../storage');
const verbose = process.env.PLAYWRIGHT_VERBOSE === '1';
const log = (...args: unknown[]) => {
  if (verbose) console.log(...args);
};

for (const [key, user] of Object.entries(testUsers)) {
  test(`@${key} login and save storage`, async ({ page }) => {
    log(`Testing login for ${key} with email: ${user.email}`);

    await page.goto('/auth/login', { waitUntil: 'networkidle' });
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.click('button[type="submit"]');

    // дождаться редиректа на дашборд (может быть /dashboard, /dashboard-admin или /dashboard-mod)
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    // сохранить состояние аутентификации
    await page
      .context()
      .storageState({ path: path.join(storageDir, `${key}-auth.json`) });

    log(`Successfully logged in as ${key} (${user.email})`);
  });
}
