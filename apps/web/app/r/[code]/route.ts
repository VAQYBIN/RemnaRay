import { NextResponse } from 'next/server';

const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Section 13.1: the site referral link stores the code for 30 days and returns
 * the visitor to the landing page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL('/', request.url), 302);
  if (/^[A-Za-z0-9]{4,16}$/.test(code)) {
    response.cookies.set('rr_ref', code, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  }
  return response;
}
