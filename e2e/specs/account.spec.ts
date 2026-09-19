import { createHmac } from 'node:crypto';

import { expect, test, type BrowserContext } from '@playwright/test';

import { stackState } from '../setup/fixtures';

/** Signs in the way the bot's «Открыть кабинет» button does (section 13.3). */
async function signIn(context: BrowserContext, baseURL: string): Promise<void> {
  const state = stackState();
  const issued = await context.request.post(`${state.apiUrl}/api/internal/v1/auth/issue-token`, {
    headers: { 'x-internal-token': state.internalToken, 'content-type': 'application/json' },
    data: { telegramId: state.user.telegramId },
  });
  expect(issued.ok()).toBeTruthy();
  const { token } = (await issued.json()) as { token: string };
  const page = await context.newPage();
  await page.goto(`${baseURL}/auth/tg?token=${encodeURIComponent(token)}`);
  await page.waitForURL(/\/(ru|en)\/account/u);
  await page.close();
}

test.describe('customer account', () => {
  test('redirects an anonymous visitor to the landing with the login modal', async ({ page }) => {
    await page.goto('/ru/account');
    await expect(page).toHaveURL(/\/ru\?login=1$/u);
  });

  test('shows the empty subscription state after signing in from the bot', async ({
    context,
    page,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? '');
    await page.goto('/ru/account');

    await expect(page.getByRole('heading', { name: 'Подписка' })).toBeVisible();
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await expect(page.getByText('У вас нет подписки')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выбрать тариф' })).toBeVisible();
  });

  test('lists plans with the balance method first and a promo code field', async ({
    context,
    page,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? '');
    await page.goto('/ru/account/plans');

    await expect(page.locator('[data-state="ready"]')).toBeVisible();
    await expect(page.getByText('Месяц')).toBeVisible();
    await expect(page.getByLabel('Промокод')).toBeVisible();
    const radios = page.locator('input[type="radio"][name="provider"]');
    await expect(radios.first()).toBeVisible();
  });

  test('shows the balance, its history and the top-up presets', async ({
    context,
    page,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? '');
    await page.goto('/ru/account/balance');

    await expect(page.getByText('Текущий баланс')).toBeVisible();
    await expect(page.getByText('500 ₽').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Пополнить' }).first()).toBeVisible();
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
  });

  test('saves a settings change and keeps it after a reload', async ({
    context,
    page,
    baseURL,
  }) => {
    await signIn(context, baseURL ?? '');
    await page.goto('/ru/account/settings');

    const email = page.getByLabel('Email для чеков');
    await email.fill('receipts@example.test');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Сохранено', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Email для чеков')).toHaveValue('receipts@example.test');
  });

  test('signs out and returns to the landing', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL ?? '');
    await page.goto('/ru/account');
    await page.getByRole('button', { name: 'Выйти' }).click();

    await expect(page).toHaveURL(/\/ru$/u);
    await page.goto('/ru/account');
    await expect(page).toHaveURL(/\/ru\?login=1$/u);
  });

  test('buys a plan with the mock provider and sees the invoice paid', async ({
    context,
    page,
    baseURL,
  }) => {
    const state = stackState();
    await signIn(context, baseURL ?? '');
    await page.goto('/ru/account/plans');
    await expect(page.locator('[data-state="ready"]')).toBeVisible();

    await page.locator('input[type="radio"][name="provider"][value="mock"]').check();
    await page.getByRole('button', { name: 'Оплатить' }).first().click();

    await page.waitForURL(/\/ru\/pay\/[\w-]+$/u);
    await expect(page.getByText('Ожидание оплаты').first()).toBeVisible();

    // The provider confirms out of band, exactly as a real webhook does. It
    // knows the invoice by its own reference, which is the last segment of the
    // payment URL.
    const paymentUrl = await page
      .getByRole('link', { name: 'Перейти к оплате' })
      .getAttribute('href');
    const providerInvoiceId = (paymentUrl ?? '').split('/').pop() ?? '';
    expect(providerInvoiceId).not.toBe('');
    const body = JSON.stringify({
      eventId: `e2e-${providerInvoiceId}`,
      providerInvoiceId,
      type: 'paid',
      paidAmountMinorRub: '29900',
    });
    const accepted = await context.request.post(`${state.apiUrl}/webhooks/mock`, {
      headers: {
        'content-type': 'application/json',
        'x-mock-signature': createHmac('sha256', 'mock-secret').update(body).digest('hex'),
      },
      data: body,
    });
    expect(accepted.ok()).toBeTruthy();

    await expect(page.getByText('Оплачено').first()).toBeVisible({ timeout: 15_000 });
  });
});
