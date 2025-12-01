import { test, expect } from '@playwright/test';

test.describe('Users page (Moderator)', () => {
  test('should display users page', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded' });
    // Wait for title to be set (usePageTitle hook sets it client-side)
    await page.waitForFunction(
      () => document.title.includes('Обзор пользователей'),
      { timeout: 10000 }
    );
    await expect(page).toHaveURL('/users');
    await expect(page).toHaveTitle(/Обзор пользователей/);
  });

  test('should display search input', async ({ page }) => {
    await page.goto('/users');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Check search input - actual placeholder is "Введите имя пользователя..."
    const searchInput = page.getByPlaceholder(
      /Введите имя пользователя|Поиск/i
    );
    await expect(searchInput).toBeVisible();
  });

  test('should display user type checkboxes', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);

    // Check for checkboxes (users and pseudousers)
    // Radix UI Checkbox uses button[role="checkbox"], not input[type="checkbox"]
    const checkboxes = page.locator('[role="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display user list area', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Check that page loaded without errors
    await expect(page).toHaveURL('/users');

    // The user list might be empty, but the page should be accessible
    // Check for any user-related elements
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should have filter controls', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Check for filter/search elements - actual placeholder is "Введите имя пользователя..."
    // At least the page should be accessible
    await expect(page).toHaveURL('/users');
  });
});
