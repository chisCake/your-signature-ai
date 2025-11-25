import { test, expect } from '@playwright/test';

test.describe('Project Status Component', () => {
  test('should display project status in footer', async ({ page }) => {
    await page.goto('/');

    // Проверяем наличие компонента статуса в футере
    const statusComponent = page.locator('text=Статус проекта');
    await expect(statusComponent).toBeVisible();
  });

  test('should open dropdown on click', async ({ page }) => {
    await page.goto('/');

    // Находим кнопку статуса проекта
    const statusButton = page.locator('button:has-text("Статус проекта")');
    await expect(statusButton).toBeVisible();

    // Кликаем на кнопку
    await statusButton.click();

    // Проверяем, что дропдаун открылся
    const dropdown = page.locator('text=Статус компонентов');
    await expect(dropdown).toBeVisible();
  });

  test('should display all component statuses in dropdown', async ({ page }) => {
    await page.goto('/');

    // Открываем дропдаун
    const statusButton = page.locator('button:has-text("Статус проекта")');
    await statusButton.click();

    // Проверяем наличие всех компонентов
    await expect(page.locator('text=Сайт')).toBeVisible();
    await expect(page.locator('text=Supabase')).toBeVisible();
    await expect(page.locator('text=ИИ Сервер')).toBeVisible();
  });

  test('should display status indicators (colored circles)', async ({ page }) => {
    await page.goto('/');

    // Открываем дропдаун
    const statusButton = page.locator('button:has-text("Статус проекта")');
    await statusButton.click();

    // Проверяем наличие цветных индикаторов
    const indicators = page.locator('.rounded-full');
    const count = await indicators.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    await page.goto('/');

    // Открываем дропдаун
    const statusButton = page.locator('button:has-text("Статус проекта")');
    await statusButton.click();

    // Проверяем, что дропдаун открыт
    const dropdown = page.locator('text=Статус компонентов');
    await expect(dropdown).toBeVisible();

    // Кликаем вне дропдауна
    await page.click('body', { position: { x: 0, y: 0 } });

    // Проверяем, что дропдаун закрылся
    await expect(dropdown).not.toBeVisible();
  });

  test('should have refresh button in dropdown', async ({ page }) => {
    await page.goto('/');

    // Открываем дропдаун
    const statusButton = page.locator('button:has-text("Статус проекта")');
    await statusButton.click();

    // Проверяем наличие кнопки обновления
    const refreshButton = page.locator('text=Обновить');
    await expect(refreshButton).toBeVisible();
  });
});

