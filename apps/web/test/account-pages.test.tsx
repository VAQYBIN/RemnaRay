import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { MockRoute } from '../test-utils/render-page';

vi.mock('../i18n/navigation', () => ({
  Link: ({ children }: { children: unknown }) => children,
  usePathname: () => '/account',
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  redirect: () => undefined,
  getPathname: () => '/account',
}));

const { renderPage } = await import('../test-utils/render-page');
const SubscriptionClient = (await import('../app/[locale]/account/subscription-client')).default;
const PlansClient = (await import('../app/[locale]/account/plans/plans-client')).default;
const BalanceClient = (await import('../app/[locale]/account/balance/balance-client')).default;
const ReferralsClient = (await import('../app/[locale]/account/referrals/referrals-client'))
  .default;
const DevicesClient = (await import('../app/[locale]/account/devices/devices-client')).default;
const SettingsClient = (await import('../app/[locale]/account/settings/settings-client')).default;

const userMe = {
  id: 'user-1',
  telegramId: 123,
  username: 'manta',
  firstName: 'Manta',
  language: 'ru',
  email: null,
  balance: { amountMinor: 0, currency: 'RUB' },
  referralCode: 'AB12CD34',
  referralLink: 'https://shop.test/r/AB12CD34',
  botReferralLink: 'https://t.me/bot?start=ref_AB12CD34',
  marketingOptOut: false,
  trialAvailable: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const failure = { status: 503, body: { error: { code: 'PANEL_UNAVAILABLE', requestId: 'req-7' } } };

type PageCase = {
  name: string;
  component: ComponentType<{ locale: 'ru' }>;
  emptyState: 'empty' | 'ready';
  hasEmptyBlock?: boolean;
  empty: Record<string, MockRoute>;
  error: Record<string, MockRoute>;
};

const pages: PageCase[] = [
  {
    name: 'subscription',
    component: SubscriptionClient,
    emptyState: 'empty',
    empty: {
      '/api/v1/me': { body: userMe },
      '/api/v1/me/subscription': { body: { subscription: null, panel: null, clients: [] } },
    },
    error: { '/api/v1/me': { body: userMe }, '/api/v1/me/subscription': failure },
  },
  {
    name: 'plans',
    component: PlansClient,
    emptyState: 'empty',
    empty: {
      '/api/v1/public/plans': { body: { items: [] } },
      '/api/v1/me/payment-methods': { body: { items: [] } },
    },
    error: {
      '/api/v1/public/plans': failure,
      '/api/v1/me/payment-methods': { body: { items: [] } },
    },
  },
  {
    name: 'balance',
    component: BalanceClient,
    emptyState: 'ready',
    empty: {
      '/api/v1/me': { body: userMe },
      '/api/v1/me/topup-config': { body: { presetsMinor: [], minMinor: 100, maxMinor: 1000 } },
      '/api/v1/me/payment-methods': { body: { items: [] } },
      '/api/v1/me/transactions': { body: { items: [], nextCursor: null } },
    },
    error: {
      '/api/v1/me': { body: userMe },
      '/api/v1/me/topup-config': failure,
      '/api/v1/me/payment-methods': { body: { items: [] } },
      '/api/v1/me/transactions': { body: { items: [], nextCursor: null } },
    },
  },
  {
    name: 'referrals',
    component: ReferralsClient,
    emptyState: 'ready',
    empty: {
      '/api/v1/me/referrals': {
        body: {
          code: 'AB12CD34',
          link: 'https://shop.test/r/AB12CD34',
          botLink: 'https://t.me/bot?start=ref_AB12CD34',
          invited: 0,
          converted: 0,
          earned: { amountMinor: 0, currency: 'RUB' },
          program: { mode: 'percent_first', percent: 20, fixedMinor: 0, inviteeBonus: 0 },
        },
      },
      '/api/v1/me/referrals/list': { body: { items: [], nextCursor: null } },
    },
    error: {
      '/api/v1/me/referrals': failure,
      '/api/v1/me/referrals/list': { body: { items: [], nextCursor: null } },
    },
  },
  {
    name: 'devices',
    component: DevicesClient,
    emptyState: 'ready',
    empty: { '/api/v1/me/subscription/devices': { body: { items: [], canRemove: true } } },
    error: { '/api/v1/me/subscription/devices': failure },
  },
  {
    name: 'settings',
    component: SettingsClient,
    emptyState: 'ready',
    hasEmptyBlock: false,
    empty: { '/api/v1/me': { body: userMe } },
    error: { '/api/v1/me': failure },
  },
];

describe('AC-133: every account page renders loading, empty and error', () => {
  for (const page of pages) {
    it(`renders the three states for /account ${page.name}`, async () => {
      const pendingRoutes = Object.fromEntries(
        Object.keys(page.empty).map((path) => [path, { pending: true }]),
      );
      const loading = await renderPage(page.component, pendingRoutes);
      expect(loading, 'loading state').toContain('data-state="loading"');
      expect(loading).toContain('animate-pulse');

      const empty = await renderPage(page.component, page.empty);
      expect(empty, 'ready or empty state').toContain(`data-state="${page.emptyState}"`);
      if (page.hasEmptyBlock !== false)
        expect(empty, 'empty block').toContain('data-state="empty"');

      const error = await renderPage(page.component, page.error);
      expect(error, 'error state').toContain('data-state="error"');
      expect(error).toContain('role="alert"');
      expect(error).toContain('req-7');
      expect(error, 'localized error code').toContain('Панель временно недоступна');
    });
  }
});
