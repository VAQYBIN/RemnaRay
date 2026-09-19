import { z } from 'zod';

import { serverApi } from './api';

const publicConfigLocaleSchema = z.object({
  locales: z.object({ default: z.string() }),
});

/**
 * The administration interface language comes from `settings.admin.language`.
 * It is not reachable without a session, so the public default is the fallback
 * used before an administrator signs in.
 */
export async function getAdminLanguage(): Promise<string> {
  try {
    const config = await serverApi().get('api/v1/public/config', publicConfigLocaleSchema, {
      next: { revalidate: 60, tags: ['config'] },
    });
    return config.locales.default;
  } catch {
    return 'ru';
  }
}
