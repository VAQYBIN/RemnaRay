import { NextResponse } from 'next/server';

import { INTERNAL_API_URL } from '../../../lib/api';
import { routing } from '../../../i18n/routing';

/**
 * Section 13.3: the bot sends the user to `/auth/tg?token=<jwt>`. The API
 * exchanges the token for a session cookie, which is forwarded to the browser
 * before the redirect into the account.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const locale =
    routing.locales.find((item) => item === request.headers.get('x-rr-locale')) ??
    localeFromCookie(request.headers.get('cookie')) ??
    routing.defaultLocale;
  const loginUrl = new URL(`/${locale}?login=1`, url.origin);
  if (!token) return NextResponse.redirect(loginUrl, 302);

  try {
    const response = await fetch(
      `${INTERNAL_API_URL}/api/v1/auth/tg?token=${encodeURIComponent(token)}`,
      { redirect: 'manual', signal: AbortSignal.timeout(10_000) },
    );
    const cookie = response.headers.get('set-cookie');
    if (!cookie) return NextResponse.redirect(loginUrl, 302);
    const result = NextResponse.redirect(new URL(`/${locale}/account`, url.origin), 302);
    result.headers.set('set-cookie', cookie);
    return result;
  } catch {
    return NextResponse.redirect(loginUrl, 302);
  }
}

function localeFromCookie(header: string | null): (typeof routing.locales)[number] | undefined {
  const value = header
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('rr_lang='))
    ?.slice('rr_lang='.length);
  return routing.locales.find((item) => item === value);
}
