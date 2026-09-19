import { z } from 'zod';

import { localeDirectory, namespaces, readNamespace } from '@remnaray/i18n-core';

import { serverApi } from '../lib/api';
import type { Locale } from './routing';

export const localeRoot = localeDirectory();

/** AC-181: a locale override must reach the site within five seconds. */
export const I18N_REVALIDATE_SECONDS = 5;

const catalogSchema = z.object({
  lang: z.string(),
  namespace: z.string(),
  messages: z.record(z.string(), z.string()),
});

/**
 * Messages come from `GET /api/v1/public/i18n/:lang/:ns`, which applies
 * `locale_overrides` on top of the shipped files (section 18.5). The files are
 * read directly only when the API is unreachable, for example while
 * prerendering during a build.
 */
export async function loadLocaleMessages(locale: Locale): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const api = serverApi();
  for (const namespace of namespaces) {
    let flat: Record<string, string>;
    try {
      const catalog = await api.get(`api/v1/public/i18n/${locale}/${namespace}`, catalogSchema, {
        next: { revalidate: I18N_REVALIDATE_SECONDS, tags: ['i18n'] },
      });
      flat = catalog.messages;
    } catch {
      flat = readNamespace(localeRoot, locale, namespace);
    }
    for (const [key, value] of Object.entries(flat)) setPath(result, key, parseValue(value));
  }
  return result;
}

/** Arrays and objects travel as JSON strings inside the flat catalog. */
function parseValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
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
