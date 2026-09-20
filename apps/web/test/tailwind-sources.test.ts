import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const cssPath = resolve(import.meta.dirname, '../app/globals.css');
const css = readFileSync(cssPath, 'utf8');

/**
 * Tailwind's automatic detection skips `node_modules`, and that is the only
 * place the application can see `@remnaray/ui` from. Without an `@source` the
 * stylesheet carries just the classes the application itself happens to use:
 * the kit's buttons lost `px-4 py-2`, its disabled state lost `opacity-50`,
 * and the toast viewport lost the `fixed`/`z-100` that put it on the screen.
 */
describe('the stylesheet scans the UI kit', () => {
  const sources = [...css.matchAll(/@source\s+'([^']+)'/gu)].map((match) => match[1] ?? '');

  it('registers a source that resolves to the kit', () => {
    const resolved = sources.map((source) => resolve(dirname(cssPath), source));
    const [kit = ''] = resolved.filter((path) => path.endsWith('packages/ui/src'));

    expect(kit, `globals.css registers no UI kit source (found ${sources.join(', ')})`).not.toBe(
      '',
    );
    expect(existsSync(kit)).toBe(true);
    expect(readdirSync(kit)).toContain('button.tsx');
  });

  it('registers it before anything that would use it', () => {
    expect(css.indexOf("@import 'tailwindcss'")).toBeLessThan(css.indexOf('@source'));
  });
});
