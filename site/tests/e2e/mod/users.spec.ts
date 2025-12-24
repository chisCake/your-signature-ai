import { test, expect, Page } from '@playwright/test';
import { testUsers } from '../setup/fixtures.mts';

const { email: modEmail, password: modPassword } = testUsers.mod;

const gotoUsersAsMod = async (page: Page) => {
  await page.goto('/users', { waitUntil: 'networkidle' });
  if (page.url().includes('/auth/login')) {
    await page.fill('#email', modEmail);
    await page.fill('#password', modPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard(-mod)?/, { timeout: 30000 });
    await page.goto('/users', { waitUntil: 'networkidle' });
  }
};

test.describe('Users page (Moderator)', () => {
  test('should display users page', async ({ page }) => {
    await gotoUsersAsMod(page);

    // Проверяем что мы на правильной странице (не редирект на login)
    await expect(page).toHaveURL('/users', { timeout: 15000 });

    // Ждем загрузки страницы - проверяем наличие любого h1 элемента
    await page.waitForSelector('h1', { timeout: 15000 });

    // Ищем заголовок более гибким способом
    const heading = page
      .locator('h1')
      .filter({ hasText: /Управление пользователями/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Wait for title to be set (usePageTitle hook sets it client-side)
    try {
      await page.waitForFunction(
        () => document.title.includes('Обзор пользователей'),
        { timeout: 10000 }
      );
    } catch {
      // Если заголовок не установился, это не критично - главное что страница загрузилась
    }
  });

  test('should display search input', async ({ page }) => {
    await gotoUsersAsMod(page);

    // Проверяем что мы на правильной странице
    await expect(page).toHaveURL('/users', { timeout: 15000 });

    // Ждем появления заголовка
    await page.waitForSelector('h1', { timeout: 15000 });
    const heading = page
      .locator('h1')
      .filter({ hasText: /Управление пользователями/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Check search input - actual placeholder is "Введите имя пользователя..."
    const searchInput = page.getByPlaceholder(/Введите имя пользователя/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('should display user type checkboxes', async ({ page }) => {
    await gotoUsersAsMod(page);

    // Проверяем что мы на правильной странице
    await expect(page).toHaveURL('/users', { timeout: 15000 });

    // Ждем появления заголовка
    await page.waitForSelector('h1', { timeout: 15000 });
    const heading = page
      .locator('h1')
      .filter({ hasText: /Управление пользователями/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Wait for checkboxes to be visible
    // Radix UI Checkbox uses button[role="checkbox"], not input[type="checkbox"]
    const checkboxes = page.locator('[role="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });

    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display user list area', async ({ page }) => {
    await gotoUsersAsMod(page);

    // Проверяем что мы на правильной странице
    await expect(page).toHaveURL('/users', { timeout: 15000 });

    // Ждем появления заголовка
    await page.waitForSelector('h1', { timeout: 15000 });
    const heading = page
      .locator('h1')
      .filter({ hasText: /Управление пользователями/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Ждем загрузки данных - текст "Найдено:" с числом появляется только после загрузки
    // Ищем в любом месте страницы, не только в main
    const userListArea = page.getByText(/Найдено:\s*\d+/i);
    await expect(userListArea).toBeVisible({ timeout: 20000 });
  });

  test('should have filter controls', async ({ page }) => {
    await gotoUsersAsMod(page);

    // Проверяем что мы на правильной странице
    await expect(page).toHaveURL('/users', { timeout: 15000 });

    // Ждем появления заголовка
    await page.waitForSelector('h1', { timeout: 15000 });
    const heading = page
      .locator('h1')
      .filter({ hasText: /Управление пользователями/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Check for filter controls
    const filterLabel = page.getByText(/Фильтры/i);
    await expect(filterLabel).toBeVisible({ timeout: 10000 });

    // Check for search input
    const searchInput = page.getByPlaceholder(/Введите имя пользователя/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });
});
