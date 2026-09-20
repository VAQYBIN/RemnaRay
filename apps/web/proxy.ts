import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { INTERNAL_API_URL } from './lib/api';
import { routing } from './i18n/routing';

const localeMiddleware = createMiddleware(routing);

/** Re-asking on every navigation would be a request per page view. */
const SETUP_CACHE_MS = 5000;
let setupChecked = 0;
let setupPending = false;

/**
 * Section 17.4: while the wizard has not finished, every path goes to
 * `/setup`. The API answers the wizard's own state route with 404
 * `SETUP_ALREADY_COMPLETED` once it has, which is the signal used here; the
 * answer is then final, so it is cached for the life of the process.
 */
async function isSetupPending(): Promise<boolean> {
  if (setupChecked !== 0 && (!setupPending || Date.now() - setupChecked < SETUP_CACHE_MS))
    return setupPending;
  try {
    const response = await fetch(`${INTERNAL_API_URL}/api/setup/v1/state`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    setupPending = response.status !== 404;
  } catch {
    // An unreachable API must not lock the whole site behind the wizard.
    setupPending = false;
  }
  setupChecked = Date.now();
  return setupPending;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (await isSetupPending())
    return pathname.startsWith('/setup')
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/setup', request.url));

  // `/admin` and `/setup` are not localized and carry no locale prefix.
  if (pathname.startsWith('/admin') || pathname.startsWith('/setup')) return NextResponse.next();

  const response = localeMiddleware(request);
  const match = /^\/(ru|en)\/account(?:\/|$)/.exec(pathname);
  if (match && !request.cookies.has('rr_sid')) {
    return NextResponse.redirect(
      new URL(`/${match[1] ?? routing.defaultLocale}?login=1`, request.url),
    );
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|themes|auth|r/|_next|.*\\..*).*)'],
};
