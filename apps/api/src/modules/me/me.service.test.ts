import { describe, expect, it, vi } from 'vitest';

import { MeService } from './me.service';

const settingValues: Record<string, unknown> = {
  'bot.username': 'manta_bot',
  'domain.main': 'shop.example.test',
  'trial.enabled': true,
  'balance.topup_enabled': true,
  'balance.topup_presets_minor': ['10000', '50000'],
  'balance.topup_min_minor': '10000',
  'balance.topup_max_minor': '1000000',
  'subscription.user_can_remove_devices': true,
  'clients.items': [
    {
      id: 'happ',
      name: 'Happ',
      platforms: ['ios'],
      deepLinkTemplate: 'happ://add/{url}',
      storeUrls: {},
    },
  ],
  'referral.mode': 'percent_first',
  'referral.percent': 20,
  'referral.fixed_minor': '0',
  'referral.invitee_bonus': '0',
};

const user = {
  id: 'user-1',
  telegramId: 123n,
  username: 'mantafan',
  firstName: 'Manta',
  language: 'ru',
  email: null,
  referralCode: 'AB12CD34',
  marketingOptOut: false,
  trialUsedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const plan = {
  id: '11111111-1111-7111-8111-111111111111',
  slug: 'month',
  name: { ru: 'Месяц', en: 'Month' },
  description: { ru: '', en: '' },
  durationDays: 30,
  trafficLimitBytes: 0n,
  deviceLimit: 3,
  priceMinor: 29900n,
  currency: 'RUB',
  sortOrder: 10,
  isActive: true,
  deletedAt: null,
};

function service(overrides: Record<string, unknown> = {}) {
  const db = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue(user),
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 'user-2', firstName: 'Anastasia', username: null }]),
    },
    account: { findFirst: vi.fn().mockResolvedValue({ balanceMinor: 29900n }) },
    // Section 15.2: the held referral rewards of the user.
    $queryRaw: vi.fn().mockResolvedValue([{ held: 0n }]),
    subscription: { findFirst: vi.fn().mockResolvedValue(null) },
    transaction: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    plan: {
      findUnique: vi.fn().mockResolvedValue(plan),
      findFirst: vi.fn().mockResolvedValue(plan),
    },
    panelUser: { findUnique: vi.fn().mockResolvedValue(null) },
    paymentProvider: { findMany: vi.fn().mockResolvedValue([]) },
    invoice: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    promocode: { findFirst: vi.fn().mockResolvedValue(null) },
    promocodeRedemption: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    referralAttribution: { findMany: vi.fn().mockResolvedValue([]) },
    referralReward: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0n } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
  const settings = { get: (key: string) => Promise.resolve(settingValues[key]) };
  const instance = new MeService(
    { db } as never,
    settings as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { db, instance };
}

