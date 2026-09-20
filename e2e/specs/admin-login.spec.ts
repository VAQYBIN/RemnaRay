import { expect, test } from '@playwright/test';

import { freshTotp, stackState } from '../setup/fixtures';

test.describe('administration sign-in', () => {
  // The flow may wait up to one 30-second period for an unused TOTP code.
  test.setTimeout(90_000);

  test('refuses a wrong password and accepts the password plus TOTP flow', async ({ page }) => {
    const state = stackState();

    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(state.admin.email);
    await page.getByLabel('Пароль').fill('not-the-password');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByText('Неверный email или пароль.').first()).toBeVisible();

    await page.reload();
    await page.getByLabel('Email').fill(state.admin.email);
    await page.getByLabel('Пароль').fill(state.admin.password);
    await page.getByRole('button', { name: 'Войти' }).click();

    const code = await freshTotp(state.admin.totpSecret, state.admin.email);
    await page.getByLabel('Код из приложения').fill(code);
    await page.getByRole('button', { name: 'Подтвердить' }).click();

    await page.waitForURL(/\/admin$/u);
    await expect(page.getByRole('heading', { name: 'Дашборд' })).toBeVisible();
  });

  test('sends an anonymous visitor back to the login screen', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login$/u);
    await expect(page.getByRole('heading', { name: 'Вход в админку' })).toBeVisible();
  });
});
