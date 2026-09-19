/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, @typescript-eslint/restrict-template-expressions */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import { z } from 'zod';

import type {
  PaymentProvider,
  ProviderConfig,
  ProviderEvent,
  CreateInvoiceParams,
  CreatedInvoice,
} from './payments.types';

const json = async (url: string, init: RequestInit = {}) => {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`payment provider HTTP ${response.status}`);
  return body;
};
const amount = (minor: bigint) => `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`;
const toMinor = (value: unknown) => {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
};
const safeEqual = (actual: string, expected: string) => {
  const a = Buffer.from(actual.toLowerCase());
  const b = Buffer.from(expected.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
};
const ipAllowed = (ip: string, ranges: string[]) => {
  const clean = ip.replace(/^::ffff:/, '');
  const family = isIP(clean) === 4 ? 'ipv4' : 'ipv6';
  const list = new BlockList();
  for (const range of ranges) {
    const [subnet, bits] = range.split('/');
    if (subnet && bits) list.addSubnet(subnet, Number(bits), isIP(subnet) === 4 ? 'ipv4' : 'ipv6');
  }
  return list.check(clean, family);
};
const base = (config: ProviderConfig, fallback: string) =>
  String(config.baseUrl ?? fallback).replace(/\/$/, '');
const ack = (body: string | object = { ok: true }) => ({
  status: 200,
  body,
  contentType: typeof body === 'string' ? 'text/plain' : 'application/json',
});

export class YooKassaProvider implements PaymentProvider {
  readonly code = 'yookassa' as const;
  readonly capabilities = {
    receipts: true,
    webhooks: true,
    statusPolling: true,
    kind: 'redirect' as const,
    currencies: ['RUB'],
  };
  readonly configSchema = z.object({
    shopId: z.string(),
    secretKey: z.string(),
    ipRanges: z
      .array(z.string())
      .default([
        '185.71.76.0/27',
        '185.71.77.0/27',
        '77.75.153.0/25',
        '77.75.156.11/32',
        '77.75.156.35/32',
        '77.75.154.128/25',
        '2a02:5180::/32',
      ]),
    baseUrl: z.url().default('https://api.yookassa.ru'),
  });
  async createInvoice(p: CreateInvoiceParams, cfg: ProviderConfig): Promise<CreatedInvoice> {
    const body = {
      amount: { value: amount(p.amountMinor), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: p.returnUrl },
      description: p.description,
      metadata: { invoiceId: p.invoiceId },
      ...(p.receipt
        ? {
            receipt: {
              customer: p.receipt.customer,
              items: p.receipt.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                amount: { value: amount(item.amountMinor), currency: 'RUB' },
                vat_code: item.vatCode,
                payment_subject: item.paymentSubject,
                payment_mode: item.paymentMode,
              })),
            },
          }
        : {}),
    };
    const result = await json(`${base(cfg, 'https://api.yookassa.ru')}/v3/payments`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${cfg.shopId}:${cfg.secretKey}`).toString('base64')}`,
        'content-type': 'application/json',
        'Idempotence-Key': p.invoiceId,
      },
      body: JSON.stringify(body),
    });
    return {
      providerInvoiceId: String(result.id),
      paymentUrl: String((result.confirmation as Record<string, unknown>)?.confirmation_url ?? ''),
      expiresAt: p.expiresAt,
      rawSafe: result,
    };
  }
  verifyWebhook(_raw: Buffer, _headers: Record<string, string>, ip: string, cfg: ProviderConfig) {
    return {
      ok: ipAllowed(
        ip,
        (cfg.ipRanges as string[] | undefined) ?? [
          '185.71.76.0/27',
          '185.71.77.0/27',
          '77.75.153.0/25',
          '77.75.156.11/32',
          '77.75.156.35/32',
          '77.75.154.128/25',
          '2a02:5180::/32',
        ],
      ),
    };
  }
  parseWebhook(raw: Buffer): ProviderEvent | null {
    const v = JSON.parse(raw.toString()) as { event?: string; object?: Record<string, unknown> };
    const object = v.object;
    if (!object?.id) return null;
    return {
      eventId: `${object.id}:${v.event ?? 'unknown'}`,
      providerInvoiceId: String(object.id),
      type:
        v.event === 'payment.succeeded'
          ? 'paid'
          : v.event === 'payment.canceled'
            ? 'canceled'
            : 'pending',
      ...(object.amount && typeof object.amount === 'object'
        ? {
            paidAmount: {
              amount: String((object.amount as Record<string, unknown>).value),
              currency: String((object.amount as Record<string, unknown>).currency),
            },
          }
        : {}),
    };
  }
  ackResponse() {
    return ack();
  }
  async fetchStatus(id: string, cfg: ProviderConfig) {
    const r = await json(
      `${base(cfg, 'https://api.yookassa.ru')}/v3/payments/${encodeURIComponent(id)}`,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`${cfg.shopId}:${cfg.secretKey}`).toString('base64')}`,
        },
      },
    );
    return {
      eventId: `${id}:poll:${String(r.status)}`,
      providerInvoiceId: id,
      type: r.status === 'succeeded' ? 'paid' : r.status === 'canceled' ? 'canceled' : 'pending',
      ...(r.amount && typeof r.amount === 'object'
        ? {
            paidAmount: {
              amount: String((r.amount as Record<string, unknown>).value),
              currency: String((r.amount as Record<string, unknown>).currency),
            },
          }
        : {}),
    } as ProviderEvent;
  }
  async healthcheck(cfg: ProviderConfig) {
    const started = Date.now();
    try {
      await json(`${base(cfg, 'https://api.yookassa.ru')}/v3/me`, {
        headers: {
          authorization: `Basic ${Buffer.from(`${cfg.shopId}:${cfg.secretKey}`).toString('base64')}`,
        },
      });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : 'healthcheck failed',
      };
    }
  }
}

export class RobokassaProvider implements PaymentProvider {
  readonly code = 'robokassa' as const;
  readonly capabilities = {
    receipts: true,
    webhooks: true,
    statusPolling: true,
    kind: 'redirect' as const,
    currencies: ['RUB'],
  };
  readonly configSchema = z.object({
    merchantLogin: z.string(),
    password1: z.string(),
    password2: z.string(),
    test: z.boolean().default(false),
    algorithm: z.enum(['MD5', 'SHA256']).default('MD5'),
    baseUrl: z.url().default('https://auth.robokassa.ru'),
  });
  private lastInvoiceId = '';
  async createInvoice(p: CreateInvoiceParams, cfg: ProviderConfig) {
    const sum = amount(p.amountMinor);
    const receipt = p.receipt
      ? JSON.stringify({
          sno: cfg.sno ?? 'osn',
          items: p.receipt.items.map((item) => ({
            name: item.description,
            quantity: Number(item.quantity),
            sum,
            tax: `vat${item.vatCode}`,
            payment_object: item.paymentSubject,
            payment_method: item.paymentMode,
          })),
        })
      : undefined;
    const signature = createHash('md5')
      .update(
        `${cfg.merchantLogin}:${sum}:${p.invoiceId}${receipt ? `:${receipt}` : ''}:${cfg.password1}`,
      )
      .digest('hex');
    const query = new URLSearchParams({
      MerchantLogin: String(cfg.merchantLogin),
      OutSum: sum,
      InvId: p.invoiceId,
      SignatureValue: signature,
      Culture: p.user.language,
      ...(receipt ? { Receipt: receipt } : {}),
    });
    const url = `${base(cfg, 'https://auth.robokassa.ru')}/Merchant/Index.aspx?${query}`;
    return {
      providerInvoiceId: p.invoiceId,
      paymentUrl: url,
      expiresAt: p.expiresAt,
      rawSafe: {
        merchantLogin: cfg.merchantLogin,
        outSum: sum,
        invoiceId: p.invoiceId,
        ...(receipt ? { receipt: true } : {}),
      },
    };
  }
  verifyWebhook(raw: Buffer, _headers: Record<string, string>, _ip: string, cfg: ProviderConfig) {
    const params = new URLSearchParams(raw.toString());
    const expected = createHash('md5')
      .update(
        `${cfg.merchantLogin}:${params.get('OutSum') ?? ''}:${params.get('InvId') ?? ''}:${cfg.password2}`,
      )
      .digest('hex');
    return { ok: safeEqual(params.get('SignatureValue') ?? '', expected) };
  }
  parseWebhook(raw: Buffer) {
    const p = new URLSearchParams(raw.toString());
    const id = p.get('InvId');
    if (!id) return null;
    this.lastInvoiceId = id;
    return {
      eventId: `result:${id}:${p.get('OutSum')}`,
      providerInvoiceId: id,
      type: 'paid' as const,
      paidAmount: { amount: p.get('OutSum') ?? '0', currency: 'RUB' },
    };
  }
  ackResponse() {
    return ack(`OK${this.lastInvoiceId}`);
  }
  async fetchStatus(id: string) {
    return { eventId: `poll:${id}`, providerInvoiceId: id, type: 'pending' as const };
  }
  healthcheck() {
    return Promise.resolve({ ok: true, latencyMs: 0 });
  }
}

export class LavaProvider implements PaymentProvider {
  readonly code = 'lava' as const;
  readonly capabilities = {
    receipts: true,
    webhooks: true,
    statusPolling: true,
    kind: 'redirect' as const,
    currencies: ['RUB'],
  };
  readonly configSchema = z.object({
    shopId: z.string(),
    secretKey: z.string(),
    additionalKey: z.string(),
    baseUrl: z.url().default('https://api.lava.ru'),
  });
  async createInvoice(p: CreateInvoiceParams, cfg: ProviderConfig) {
    const body = {
      sum: Number(amount(p.amountMinor)),
      orderId: p.invoiceId,
      shopId: cfg.shopId,
      hookUrl: `${p.returnUrl}/webhooks/lava`,
      successUrl: p.returnUrl,
      failUrl: p.failUrl,
    };
    const raw = JSON.stringify(body);
    const result = await json(`${base(cfg, 'https://api.lava.ru')}/business/invoice/create`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json',
        Signature: createHmac('sha256', String(cfg.secretKey)).update(raw).digest('hex'),
      },
      body: raw,
    });
    return {
      providerInvoiceId: p.invoiceId,
      paymentUrl: String(result.url ?? result.paymentUrl),
      expiresAt: p.expiresAt,
      rawSafe: result,
    };
  }
  verifyWebhook(raw: Buffer, headers: Record<string, string>, _ip: string, cfg: ProviderConfig) {
    return {
      ok: safeEqual(
        headers.signature ?? headers.Signature ?? '',
        createHmac('sha256', String(cfg.additionalKey)).update(raw).digest('hex'),
      ),
    };
  }
  parseWebhook(raw: Buffer) {
    const v = JSON.parse(raw.toString()) as {
      id?: string;
      orderId?: string;
      status?: string;
      sum?: number;
    };
    const id = v.orderId ?? v.id;
    if (!id) return null;
    return {
      eventId: v.id ?? id,
      providerInvoiceId: id,
      type:
        v.status === 'paid' || v.status === 'success' ? ('paid' as const) : ('pending' as const),
      ...(v.sum ? { paidAmount: { amount: String(v.sum), currency: 'RUB' } } : {}),
    };
  }
  ackResponse() {
    return ack();
  }
  async fetchStatus(id: string, cfg: ProviderConfig) {
    const raw = JSON.stringify({ orderId: id, shopId: cfg.shopId });
    const r = await json(`${base(cfg, 'https://api.lava.ru')}/business/invoice/status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Signature: createHmac('sha256', String(cfg.secretKey)).update(raw).digest('hex'),
      },
      body: raw,
    });
    return {
      eventId: `poll:${id}`,
      providerInvoiceId: id,
      type: r.status === 'paid' || r.status === 'success' ? 'paid' : 'pending',
    } as ProviderEvent;
  }
  healthcheck() {
    return Promise.resolve({ ok: true, latencyMs: 0 });
  }
}

