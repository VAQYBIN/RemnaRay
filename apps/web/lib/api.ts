import { createApiClient, type ApiClient } from '@remnaray/domain';

export const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'http://api:3000';

/** Server components call the API directly over the docker network (section 13.1). */
export function serverApi(cookie?: string): ApiClient {
  return createApiClient({
    baseUrl: INTERNAL_API_URL,
    ...(cookie ? { headers: { cookie } } : {}),
  });
}

/** Client components go through the proxy on the same origin. */
export function browserApi(): ApiClient {
  return createApiClient({ baseUrl: '/', headers: { 'x-requested-with': 'RemnaRay' } });
}
