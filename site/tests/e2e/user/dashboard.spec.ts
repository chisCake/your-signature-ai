import { test, expect } from '@playwright/test';
import { getAuthTokenName } from '@/tests/utils';

test.describe('User dashboard', () => {
  test('opens dashboard page', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('logout works', async ({ page, context }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('/auth/login', { timeout: 10000 });
    await expect(page).toHaveURL('/auth/login');

    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === getAuthTokenName())).toBeUndefined();
  });
});
