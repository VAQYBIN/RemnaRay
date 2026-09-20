import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cssVariables, themeSchema, type Theme } from '@remnaray/theme-schema';
import { namespaces, readNamespace, SUPPORTED_LOCALES, type Locale } from '@remnaray/i18n-core';

import { localeRoot } from '../i18n/messages';

const themeRoot =
  [
    process.env.RR_THEMES_DIR,
    '/themes',
    resolve(process.cwd(), 'themes'),
    resolve(process.cwd(), '..', '..', 'themes'),
  ].find((candidate) => candidate && existsSync(candidate)) ?? '/themes';

/** Section 18.2: administration always uses the neutral `_admin` theme. */
export function adminTheme(): Theme {
  return themeSchema.parse(
    JSON.parse(readFileSync(resolve(themeRoot, '_admin', 'theme.json'), 'utf8')),
  );
}

export function adminThemeStyle(theme: Theme): string {
  const variables = cssVariables(theme);
  const root = Object.entries(variables)
    .filter(([name]) => !name.startsWith('--color-dark-'))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  const dark = Object.entries(variables)
    .filter(([name]) => name.startsWith('--color-dark-'))
    .map(([name, value]) => `--color-${name.slice('--color-dark-'.length)}:${value}`)
    .join(';');
  return `:root{${root};--font-sans:${theme.typography.sans}}[data-theme="dark"]{${dark}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}`;
}

/**
 * Administration messages come from the shipped files only: section 18.4 keeps
 * `admin.json` and `setup.json` outside the owner's override surface.
 */
export function adminMessages(locale: Locale): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const namespace of namespaces) {
    for (const [key, value] of Object.entries(readNamespace(localeRoot, locale, namespace))) {
      const parts = key.split('.');
      let cursor = result;
      for (const part of parts.slice(0, -1)) {
        const next = cursor[part];
        if (!next || typeof next !== 'object' || Array.isArray(next)) cursor[part] = {};
        cursor = cursor[part] as Record<string, unknown>;
      }
      const last = parts.at(-1);
      if (last) cursor[last] = value;
    }
  }
  return result;
}

export function adminLocale(value: unknown): Locale {
  return SUPPORTED_LOCALES.find((item) => item === value) ?? 'ru';
}
