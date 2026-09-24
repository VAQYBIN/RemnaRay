// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { GET } from '../app/themes/[slug]/[asset]/route';

const request = (slug: string, asset: string) =>
  GET(new Request(`http://shop.test/themes/${slug}/${asset}`), {
    params: Promise.resolve({ slug, asset }),
  });

describe('theme assets (section 19.3)', () => {
  // Theme SVGs are served from the shop's own origin. Opened directly, an SVG
  // is a document that may run script there; the policy makes it inert
  // whatever it contains, including the files of an uploaded theme archive.
  it('serves an SVG with a sandboxing policy that allows no script', async () => {
    const response = await request('manta', 'logo.svg');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    const policy = response.headers.get('content-security-policy') ?? '';
    expect(policy.split('; ')).toEqual(expect.arrayContaining(["default-src 'none'", 'sandbox']));
    expect(policy).not.toContain('script-src');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('refuses a path outside the theme', async () => {
    expect((await request('manta', '..%2Ftheme.json')).status).toBe(404);
  });
});