export class PlategaProvider implements PaymentProvider {
  readonly code = 'platega' as const;
  readonly capabilities = {
    receipts: false,
    webhooks: false,
    statusPolling: true,
    kind: 'redirect' as const,
    currencies: ['RUB'],
  };
  readonly configSchema = z.object({
    merchantId: z.string(),
    secret: z.string(),
    baseUrl: z.url().default('https://app.platega.io'),
  });
  async createInvoice(p: CreateInvoiceParams, cfg: ProviderConfig) {
    const body = {
      paymentDetails: { amount: Number(amount(p.amountMinor)), currency: 'RUB' },
      description: p.description,
      return: p.returnUrl,
      failedUrl: p.failUrl,
      payload: p.invoiceId,
      metadata: { userId: p.user.id },
    };
    const r = await json(`${base(cfg, 'https://app.platega.io')}/v2/transaction/process`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-MerchantId': String(cfg.merchantId),
        'X-Secret': String(cfg.secret),
      },
      body: JSON.stringify(body),
    });
    return {
      providerInvoiceId: String(r.transactionId),
      paymentUrl: String(r.url),
      expiresAt: p.expiresAt,
      rawSafe: r,
    };
  }
  verifyWebhook(_raw: Buffer, _headers: Record<string, string>, _ip: string, _cfg: ProviderConfig) {
    return { ok: false, reason: 'Platega is polled as the source of truth' };
  }
  parseWebhook() {
    return null;
  }
  ackResponse() {
    return ack();
  }
  async fetchStatus(id: string, cfg: ProviderConfig) {
    const r = await json(
      `${base(cfg, 'https://app.platega.io')}/transaction/${encodeURIComponent(id)}`,
      { headers: { 'X-MerchantId': String(cfg.merchantId), 'X-Secret': String(cfg.secret) } },
    );
    return {
      eventId: `poll:${id}:${String(r.status)}`,
      providerInvoiceId: id,
      type:
        r.status === 'CONFIRMED'
          ? 'paid'
          : r.status === 'CANCELED' || r.status === 'EXPIRED'
            ? 'canceled'
            : 'pending',
      ...(r.paymentDetails && typeof r.paymentDetails === 'object'
        ? {
            paidAmount: {
              amount: String((r.paymentDetails as Record<string, unknown>).amount),
              currency: String((r.paymentDetails as Record<string, unknown>).currency),
            },
          }
        : {}),
    } as ProviderEvent;
  }
  healthcheck() {
    return Promise.resolve({ ok: true, latencyMs: 0 });
  }
}

