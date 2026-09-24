import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  CryptoBotProvider,
  LavaProvider,
  PlategaProvider,
  RobokassaProvider,
  StarsProvider,
  YooKassaProvider,
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
