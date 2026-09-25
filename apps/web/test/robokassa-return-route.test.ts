// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { GET, POST } from '../app/pay/robokassa/route';

const INVOICE = '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee';

/** What Robokassa appends to the SuccessURL and the FailURL (11.3.4). */
const returned = (extra: Record<string, string> = {}) =>
  new URLSearchParams({
    OutSum: '299.00',
    InvId: '7',
    SignatureValue: 'abc',
    Culture: 'en',
    Shp_inv: INVOICE,
    ...extra,
  });

describe('/pay/robokassa returns the payer to the invoice page (11.3.4)', () => {
  it('redirects a GET return to the invoice in the payment language', () => {
    const response = GET(new Request(`http://shop.test/pay/robokassa?${returned().toString()}`));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`/en/pay/${INVOICE}`);
  });

  it('redirects a POST return the same way, with a GET after it', async () => {
    const response = await POST(
      new Request('http://shop.test/pay/robokassa', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: returned({ Culture: 'ru' }).toString(),
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`/ru/pay/${INVOICE}`);
  });

  it('falls back to the default locale for an unknown Culture', () => {
    const response = GET(
      new Request(`http://shop.test/pay/robokassa?${returned({ Culture: 'de' }).toString()}`),
    );
    expect(response.headers.get('location')).toBe(`/ru/pay/${INVOICE}`);
  });

  it('never puts anything but an invoice id into the redirect', () => {
    for (const value of ['//evil.test', '../admin', 'robokassa', `${INVOICE}/x`]) {
      const response = GET(
        new Request(`http://shop.test/pay/robokassa?${returned({ Shp_inv: value }).toString()}`),
      );
      expect(response.headers.get('location')).toBe('/en/account');
    }
  });
});

describe('the locale middleware', () => {
  it('leaves the Robokassa landing alone and still localizes the invoice pages', () => {
    // Read from the source: importing the proxy loads next-intl's middleware,
    // which needs the Next.js server runtime.
    const source = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
    const pattern = /matcher: \['(.+)'\]/u.exec(source)?.[1]?.replaceAll('\\\\', '\\') ?? '';
    const matcher = new RegExp(`^${pattern}$`, 'u');
    expect(matcher.test('/pay/robokassa')).toBe(false);
    expect(matcher.test(`/pay/${INVOICE}`)).toBe(true);
    expect(matcher.test(`/en/pay/${INVOICE}`)).toBe(true);
  });
});
