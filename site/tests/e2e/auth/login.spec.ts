import { test, expect } from '@playwright/test';
import { testUsers } from '@/tests/e2e/setup/fixtures.mts';

test.describe('Login page', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveURL('/auth/login');
    await expect(page).toHaveTitle(/Вход/);

    // Check form elements - CardTitle uses div, not heading
    await expect(page.getByText('Вход', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Пароль')).toBeVisible();
    await expect(page.getByRole('button', { name: /Войти/i })).toBeVisible();
  });

  test('should show validation error for empty email', async ({ page }) => {
    await page.goto('/auth/login');

    // Try to submit without email
    const submitButton = page.getByRole('button', { name: /Войти/i });
    await submitButton.click();

    // HTML5 validation should prevent submission - check that input is invalid
    const emailInput = page.getByLabel('Email');
    const isValid = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(isValid).toBe(false);
  });

  test('should show validation error for empty password', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill email but not password
    await page.getByLabel('Email').fill('test@example.com');
    const submitButton = page.getByRole('button', { name: /Войти/i });
    await submitButton.click();

    // HTML5 validation should prevent submission - check that input is invalid
    const passwordInput = page.getByLabel('Пароль');
    const isValid = await passwordInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(isValid).toBe(false);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByLabel('Email').fill('invalid@test.com');
    await page.getByLabel('Пароль').fill('wrongpassword');
    await page.getByRole('button', { name: /Войти/i }).click();

    // Wait for error message - check for error text or red error message
    // Error can be in English from Supabase, so check for error class or any error text
    const errorElement = page.locator('.text-red-500');
    await expect(errorElement).toBeVisible({ timeout: 10000 });
    // Verify it contains some error-related text
    const errorText = await errorElement.textContent();
    expect(errorText).toBeTruthy();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    const user = testUsers.user;
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Пароль').fill(user.password);
    await page.getByRole('button', { name: /Войти/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should have link to sign-up page', async ({ page }) => {
    await page.goto('/auth/login');

    // Use first() to avoid strict mode violation (link appears in nav and form)
    const signUpLink = page
      .getByRole('link', { name: /Зарегистрироваться/i })
      .first();
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/auth/sign-up');
  });
});
