import { test, expect } from '@playwright/test';
import { getAuthTokenName } from '../../utils';

test.describe('Admin dashboard', () => {
  test('opens admin dashboard', async ({ page }) => {
    await page.goto('/dashboard-admin');
    await expect(page).toHaveURL('/dashboard-admin');
  });

  test('logout works', async ({ page, context }) => {
    await page.goto('/dashboard-admin');
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL('/auth/login');
    const cookies = await context.cookies();
    expect(cookies.some(c => c.name === getAuthTokenName())).toBeFalsy();
  });
});

