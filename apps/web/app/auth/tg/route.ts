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
  const locale =
    localeFromCookie(request.headers.get('cookie')) ??
    localeFromAcceptLanguage(request.headers.get('accept-language')) ??
    routing.defaultLocale;
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

/**
 * Section 13.1 orders the sources as `rr_lang`, then `Accept-Language`, then
 * the default. next-intl 4 writes `rr_lang` only when the chosen locale
 * differs from `Accept-Language`, so the header is what carries the choice of
 * a visitor whose browser already speaks it.
 */
function localeFromAcceptLanguage(
  header: string | null,
): (typeof routing.locales)[number] | undefined {
  const ranked = (header ?? '')
    .split(',')
    .map((item, index) => {
      const [tag = '', ...params] = item.trim().split(';');
      const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const quality = q ? Number(q.slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split('-')[0],
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((item) => item.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);
  for (const { language } of ranked) {
    const locale = routing.locales.find((item) => item === language);
    if (locale) return locale;
  }
  return undefined;
}
