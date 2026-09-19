import { expect, test } from '@playwright/test';

import { stackState } from '../setup/fixtures';

test.describe('administration console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('dashboard renders the widgets and both charts', async ({ page }) => {
    await expect(page.locator('[data-state="ready"]')).toBeVisible();
    await expect(page.getByText('Выручка', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Выручка по дням')).toBeVisible();
    await expect(page.getByText('Регистрации по дням')).toBeVisible();
    await expect(page.getByText('Требует внимания')).toBeVisible();
  });

  test('finds the seeded user and opens the card', async ({ page }) => {
    const state = stackState();
    await page.getByRole('link', { name: 'Пользователи' }).click();
    await page.getByLabel('Поиск').fill(state.user.telegramId);
    await page.getByRole('button', { name: 'Применить' }).click();

    await expect(page.getByText('e2euser')).toBeVisible();
    await page.getByRole('button', { name: 'Открыть' }).click();
    await expect(page.getByRole('heading', { name: 'E2E' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Журнал' })).toBeVisible();
  });

  test('shows the action journal', async ({ page }) => {
    await page.goto('/admin/audit');
    await expect(page.locator('[data-state="ready"], [data-state="empty"]').first()).toBeVisible();
  });

  test('creates a plan and shows it in the list', async ({ page }) => {
    await page.getByRole('link', { name: 'Тарифы' }).click();

    await page.getByLabel('Идентификатор').fill('e2e-week');
    await page.getByLabel('Название (ru)').fill('Неделя');
    await page.getByLabel('Название (en)').fill('Week');
    await page.getByLabel('Дней').fill('7');
    await page.getByLabel('Цена').fill('99');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    await expect(page.getByText('e2e-week')).toBeVisible();
  });

  test('settings show the provider health gate from AC-061', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.getByRole('tab', { name: 'Платежи' }).click();

    await expect(
      page.getByText('Без успешной проверки провайдер не показывается пользователям.'),
    ).toBeVisible();
    await expect(page.getByText('mock')).toBeVisible();
  });

  test('system page lists the queues and the health endpoint', async ({ page }) => {
    await page.goto('/admin/system');

    await expect(page.getByRole('heading', { name: 'Очереди' })).toBeVisible();
    await expect(page.getByRole('link', { name: '/api/v1/health' })).toBeVisible();
  });

  test('a forged mutation is refused (section 9.2)', async ({ page }) => {
    // Issued from the page, so it carries the administrator session cookie but
    // neither the custom header nor the CSRF token the console sends.
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/admin/v1/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: 'csrf-attempt',
          name: { ru: 'X', en: 'X' },
          durationDays: 1,
          priceMinor: 1,
        }),
      });
      return response.status;
    });
    expect(status).toBe(403);
  });

  test('a mutation with the header but a wrong CSRF token is refused', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/admin/v1/plans', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'RemnaRay',
          'x-csrf-token': 'x'.repeat(43),
        },
        body: JSON.stringify({
          slug: 'csrf-attempt',
          name: { ru: 'X', en: 'X' },
          durationDays: 1,
          priceMinor: 1,
        }),
      });
      return response.status;
    });
    expect(status).toBe(403);
  });

  test('the administration surface is never indexed', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /admin');
  });
});
