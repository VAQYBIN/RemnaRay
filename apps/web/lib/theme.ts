import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { themeSchema, themeTokensSchema, type ThemeTokens } from '@remnaray/theme-schema';

import { serverApi } from './api';

/** AC-181: a theme override must be visible on the site within five seconds. */
export const THEME_REVALIDATE_SECONDS = 5;

const themeRoot =
  [
    process.env.RR_THEMES_DIR,
    '/themes',
    resolve(process.cwd(), 'themes'),
    resolve(process.cwd(), '..', '..', 'themes'),
  ].find((candidate) => candidate && existsSync(candidate)) ?? '/themes';

function fallbackTheme(): ThemeTokens {
  const slug = process.env.RR_THEME_SLUG ?? 'manta';
  const theme = themeSchema.parse(
    JSON.parse(readFileSync(resolve(themeRoot, slug, 'theme.json'), 'utf8')),
  );
  const url = (file: string) => `/themes/${theme.slug}/${file}`;
  return {
    slug: theme.slug,
    name: theme.name,
    version: theme.version,
    brand: theme.brand,
    colors: theme.colors,
    typography: theme.typography,
    radius: theme.radius,
    landing: theme.landing,
    assets: {
      logo: url(theme.assets.logo),
      logoDark: url(theme.assets.logoDark),
      mark: url(theme.assets.mark),
      mascot: url(theme.assets.mascot.default),
      mascotEmpty: url(theme.assets.mascot.empty),
      mascotError: url(theme.assets.mascot.error),
      mascotSuccess: url(theme.assets.mascot.success),
      og: url(theme.assets.og),
      favicon: url(theme.assets.favicon),
      appleTouchIcon: url(theme.assets.appleTouchIcon),
      botAvatar: url(theme.assets.botAvatar),
    },
    etag: '"local"',
  };
}

/**
 * Tokens come from `ThemeService` (section 18.2). The bundled theme file is only
 * a fallback for prerendering and for a short API outage.
 */
export async function getTheme(): Promise<ThemeTokens> {
  try {
    return await serverApi().get('api/v1/public/theme', themeTokensSchema, {
      next: { revalidate: THEME_REVALIDATE_SECONDS, tags: ['theme'] },
    });
  } catch {
    return fallbackTheme();
  }
}
