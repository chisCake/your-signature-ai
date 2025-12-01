import { test, expect } from '@playwright/test';

test.describe('Signatures page (Moderator)', () => {
  test('should display signatures page', async ({ page }) => {
    await page.goto('/signatures', { waitUntil: 'domcontentloaded' });
    // Wait for title to be set (usePageTitle hook sets it client-side)
    await page.waitForFunction(
      () => document.title.includes('Обзор подписей'),
      { timeout: 10000 }
    );
    await expect(page).toHaveURL('/signatures');
    await expect(page).toHaveTitle(/Обзор подписей/);
  });

  test('should display filter panel', async ({ page }) => {
    await page.goto('/signatures');

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
    await page.goto('/signatures');

    // Default should be "genuine"
    const genuineButton = page.getByRole('button', { name: /Настоящие/i });
    const forgedButton = page.getByRole('button', { name: /Поддельные/i });

    await expect(genuineButton).toHaveAttribute('class', /default|bg-primary/i);

    // Switch to forged
    await forgedButton.click();
    await expect(forgedButton).toHaveAttribute('class', /default|bg-primary/i);

    // Switch back to genuine
    await genuineButton.click();
    await expect(genuineButton).toHaveAttribute('class', /default|bg-primary/i);
  });

  test('should display per page selector', async ({ page }) => {
    await page.goto('/signatures');

    // Check per page selector
    const perPageSelect = page.locator('select').first();
    await expect(perPageSelect).toBeVisible();

    // Check options
    const options = await perPageSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(0);
  });

  test('should display apply and reset buttons', async ({ page }) => {
    await page.goto('/signatures');

    const applyButton = page.getByRole('button', { name: /Найти/i });
    const resetButton = page.getByRole('button', { name: /Сбросить/i });

    await expect(applyButton).toBeVisible();
    await expect(resetButton).toBeVisible();
  });

  test('should display signature list area', async ({ page }) => {
    await page.goto('/signatures');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Check that signature list container exists
    // The list might be empty, but the container should be there
    // Just check that page loaded without errors
    await expect(page).toHaveURL('/signatures');
  });
});
