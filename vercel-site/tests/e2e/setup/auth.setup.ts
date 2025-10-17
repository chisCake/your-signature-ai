import { test } from '@playwright/test';
import path from 'path';
import { testUsers } from './fixtures';

const storageDir = path.join(__dirname, '../storage');

for (const [key, user] of Object.entries(testUsers)) {
  test(`@${key} login and save storage`, async ({ page }) => {
    console.error(`Testing login for ${key} with email: ${user.email}`);
    
    await page.goto('/auth/login');
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.click('button[type="submit"]');

    // дождаться редиректа на базовый дашборд
    await page.waitForURL('/dashboard');

    // сохранить состояние аутентификации
    await page.context().storageState({ path: path.join(storageDir, `${key}-auth.json`) });
    
    console.error(`Successfully logged in as ${key} (${user.email})`);
  });
}
