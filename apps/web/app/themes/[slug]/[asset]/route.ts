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
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
