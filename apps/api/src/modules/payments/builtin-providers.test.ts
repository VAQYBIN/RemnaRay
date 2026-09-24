import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CryptoBotProvider,
  LavaProvider,
  PlategaProvider,
  RobokassaProvider,
  StarsProvider,
  YooKassaProvider,
  starsAmount,
} from './builtin-providers';

describe('payment provider boundaries', () => {
  it('checks YooKassa notification source against the documented ranges', () => {
    const provider = new YooKassaProvider();
    expect(provider.verifyWebhook(Buffer.from('{}'), {}, '185.71.76.2', {}).ok).toBe(true);
    expect(provider.verifyWebhook(Buffer.from('{}'), {}, '192.0.2.1', {}).ok).toBe(false);
  });

  it('verifies Robokassa ResultURL and returns its acknowledgement', () => {
    const provider = new RobokassaProvider();
    const cfg = { merchantLogin: 'shop', password2: 'secret' };
    const signature = createHash('md5').update('shop:10.00:42:secret').digest('hex');
    const event = Buffer.from(`OutSum=10.00&InvId=42&SignatureValue=${signature}`);
    expect(provider.verifyWebhook(event, {}, '', cfg).ok).toBe(true);
    provider.parseWebhook(event);
    expect(provider.ackResponse().body).toBe('OK42');
  });

  it('verifies Lava with the additional webhook key', () => {
    const body = Buffer.from('{"orderId":"x","status":"paid"}');
    const provider = new LavaProvider();
    expect(
      provider.verifyWebhook(
        body,
        { Signature: createHmac('sha256', 'additional').update(body).digest('hex') },
        '',
        { additionalKey: 'additional' },
      ).ok,
    ).toBe(true);
  });

  it('verifies CryptoBot using the derived token key', () => {
    const body = Buffer.from('{"payload":{"invoice_id":1,"status":"paid"}}');
    const token = 'token';
    const key = createHash('sha256').update(token).digest();
    const signature = createHmac('sha256', key).update(body).digest('hex');
    expect(
      new CryptoBotProvider().verifyWebhook(body, { 'crypto-pay-api-signature': signature }, '', {
        token,
      }).ok,
    ).toBe(true);
  });

  it('gives Telegram Stars no HTTP webhook (section 11.3.6)', () => {
    const provider = new StarsProvider();
    expect(provider.capabilities.webhooks).toBe(false);
    expect(provider.verifyWebhook().ok).toBe(false);
    expect(provider.parseWebhook()).toBeNull();
  });

  it('marks Platega as polling-only', () => {
    expect(new PlategaProvider().verifyWebhook(Buffer.from('{}'), {}, '', {}).ok).toBe(false);
  });
});

