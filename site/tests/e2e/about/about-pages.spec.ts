import { test, expect } from '@playwright/test';

test.describe('About pages', () => {
  test('should display main about page', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL('/about');
    await expect(page).toHaveTitle(/Информация/);

    // Check main heading - use first heading to avoid strict mode violation
    await expect(
      page.getByRole('heading', { name: 'Информация' }).first()
    ).toBeVisible();

    // Check navigation links to sub-pages - search within main content
    const main = page.getByRole('main');
    await expect(
      main.getByText('Пользовательское соглашение').first()
    ).toBeVisible();
    await expect(
      main.getByText('Политика конфиденциальности').first()
    ).toBeVisible();
    await expect(main.getByText('Нейронная сеть').first()).toBeVisible();
  });

  test('should navigate to terms page', async ({ page }) => {
    await page.goto('/about');

    // Use first() to avoid strict mode violation (link appears in nav, page buttons, and footer)
    const termsLink = page
      .getByRole('link', { name: /Пользовательское соглашение/i })
      .first();
    await expect(termsLink).toBeVisible();
    await expect(termsLink).toHaveAttribute('href', '/about/terms');

    await termsLink.click();
    await expect(page).toHaveURL('/about/terms');
    await expect(page).toHaveTitle(/Пользовательское соглашение/);

    // Check content - use heading role to avoid strict mode violation
    await expect(
      page.getByRole('heading', { name: 'Пользовательское соглашение' })
    ).toBeVisible();
    await expect(page.getByText(/Введение/i)).toBeVisible();
  });

  test('should navigate to privacy page', async ({ page }) => {
    await page.goto('/about');

    // Use first() to avoid strict mode violation
    const privacyLink = page
      .getByRole('link', { name: /Политика конфиденциальности/i })
      .first();
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', '/about/privacy');

    await privacyLink.click();
    await expect(page).toHaveURL('/about/privacy');
    await expect(page).toHaveTitle(/Политика конфиденциальности/);

    // Check that page loaded - use heading role to avoid strict mode violation
    await expect(
      page.getByRole('heading', { name: 'Политика конфиденциальности' })
    ).toBeVisible();
  });

  test('should navigate to neuralnetwork page', async ({ page }) => {
    await page.goto('/about');

    // Use first() to avoid strict mode violation
    const neuralLink = page
      .getByRole('link', { name: /Нейронная сеть/i })
      .first();
    await expect(neuralLink).toBeVisible();
    await expect(neuralLink).toHaveAttribute('href', '/about/neuralnetwork');

    await neuralLink.click();
    await expect(page).toHaveURL('/about/neuralnetwork');
    await expect(page).toHaveTitle(/Нейронная сеть/);

    // Check that page loaded - use heading role to avoid strict mode violation
    await expect(
      page.getByRole('heading', { name: 'Нейронная сеть' })
    ).toBeVisible();
  });

  test('should display terms page content', async ({ page }) => {
    await page.goto('/about/terms');

    // Check main sections - use heading role to avoid strict mode violation
    await expect(
      page.getByRole('heading', { name: 'Пользовательское соглашение' })
    ).toBeVisible();
    await expect(page.getByText(/Введение/i)).toBeVisible();
    await expect(page.getByText(/Возрастные ограничения/i)).toBeVisible();
    await expect(page.getByText(/Контакты/i)).toBeVisible();
  });

  test('should display privacy page content', async ({ page }) => {
    await page.goto('/about/privacy');

    // Check that page has content - use heading role to avoid strict mode violation
    await expect(
      page.getByRole('heading', { name: 'Политика конфиденциальности' })
    ).toBeVisible();
  });

  test('should display neuralnetwork page content', async ({ page }) => {
    await page.goto('/about/neuralnetwork');

    // Check that page has content - use heading role to avoid strict mode violation
    await expect(
      page.getByRole('heading', { name: 'Нейронная сеть' })
    ).toBeVisible();
  });
});
