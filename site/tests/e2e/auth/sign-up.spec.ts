import { test, expect } from '@playwright/test';

test.describe('Sign-up page', () => {
  test('should display sign-up form', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await expect(page).toHaveURL('/auth/sign-up');
    await expect(page).toHaveTitle(/Регистрация/);

    // Check form elements - CardTitle uses div, not heading
    await expect(
      page.getByText('Регистрация', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    // Use id selector to avoid strict mode violation (there are 2 password fields)
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByLabel('Повторите пароль')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Зарегистрироваться/i })
    ).toBeVisible();
  });

  test('should show validation error for empty email', async ({ page }) => {
    await page.goto('/auth/sign-up');

    // Try to submit without email
    const submitButton = page.getByRole('button', {
      name: /Зарегистрироваться/i,
    });
    await submitButton.click();

    // HTML5 validation should prevent submission - check that input is invalid
    const emailInput = page.getByLabel('Email');
    const isValid = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(isValid).toBe(false);
  });

  test('should show validation error for empty password', async ({ page }) => {
    await page.goto('/auth/sign-up');

    // Fill email but not password
    await page.getByLabel('Email').fill('test@example.com');
    const submitButton = page.getByRole('button', {
      name: /Зарегистрироваться/i,
    });
    await submitButton.click();

    // HTML5 validation should prevent submission - use id selector to avoid strict mode violation
    const passwordInput = page.locator('#password');
    const isValid = await passwordInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(isValid).toBe(false);
  });

  test('should show error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/sign-up');

    await page.getByLabel('Email').fill('newuser@test.com');
    // Use id selector to avoid strict mode violation
    await page.locator('#password').fill('password123');
    await page.getByLabel('Повторите пароль').fill('different123');
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click();

    // Wait for error message about password mismatch - check for error text or red error message
    // Error message is "Passwords do not match" in English
    const errorElement = page.locator('.text-red-500');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    // Verify it contains password-related text
    const errorText = await errorElement.textContent();
    expect(errorText?.toLowerCase()).toMatch(/password|парол|match|совпад/i);
  });

  test('should have link to login page', async ({ page }) => {
    await page.goto('/auth/sign-up');

    // Ждем загрузки страницы
    await page.waitForLoadState('networkidle');

    // Ищем ссылку "Войти" в основном контенте (используем first() чтобы избежать strict mode violation)
    const loginLink = page.getByRole('link', { name: /Войти/i }).first();
    await expect(loginLink).toBeVisible({ timeout: 5000 });
    await expect(loginLink).toHaveAttribute('href', '/auth/login');
  });

  test('should show loading state during sign-up', async ({ page }) => {
    await page.goto('/auth/sign-up');

    await page.getByLabel('Email').fill('newuser@test.com');
    // Use id selector to avoid strict mode violation
    await page.locator('#password').fill('password123');
    await page.getByLabel('Повторите пароль').fill('password123');

    const submitButton = page.getByRole('button', {
      name: /Зарегистрироваться/i,
    });
    await submitButton.click();

    // Button should show loading state
    await expect(
      page.getByRole('button', { name: /Создание аккаунта/i })
    ).toBeVisible({ timeout: 1000 });
  });
});
