import { randomUUID } from 'node:crypto';

import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

import { INTERNAL_API_URL } from './lib/api';
import { contentSecurityPolicy } from './lib/csp';
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

/**
 * Next.js reads the nonce out of the request's own `Content-Security-Policy`
 * and stamps it onto the scripts it injects, so the header has to be set on
 * the request as well as the response.
 */
function withCsp(request: NextRequest, build: (headers: Headers) => NextResponse): NextResponse {
  const nonce = Buffer.from(randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('content-security-policy', policy);
  requestHeaders.set('x-nonce', nonce);
  const response = build(requestHeaders);
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pending = await isSetupPending();
  return withCsp(request, (headers) => {
    if (pending)
      return pathname.startsWith('/setup')
        ? NextResponse.next({ request: { headers } })
        : NextResponse.redirect(new URL('/setup', request.url));

    // `/admin` and `/setup` are not localized and carry no locale prefix.
    if (pathname.startsWith('/admin') || pathname.startsWith('/setup'))
      return NextResponse.next({ request: { headers } });

    const match = /^\/(ru|en)\/account(?:\/|$)/.exec(pathname);
    if (match && !request.cookies.has('rr_sid'))
      return NextResponse.redirect(
        new URL(`/${match[1] ?? routing.defaultLocale}?login=1`, request.url),
      );

    // `next-intl` builds the response itself, so the headers it should forward
    // are handed to it through a request carrying them.
    return localeMiddleware(new NextRequest(request, { headers }));
  });
}

export const config = {
  // `pay/robokassa` is Robokassa's return landing (11.3.4): it redirects to a
  // localized page itself, and the locale middleware would otherwise send it
  // to `/<locale>/pay/robokassa`, the page of an invoice named "robokassa".
  matcher: ['/((?!api|themes|auth|r/|pay/robokassa|_next|.*\\..*).*)'],
};
