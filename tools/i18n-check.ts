import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'locales');
const locales = readdirSync(root).filter((entry) => !entry.startsWith('.'));
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

function read(locale: string, namespace: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, locale, `${namespace}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
}

const base = 'en';
for (const namespace of namespaces) {
  const expected = Object.keys(read(base, namespace)).sort();
  for (const locale of locales) {
    const actual = Object.keys(read(locale, namespace)).sort();
    if (expected.join('\n') !== actual.join('\n'))
      throw new Error(`Locale keys differ: ${namespace} (${locale})`);
  }
}
console.log(
  `Checked ${String(locales.length)} locales and ${String(namespaces.length)} namespaces.`,
);
