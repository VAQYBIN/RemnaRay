import { expect, test as setup } from '@playwright/test';

import { ADMIN_STORAGE_STATE, freshTotp, stackState } from './fixtures';

/**
 * Signs in once and stores the session, so the admin specs neither repeat the
 * flow nor collide with the one-shot TOTP replay guard.
 */
setup('authenticate as administrator', async ({ page }) => {
  const state = stackState();
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(state.admin.email);
  await page.getByLabel('Пароль').fill(state.admin.password);
  await page.getByRole('button', { name: 'Войти' }).click();

  const code = await freshTotp(state.admin.totpSecret, state.admin.email);
  await page.getByLabel('Код из приложения').fill(code);
  await page.getByRole('button', { name: 'Подтвердить' }).click();

  await page.waitForURL(/\/admin$/u);
  await expect(page.getByRole('heading', { name: 'Дашборд' })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
