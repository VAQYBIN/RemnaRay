import { describe, expect, it, vi } from 'vitest';

import { ThemeService, themeDirectory } from './theme.service';

function service(slug = 'manta') {
  const settings = { get: vi.fn().mockResolvedValue(slug) };
  return new ThemeService(settings as never);
}

describe('ThemeService', () => {
  it('resolves the mounted themes directory', () => {
    expect(themeDirectory().endsWith('themes')).toBe(true);
  });

  it('serves validated tokens with versioned asset URLs and an ETag', async () => {
    const tokens = await service().active();

    expect(tokens.slug).toBe('manta');
    expect(tokens.colors.primary).toBe('#0EA5A4');
    expect(tokens.assets['og']).toMatch(/^\/themes\/manta\/og\.png\?v=[0-9a-f]{12}$/);
    expect(tokens.etag).toMatch(/^"[0-9a-f]{12}"$/);
  });

  it('caches by content fingerprint and returns the same object', async () => {
    const instance = service();
    expect(await instance.active()).toBe(await instance.active());
  });

  it('scans the directory so new themes appear without a restart', () => {
    const slugs = service()
      .list()
      .map((theme) => theme.slug);

    expect(slugs).toContain('manta');
    expect(slugs).toContain('_admin');
    expect(
      service()
        .list()
        .find((theme) => theme.slug === '_admin')?.builtin,
    ).toBe(true);
  });

  it('rejects unknown and malformed slugs', () => {
    expect(() => service().load('../etc')).toThrow();
    expect(() => service().load('missing-theme')).toThrow();
  });
});
