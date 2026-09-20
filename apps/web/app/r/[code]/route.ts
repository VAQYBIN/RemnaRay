const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Section 13.1: the site referral link stores the code for 30 days and returns
 * the visitor to the landing page. The `Location` stays relative so the
 * redirect works on whichever origin the reverse proxy served.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const headers: Record<string, string> = { location: '/' };
  if (/^[A-Za-z0-9]{4,16}$/.test(code))
    headers['set-cookie'] =
      `rr_ref=${encodeURIComponent(code)}; Max-Age=${String(REFERRAL_COOKIE_MAX_AGE)}; Path=/; Secure; SameSite=Lax`;
  return new Response(null, { status: 302, headers });
}
