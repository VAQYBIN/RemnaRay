import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Locale } from './routing';

const namespaces = [
  'common',
  'landing',
  'account',
  'admin',
  'setup',
  'bot',
  'notify',
  'errors',
  'seo',
  'legal',
];
export const localeRoot =
  [join(process.cwd(), 'locales'), join(process.cwd(), '..', '..', 'locales')].find(existsSync) ??
  join(process.cwd(), 'locales');

export function loadLocaleMessages(locale: Locale): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const namespace of namespaces) {
    const filename = join(localeRoot, locale, `${namespace}.json`);
    const flat = JSON.parse(readFileSync(filename, 'utf8')) as Record<string, unknown>;
    for (const [key, value] of Object.entries(flat)) setPath(result, key, value);
  }
  return result;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts.at(-1);
  if (last) cursor[last] = value;
}
