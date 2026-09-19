'use client';

import { createApiClient, type ApiClient } from '@remnaray/domain';

let csrfToken = '';

export function setAdminCsrfToken(token: string): void {
  csrfToken = token;
}

/** Every admin mutation carries the session CSRF token (section 9.2). */
export function adminApi(): ApiClient {
  return createApiClient({
    baseUrl: typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
    headers: {
      'x-requested-with': 'RemnaRay',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
  });
}

export function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'INTERNAL_ERROR';
}