export class CryptoBotProvider implements PaymentProvider {
  readonly code = 'cryptobot' as const;
  readonly capabilities = {
    receipts: false,
    webhooks: true,
    statusPolling: true,
    kind: 'redirect' as const,
    currencies: ['RUB'],
  };
  readonly configSchema = z.object({
    token: z.string(),
    baseUrl: z.url().default('https://pay.crypt.bot/api'),
  });
  private auth(cfg: ProviderConfig) {
    return { 'Crypto-Pay-API-Token': String(cfg.token), 'content-type': 'application/json' };
  }
  async createInvoice(p: CreateInvoiceParams, cfg: ProviderConfig) {
    const r = await json(`${base(cfg, 'https://pay.crypt.bot/api')}/createInvoice`, {
      method: 'POST',
      headers: this.auth(cfg),
      body: JSON.stringify({
        currency_type: 'fiat',
        fiat: 'RUB',
        amount: Number(amount(p.amountMinor)) / 100,
        description: p.description,
        payload: p.invoiceId,
        expires_in: Math.max(1, Math.floor((p.expiresAt.getTime() - Date.now()) / 1000)),
      }),
    });
    const result = (r.result ?? r) as Record<string, unknown>;
    return {
      providerInvoiceId: String(result.invoice_id),
      paymentUrl: String(result.pay_url),
      expiresAt: p.expiresAt,
      rawSafe: r,
    };
  }
  verifyWebhook(raw: Buffer, headers: Record<string, string>, _ip: string, cfg: ProviderConfig) {
    const secret = createHash('sha256').update(String(cfg.token)).digest();
    return {
      ok: safeEqual(
        headers['crypto-pay-api-signature'] ?? '',
        createHmac('sha256', secret).update(raw).digest('hex'),
      ),
    };
  }
  parseWebhook(raw: Buffer) {
    const v = JSON.parse(raw.toString()) as {
      update_type?: string;
      payload?: Record<string, unknown>;
    };
    const p = v.payload;
    if (!p?.invoice_id) return null;
    return {
      eventId: String(p.invoice_id),
      providerInvoiceId: String(p.invoice_id),
      type: p.status === 'paid' ? ('paid' as const) : ('pending' as const),
      ...(p.amount
        ? { paidAmount: { amount: String(p.amount), currency: String(p.fiat ?? 'RUB') } }
        : {}),
    };
  }
  ackResponse() {
    return ack();
  }
  async fetchStatus(id: string, cfg: ProviderConfig) {
    const r = await json(
      `${base(cfg, 'https://pay.crypt.bot/api')}/getInvoices?invoice_ids=${encodeURIComponent(id)}`,
      { headers: this.auth(cfg) },
    );
    const result = (
      (r.result as Record<string, unknown>)?.items as Array<Record<string, unknown>> | undefined
    )?.[0];
    return {
      eventId: `poll:${id}`,
      providerInvoiceId: id,
      type: result?.status === 'paid' ? 'paid' : 'pending',
      ...(result?.amount
        ? { paidAmount: { amount: String(result.amount), currency: String(result.fiat ?? 'RUB') } }
        : {}),
    } as ProviderEvent;
  }
  healthcheck() {
    return Promise.resolve({ ok: true, latencyMs: 0 });
  }
}