describe('MeService', () => {
  it('publishes the section 9.4 UserMe shape with money as numbers', async () => {
    const profile = await service().instance.profile('user-1');

    expect(profile).toMatchObject({
      id: 'user-1',
      telegramId: 123,
      language: 'ru',
      balance: { amountMinor: 29900, currency: 'RUB' },
      referralCode: 'AB12CD34',
      referralLink: 'https://shop.example.test/r/AB12CD34',
      botReferralLink: 'https://t.me/manta_bot?start=ref_AB12CD34',
      trialAvailable: true,
    });
  });

  it('shows the available balance and the held rewards apart (section 15.2)', async () => {
    const test = service();
    test.db.$queryRaw.mockResolvedValue([{ held: 9900n }]);

    await expect(test.instance.profile('user-1')).resolves.toMatchObject({
      balance: { amountMinor: 20000, currency: 'RUB' },
      balanceHeld: { amountMinor: 9900, currency: 'RUB' },
    });
    const methods = await test.instance.paymentMethods('user-1');
    const balance = methods.items.find((item) => item.kind === 'balance');
    expect(balance && 'balance' in balance ? balance.balance : null).toEqual({
      amountMinor: 20000,
      currency: 'RUB',
    });
  });

  it('hides the trial once the user has bought something', async () => {
    const test = service({
      transaction: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([]) },
    });
    await expect(test.instance.profile('user-1')).resolves.toMatchObject({ trialAvailable: false });
  });

  it('rejects an empty profile patch and accepts a language change', async () => {
    const test = service();
    await expect(test.instance.patchProfile('user-1', {})).rejects.toThrow();
    await test.instance.patchProfile('user-1', { language: 'en' });
    expect(test.db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { language: 'en' },
    });
  });

  it('builds client deep links from the subscription URL', async () => {
    const test = service({
      panelUser: {
        findUnique: vi.fn().mockResolvedValue({
          panelStatus: 'ACTIVE',
          usedTrafficBytes: 1024n,
          trafficLimitBytes: 0n,
          expireAtPanel: new Date('2026-03-01T00:00:00.000Z'),
          hwidDeviceLimit: 3,
          subscriptionUrl: 'https://panel.test/s/abc',
        }),
      },
      subscription: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'sub-1',
          status: 'active',
          source: 'purchase',
          planId: plan.id,
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        }),
      },
    });
    const result = await test.instance.subscription('user-1');

    expect(result.panel?.usedTrafficBytes).toBe(1024);
    expect(result.subscription?.canChangePlan).toBe(true);
    expect(result.subscription?.canRevoke).toBe(true);
    expect(result.clients[0]?.deepLink).toBe(
      `happ://add/${encodeURIComponent('https://panel.test/s/abc')}`,
    );
  });

  it('pages transactions with an opaque cursor', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `tx-${String(index)}`,
      type: 'topup',
      amountMinor: 10000n,
      currency: 'RUB',
      provider: 'mock',
      status: 'succeeded',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      reason: null,
    }));
    const test = service({
      transaction: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue(rows),
      },
    });
    const page = await test.instance.transactions('user-1', { limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.amount).toEqual({ amountMinor: 10000, currency: 'RUB' });
    expect(page.nextCursor).toBe('tx-1');
  });

  it('masks invited names in the referral list', async () => {
    const test = service({
      referralAttribution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'att-1',
            refereeId: 'user-2',
            status: 'converted',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      },
    });
    const page = await test.instance.referralList('user-1', {});

    expect(page.items[0]?.maskedName).toBe('A••••••');
    expect(page.items[0]?.maskedName).not.toContain('nastasia');
  });

  it('refuses a top-up outside the configured range', async () => {
    await expect(
      service().instance.createInvoice(
        'user-1',
        { kind: 'topup', provider: 'mock', amountMinor: 100 },
        'key-1',
      ),
    ).rejects.toMatchObject({
      response: { error: { code: 'TOPUP_AMOUNT_OUT_OF_RANGE' } },
    });
  });

  it('never offers a provider that has no successful healthcheck (AC-061)', async () => {
    const test = service({
      paymentProvider: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { code: 'never-checked', displayName: { ru: 'New' }, lastHealthcheckOk: null },
          ]),
      },
    });
    const methods = await test.instance.paymentMethods('user-1');

    expect(methods.items[1]).toMatchObject({
      code: 'never-checked',
      available: false,
      unavailableReason: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('offers balance and healthy providers only', async () => {
    const test = service({
      paymentProvider: {
        findMany: vi.fn().mockResolvedValue([
          { code: 'yookassa', displayName: { ru: 'ЮKassa' }, lastHealthcheckOk: true },
          { code: 'lava', displayName: { ru: 'Lava' }, lastHealthcheckOk: false },
        ]),
      },
    });
    const methods = await test.instance.paymentMethods('user-1');

    expect(methods.items.map((item) => [item.code, item.available])).toEqual([
      ['balance', true],
      ['yookassa', true],
      ['lava', false],
    ]);
    expect(methods.items[2]).toMatchObject({ unavailableReason: 'PROVIDER_UNAVAILABLE' });
  });

  it('applies the section 15.5 promocode rules', async () => {
    const promocode = {
      id: 'promo-1',
      type: 'discount_percent',
      value: 20n,
      maxUses: 1,
      maxUsesPerUser: 1,
      usedCount: 0,
      validFrom: null,
      validUntil: null,
      planIds: [],
      firstPurchaseOnly: false,
      minAmountMinor: 0n,
      isActive: true,
    };
    const test = service({ promocode: { findFirst: vi.fn().mockResolvedValue(promocode) } });

    await expect(
      test.instance.previewPromocode('user-1', { code: 'sale2026', planId: plan.id }),
    ).resolves.toEqual({ discountMinor: 5980, finalMinor: 23920 });

    const exhausted = service({
      promocode: { findFirst: vi.fn().mockResolvedValue(promocode) },
      promocodeRedemption: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    });
    await expect(
      exhausted.instance.previewPromocode('user-1', { code: 'sale2026', planId: plan.id }),
    ).rejects.toMatchObject({ response: { error: { code: 'PROMO_EXHAUSTED' } } });
  });

  it('reports an unknown promocode as PROMO_NOT_FOUND', async () => {
    await expect(
      service().instance.previewPromocode('user-1', { code: 'nope1234', planId: plan.id }),
    ).rejects.toMatchObject({ response: { error: { code: 'PROMO_NOT_FOUND' } } });
  });

  it('refuses to cancel an invoice that is no longer pending', async () => {
    const test = service({
      invoice: {
        findUnique: vi.fn().mockResolvedValue({ id: 'inv-1', userId: 'user-1', status: 'paid' }),
        update: vi.fn(),
      },
    });
    await expect(test.instance.cancelInvoice('user-1', 'inv-1')).rejects.toMatchObject({
      response: { error: { code: 'INVOICE_NOT_PENDING' } },
    });
  });

  it('does not cancel an invoice paid between the check and the update', async () => {
    const paidMeanwhile = { id: 'inv-1', userId: 'user-1', status: 'pending' };
    const test = service({
      invoice: {
        findUnique: vi.fn().mockResolvedValue(paidMeanwhile),
        // The conditional update finds no pending row: the payment won.
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn(),
      },
    });
    (test.db as Record<string, unknown>).$transaction = (fn: (tx: unknown) => unknown) =>
      fn(test.db);

    await expect(test.instance.cancelInvoice('user-1', 'inv-1')).rejects.toMatchObject({
      response: { error: { code: 'INVOICE_NOT_PENDING' } },
    });
    expect(test.db.invoice.update).not.toHaveBeenCalled();
    expect(test.db.promocodeRedemption.updateMany).not.toHaveBeenCalled();
  });

  it('never exposes another user invoice', async () => {
    const test = service({
      invoice: {
        findUnique: vi.fn().mockResolvedValue({ id: 'inv-1', userId: 'user-2', status: 'pending' }),
        update: vi.fn(),
      },
    });
    await expect(test.instance.invoice('user-1', 'inv-1')).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
  });

  it('resolves the acting Telegram user for the internal API', async () => {
    const test = service();
    await expect(test.instance.userIdForTelegram('123')).resolves.toBe('user-1');
    await expect(test.instance.userIdForTelegram('abc')).rejects.toMatchObject({ status: 403 });
  });
});
