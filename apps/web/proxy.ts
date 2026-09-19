import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from './i18n/routing';

const localeMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = localeMiddleware(request);
  const match = request.nextUrl.pathname.match(/^\/(ru|en)\/account(?:\/|$)/);
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
