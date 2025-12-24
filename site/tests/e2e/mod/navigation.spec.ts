import { test, expect, Page } from '@playwright/test';
import { getAuthTokenName } from '@/tests/utils';
import { testUsers } from '../setup/fixtures.mts';

const routes = [
  '/dashboard-mod',
  '/signatures',
  '/users',
  '/controlled-signature-addition',
];

const { email: modEmail, password: modPassword } = testUsers.mod;
const dashboardMatch = /\/dashboard(-mod)?$/;

const gotoAsMod = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: 'networkidle' });
  if (page.url().includes('/auth/login')) {
    await page.fill('#email', modEmail);
    await page.fill('#password', modPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(dashboardMatch, { timeout: 30000 });
    await page.goto(path, { waitUntil: 'networkidle' });
  }
};

test.describe('Moderator navigation', () => {
  for (const route of routes) {
    test(`visits ${route}`, async ({ page }) => {
      await gotoAsMod(page, route);
      await page.waitForURL(route, { timeout: 10000 });
      await expect(page).toHaveURL(route);
      await expect(page).toHaveTitle(/.+/); // basic assertion that page loaded
    });
  }

  test('logout', async ({ page, context }) => {
    await gotoAsMod(page, '/dashboard-mod');
    await page.waitForURL('/dashboard-mod', { timeout: 10000 });
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('/auth/login', { timeout: 10000 });
    await expect(page).toHaveURL('/auth/login');
    const cookies = await context.cookies();
    expect(cookies.some(c => c.name === getAuthTokenName())).toBeFalsy();
    const { email, password } = testUsers.mod;
    await page.waitForSelector('#email', { timeout: 15000 });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(dashboardMatch, { timeout: 30000 });
    await expect(page).toHaveURL(dashboardMatch);
  });
});
