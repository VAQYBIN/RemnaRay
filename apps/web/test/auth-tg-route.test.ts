// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../app/auth/tg/route';

function request(headers: Record<string, string> = {}, token = 'jwt'): Request {
  return new Request(`http://shop.test/auth/tg?token=${token}`, { headers });
}

describe('/auth/tg picks the account locale (sections 13.1, 13.3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function signedIn() {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(null, { status: 302, headers: { 'set-cookie': 'rr_sid=s; Path=/' } }),
      ),
    );
  }

  it('follows the rr_lang cookie first', async () => {
    signedIn();
    const response = await GET(request({ cookie: 'rr_lang=en', 'accept-language': 'ru-RU' }));
    expect(response.headers.get('location')).toBe('/en/account');
  });

  // next-intl 4 sets `rr_lang` only when the locale differs from the browser's
  // `Accept-Language`, so a visitor reading `/en` in an English browser has
  // no cookie; the header is the next source in the section 13.1 order.
  it('falls back to Accept-Language when there is no cookie', async () => {
    signedIn();
    const response = await GET(request({ 'accept-language': 'en-US,en;q=0.9' }));
    expect(response.headers.get('location')).toBe('/en/account');
  });

  it('honours the quality order of Accept-Language', async () => {
    signedIn();
    const response = await GET(request({ 'accept-language': 'de-DE, en;q=0.5, ru;q=0.8' }));
    expect(response.headers.get('location')).toBe('/ru/account');
  });

  it('uses the default locale when neither names a supported one', async () => {
    signedIn();
    const response = await GET(request({ 'accept-language': 'de-DE,fr;q=0.8' }));
    expect(response.headers.get('location')).toBe('/ru/account');
  });

  it('sends a visitor without a token to the login of their locale', async () => {
    const response = await GET(request({ 'accept-language': 'en' }, ''));
    expect(response.headers.get('location')).toBe('/en?login=1');
  });
});
