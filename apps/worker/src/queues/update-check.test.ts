import { describe, expect, it, vi } from 'vitest';

import { publishedReleases } from './update-check';

function github(body: unknown, status = 200) {
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
}

describe('section 24.6 update check', () => {
  it('asks the releases list with the headers GitHub requires', async () => {
    const fetchImpl = github([]);
    await publishedReleases('owner/repo', fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://api.github.com/repos/owner/repo/releases?per_page=100');
    expect(init?.headers).toMatchObject({
      'User-Agent': 'remnaray-update-check',
      Accept: 'application/vnd.github+json',
    });
  });

  it('keeps only published final releases and marks the security ones', async () => {
    const fetchImpl = github([
      {
        tag_name: 'v1.1.6',
        html_url: 'https://h/1.1.6',
        body: "## What's Changed\n### Security\n- fix",
        draft: false,
        prerelease: false,
        published_at: '2026-09-20T00:00:00Z',
      },
      { tag_name: 'v1.3.0-rc.1', draft: false, prerelease: true },
      {
        tag_name: 'v1.2.3',
        html_url: 'https://h/1.2.3',
        body: 'No security changes in this one.',
        draft: false,
        prerelease: false,
        published_at: null,
      },
      { tag_name: 'v2.0.0', draft: true, prerelease: false },
      { tag_name: 'nightly', draft: false, prerelease: false },
    ]);
    await expect(publishedReleases('o/r', fetchImpl as unknown as typeof fetch)).resolves.toEqual([
      {
        version: '1.1.6',
        url: 'https://h/1.1.6',
        security: true,
        publishedAt: '2026-09-20T00:00:00Z',
      },
      { version: '1.2.3', url: 'https://h/1.2.3', security: false, publishedAt: null },
    ]);
  });

  it('fails on a refusal, so the reading is retried', async () => {
    await expect(
      publishedReleases('o/r', github({ message: 'rate limited' }, 403) as unknown as typeof fetch),
    ).rejects.toThrow('GitHub answered 403');
  });
});
