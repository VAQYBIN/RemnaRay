/**
 * Section 19.3: the proxy adds every security header except this one, because
 * the nonce is per response and only `web` knows it. The directives are the
 * ones the specification lists — Telegram's Login Widget script, its images
 * and its OAuth frame, and nothing else.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    // F29: Telegram Login over OIDC loads `telegram-login.js` from
    // oauth.telegram.org and asks it for a token when opened inside Telegram.
    `script-src 'self' https://telegram.org https://oauth.telegram.org 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://t.me https://telegram.org",
    'frame-src https://oauth.telegram.org',
    "connect-src 'self' https://oauth.telegram.org",
    "font-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
