import { test, expect } from '@playwright/test';
import { getAuthTokenName } from '../../utils';

test.describe('User dashboard', () => {
  test('opens dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('logout works', async ({ page, context }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL('/auth/login');

    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === getAuthTokenName())).toBeUndefined();
  });
});

