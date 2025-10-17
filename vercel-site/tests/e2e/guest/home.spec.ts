import { test, expect } from '@playwright/test';

test('guest can visit home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Sign/); // adjust to real title if needed
});

