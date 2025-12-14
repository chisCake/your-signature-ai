import { test, expect, Page } from '@playwright/test';
import { testUsers } from '../setup/fixtures.mts';

const { email: modEmail, password: modPassword } = testUsers.mod;

const gotoAsMod = async (page: Page) => {
  await page.goto('/signatures', { waitUntil: 'networkidle' });
  if (page.url().includes('/auth/login')) {
    await page.fill('#email', modEmail);
    await page.fill('#password', modPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard(-mod)?/, { timeout: 30000 });
    await page.goto('/signatures', { waitUntil: 'networkidle' });
  }
};

test.describe('Signatures page (Moderator)', () => {
  test('should display signatures page', async ({ page }) => {
    await gotoAsMod(page);
    await page.waitForLoadState('domcontentloaded');
    // Wait for title to be set (usePageTitle hook sets it client-side)
    await page.waitForFunction(
      () => document.title.includes('Обзор подписей'),
      { timeout: 10000 }
    );
    await expect(page).toHaveURL('/signatures');
    await expect(page).toHaveTitle(/Обзор подписей/);
  });

  test('should display filter panel', async ({ page }) => {
    await gotoAsMod(page);

    // Check search input
    await expect(page.getByPlaceholder(/Введите ID подписи/i)).toBeVisible();

    // Check category buttons
    await expect(
      page.getByRole('button', { name: /Настоящие/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Поддельные/i })
    ).toBeVisible();

    // Check filter buttons
    await expect(page.getByRole('button', { name: /Найти/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Сбросить/i })).toBeVisible();
  });

  test('should switch between genuine and forged categories', async ({
    page,
  }) => {
    await gotoAsMod(page);

    // Ждем загрузки страницы
    await page.waitForSelector('input[placeholder*="Введите ID подписи"]', {
      timeout: 10000,
    });

    // Default should be "genuine"
    const genuineButton = page
      .getByRole('button', { name: /Настоящие/i })
      .first();
    const forgedButton = page
      .getByRole('button', { name: /Поддельные/i })
      .first();

    await expect(genuineButton).toBeVisible({ timeout: 10000 });
    await expect(forgedButton).toBeVisible({ timeout: 10000 });

    // Проверяем начальное состояние (genuine активна)
    await expect(genuineButton).toHaveAttribute(
      'class',
      /default|bg-primary/i,
      { timeout: 5000 }
    );

    // Switch to forged
    await forgedButton.click();
    await page.waitForTimeout(500); // Даем время на обновление состояния
    await expect(forgedButton).toHaveAttribute('class', /default|bg-primary/i, {
      timeout: 5000,
    });

    // Switch back to genuine
    await genuineButton.click();
    await page.waitForTimeout(500); // Даем время на обновление состояния
    await expect(genuineButton).toHaveAttribute(
      'class',
      /default|bg-primary/i,
      { timeout: 5000 }
    );
  });

  test('should display per page selector', async ({ page }) => {
    await gotoAsMod(page);

    // Ждем загрузки страницы
    await page.waitForSelector('input[placeholder*="Введите ID подписи"]', {
      timeout: 10000,
    });

    // Check per page selector - ищем select рядом с текстом "Показывать по"
    const perPageSelect = page
      .locator('select')
      .filter({
        has: page.locator('option[value="50"]'),
      })
      .first();

    await expect(perPageSelect).toBeVisible({ timeout: 10000 });

    // Check options
    const options = await perPageSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(0);
  });

  test('should display apply and reset buttons', async ({ page }) => {
    await gotoAsMod(page);
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByPlaceholder(/Введите ID подписи/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Ищем кнопки - может быть несколько кнопок с таким текстом, берем первые
    await page.waitForTimeout(1000); // Даем время на рендеринг

    const applyButton = page.getByRole('button', { name: /Найти/i }).first();
    const resetButton = page.getByRole('button', { name: /Сбросить/i }).first();

    await expect(applyButton).toBeVisible({ timeout: 15000 });
    await expect(resetButton).toBeVisible({ timeout: 15000 });
  });

  test('should display signature list area', async ({ page }) => {
    await gotoAsMod(page);
    await page.waitForLoadState('domcontentloaded');

    // Проверяем что мы на правильной странице
    await expect(page).toHaveURL('/signatures', { timeout: 15000 });

    const searchInput = page.getByPlaceholder(/Введите ID подписи/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Ждем загрузки данных - ищем индикатор количества подписей
    // Это может быть "Всего:", "Найдено:" или просто число
    const totalBadge = page.getByText(/Всего:|Найдено:/i).first();

    // Проверяем наличие badge с количеством (это означает, что данные загрузились)
    await expect(totalBadge).toBeVisible({ timeout: 20000 });
  });
});
