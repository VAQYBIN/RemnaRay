import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const types: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
const themeRoot =
  [resolve(process.cwd(), 'themes'), resolve(process.cwd(), '..', '..', 'themes')].find(
    existsSync,
  ) ?? resolve(process.cwd(), 'themes');
// Compose mounts the persistent upload volume at this fixed path. Keeping the
// path static also prevents Next's output tracer from copying the repository.
const uploadRoot = resolve('/uploads/themes');

/**
 * The proxy excludes `/themes` from the page policy, and an SVG opened
 * directly is a document of the shop's origin that may run script. This one
 * lets an asset render and nothing else: no script, no requests, sandboxed.
 * Uploaded logos are checked for script as well; this holds for anything a
 * theme archive carries.
 */
const ASSET_POLICY = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; asset: string }> },
) {
  const { slug, asset } = await params;
  if (!/^[a-z0-9_-]+$/.test(slug) || !/^[a-z0-9._-]+$/.test(asset))
    return new Response('Not found', { status: 404 });
  try {
    const override = resolve(uploadRoot, slug, 'overrides', asset);
    const shipped = resolve(themeRoot, slug, asset);
    const file = await readFile(
      /* turbopackIgnore: true */ existsSync(override) ? override : shipped,
    );
    return new Response(file, {
      headers: {
        'Cache-Control': 'public, max-age=86400, immutable',
        'Content-Type': types[extname(asset)] ?? 'application/octet-stream',
        'Content-Security-Policy': ASSET_POLICY,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