export class StarsProvider implements PaymentProvider {
  readonly code = 'stars' as const;
  readonly capabilities = {
    receipts: false,
    webhooks: true,
    statusPolling: false,
    kind: 'stars' as const,
    currencies: ['XTR'],
  };
  readonly configSchema = z.object({
    botToken: z.string(),
    starAmount: z.number().int().positive().optional(),
    apiBase: z.url().default('https://api.telegram.org'),
  });
  async createInvoice(p: CreateInvoiceParams, cfg: ProviderConfig) {
    const stars = Number(cfg.starAmount ?? p.amountMinor / 100n);
    const result = await json(
      `${base(cfg, 'https://api.telegram.org')}/bot${cfg.botToken}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: p.description.slice(0, 32),
          description: p.description.slice(0, 255),
          payload: p.invoiceId,
          currency: 'XTR',
          prices: [{ label: p.description, amount: stars }],
        }),
      },
    );
    return {
      providerInvoiceId: p.invoiceId,
      starsInvoiceLink: String(result.result),
      providerAmount: {
        amount: String(stars),
        currency: 'XTR',
        fxRate: String(stars / Number(p.amountMinor / 100n)),
      },
      expiresAt: p.expiresAt,
      rawSafe: { ok: result.ok, providerInvoiceId: p.invoiceId, currency: 'XTR' },
    };
  }
  verifyWebhook() {
    return { ok: true };
  }
  parseWebhook(raw: Buffer) {
    const update = JSON.parse(raw.toString()) as {
      message?: {
        successful_payment?: {
          invoice_payload?: string;
          total_amount?: number;
          telegram_payment_charge_id?: string;
          currency?: string;
        };
      };
    };
    const payment = update.message?.successful_payment;
    if (!payment?.invoice_payload || !payment.telegram_payment_charge_id) return null;
    return {
      eventId: payment.telegram_payment_charge_id,
      providerInvoiceId: payment.invoice_payload,
      type: 'paid' as const,
      paidAmount: {
        amount: String(payment.total_amount ?? 0),
        currency: payment.currency ?? 'XTR',
      },
    };
  }
  ackResponse() {
    return ack();
  }
  fetchStatus(id: string) {
    return Promise.resolve({
      eventId: `poll:${id}`,
      providerInvoiceId: id,
      type: 'pending' as const,
    });
  }
  healthcheck() {
    return Promise.resolve({ ok: true, latencyMs: 0 });
  }
  async answerPrecheckout(queryId: string, ok: boolean, cfg: ProviderConfig) {
    return json(
      `${base(cfg, 'https://api.telegram.org')}/bot${cfg.botToken}/answerPreCheckoutQuery`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: queryId, ok }),
      },
    );
  }
}

export class BalanceProvider implements PaymentProvider {
  readonly code = 'balance' as const;
  readonly capabilities = {
    receipts: false,
    webhooks: false,
    statusPolling: false,
    kind: 'balance' as const,
    currencies: ['RUB'],
  };
  readonly configSchema = z.object({});
  createInvoice(p: CreateInvoiceParams) {
    return Promise.resolve({
      providerInvoiceId: p.invoiceId,
      expiresAt: p.expiresAt,
      rawSafe: { providerInvoiceId: p.invoiceId, kind: 'balance' },
    });
  }
  verifyWebhook() {
    return { ok: false, reason: 'balance has no webhooks' };
  }
  parseWebhook() {
    return null;
  }
  ackResponse() {
    return ack();
  }
  fetchStatus(id: string) {
    return Promise.resolve({ providerInvoiceId: id, type: 'paid' as const });
  }
  healthcheck() {
    return Promise.resolve({ ok: true, latencyMs: 0 });
  }
}

export const builtinProviders = [
  YooKassaProvider,
  RobokassaProvider,
  LavaProvider,
  PlategaProvider,
  CryptoBotProvider,
  StarsProvider,
  BalanceProvider,
];