describe('Telegram Stars pricing and invoice link (section 11.3.6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts roubles with ceil(price / 100 × starsPerRub), never below one star', () => {
    expect(starsAmount(29900n, 0.75)).toBe(225n);
    expect(starsAmount(29901n, 0.75)).toBe(225n);
    expect(starsAmount(30000n, 0.75)).toBe(225n);
    expect(starsAmount(30001n, 0.75)).toBe(226n);
    expect(starsAmount(1n, 0.75)).toBe(1n);
    expect(starsAmount(10000n, 1.1)).toBe(110n);
  });

  it('prices a plan by price_overrides.XTR, scaled by any discount', () => {
    const plan = { priceMinor: 29900n, priceOverrides: { XTR: 200 } };
    expect(starsAmount(29900n, 0.75, plan)).toBe(200n);
    // 19900 / 29900 of 200 stars is 133.1 → 134, not the rate's 150.
    expect(starsAmount(19900n, 0.75, plan)).toBe(134n);
    // A one-kopeck discount keeps the plan's own star price.
    expect(starsAmount(29899n, 0.75, plan)).toBe(200n);
    expect(starsAmount(1n, 0.75, plan)).toBe(1n);
    expect(starsAmount(29900n, 0.75, { priceMinor: 29900n, priceOverrides: {} })).toBe(225n);
    expect(starsAmount(29900n, 0.75, { priceMinor: 29900n, priceOverrides: { XTR: 0 } })).toBe(
      225n,
    );
  });

  it('creates the invoice link with payload inv_<invoiceId> and an empty provider token', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(init.body as string) as Record<string, unknown> });
      return Promise.resolve(Response.json({ ok: true, result: 'https://t.me/$abc' }));
    });
    const expiresAt = new Date('2026-09-25T12:00:00Z');
    const created = await new StarsProvider().createInvoice(
      {
        invoiceId: 'client-key',
        shopInvoiceId: '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee',
        amountMinor: 29900n,
        currency: 'RUB',
        description: 'Премиум на 30 дней с огромным описанием тарифа',
        user: { id: 'u', telegramId: 1n, language: 'ru' },
        returnUrl: 'https://shop.test/pay/success',
        failUrl: 'https://shop.test/pay/fail',
        expiresAt,
        plan: { priceMinor: 29900n, priceOverrides: {} },
      },
      { starsPerRub: 0.75, botToken: '123:token', apiBase: 'http://telegram.test' },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('http://telegram.test/bot123:token/createInvoiceLink');
    expect(requests[0]?.body).toEqual({
      title: 'Премиум на 30 дней с огромным оп',
      description: 'Премиум на 30 дней с огромным описанием тарифа',
      payload: 'inv_0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee',
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: 'Премиум на 30 дней с огромным оп', amount: 225 }],
    });
    expect(created).toMatchObject({
      providerInvoiceId: 'inv_0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee',
      starsInvoiceLink: 'https://t.me/$abc',
      providerAmount: { amount: '225', currency: 'XTR', fxRate: '0.75250836' },
      expiresAt,
    });
  });

  it('keeps fx_rate finite below one rouble', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ ok: true, result: 'link' })));
    const created = await new StarsProvider().createInvoice(
      {
        invoiceId: 'k',
        shopInvoiceId: 'id',
        amountMinor: 50n,
        currency: 'RUB',
        description: 'Top-up',
        user: { id: 'u', telegramId: 1n, language: 'ru' },
        returnUrl: '',
        failUrl: '',
        expiresAt: new Date(),
      },
      { starsPerRub: 0.75, botToken: 't', apiBase: 'http://telegram.test' },
    );
    expect(created.providerAmount).toEqual({ amount: '1', currency: 'XTR', fxRate: '2.00000000' });
  });

  it('refuses to create a link without a rate or a bot token', async () => {
    const params = {
      invoiceId: 'k',
      shopInvoiceId: 'id',
      amountMinor: 100n,
      currency: 'RUB' as const,
      description: 'x',
      user: { id: 'u', telegramId: 1n, language: 'ru' },
      returnUrl: '',
      failUrl: '',
      expiresAt: new Date(),
    };
    await expect(new StarsProvider().createInvoice(params, { botToken: 't' })).rejects.toThrow(
      'starsPerRub',
    );
    await expect(new StarsProvider().createInvoice(params, { starsPerRub: 0.75 })).rejects.toThrow(
      'bot token',
    );
  });

  it('is healthy only with a rate and a bot token Telegram accepts', async () => {
    const provider = new StarsProvider();
    await expect(provider.healthcheck({ botToken: 't' })).resolves.toMatchObject({ ok: false });
    await expect(provider.healthcheck({ starsPerRub: 0.75 })).resolves.toMatchObject({ ok: false });
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url);
      return Promise.resolve(Response.json({ ok: true, result: { id: 1, is_bot: true } }));
    });
    await expect(
      provider.healthcheck({ starsPerRub: 0.75, botToken: 't', apiBase: 'http://telegram.test' }),
    ).resolves.toMatchObject({ ok: true });
    expect(urls).toEqual(['http://telegram.test/bott/getMe']);
  });
});
