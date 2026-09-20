import { INTERNAL_API_URL } from '../../../lib/api';
import { routing } from '../../../i18n/routing';

/**
 * A relative `Location` keeps the redirect on whatever origin the visitor used.
 * Deriving an absolute URL from the request would leak the internal host when
 * the request arrives through the reverse proxy.
 */
function redirect(location: string, cookie?: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location, ...(cookie ? { 'set-cookie': cookie } : {}) },
  });
}

/**
 * Section 13.3: the bot sends the user to `/auth/tg?token=<jwt>`. The API
 * exchanges the token for a session cookie, which is forwarded to the browser
 * before the redirect into the account.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  const locale = localeFromCookie(request.headers.get('cookie')) ?? routing.defaultLocale;
  const login = `/${locale}?login=1`;
  if (!token) return redirect(login);

  try {
    const response = await fetch(
      `${INTERNAL_API_URL}/api/v1/auth/tg?token=${encodeURIComponent(token)}`,
      { redirect: 'manual', signal: AbortSignal.timeout(10_000) },
    );
    const cookie = response.headers.get('set-cookie');
    return cookie ? redirect(`/${locale}/account`, cookie) : redirect(login);
  } catch {
    return redirect(login);
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
