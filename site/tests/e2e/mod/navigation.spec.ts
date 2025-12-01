import { test, expect } from '@playwright/test';
import { getAuthTokenName } from '@/tests/utils';

const routes = [
  '/dashboard-mod',
  '/signatures',
  '/users',
  '/controlled-signature-addition',
];

test.describe('Moderator navigation', () => {
  for (const route of routes) {
    test(`visits ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForURL(route, { timeout: 10000 });
      await expect(page).toHaveURL(route);
      await expect(page).toHaveTitle(/.+/); // basic assertion that page loaded
    });
  }

  test('logout', async ({ page, context }) => {
    await page.goto('/dashboard-mod', { waitUntil: 'networkidle' });
    await page.waitForURL('/dashboard-mod', { timeout: 10000 });
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('/auth/login', { timeout: 10000 });
    await expect(page).toHaveURL('/auth/login');
    const cookies = await context.cookies();
    expect(cookies.some(c => c.name === getAuthTokenName())).toBeFalsy();
  });
});
