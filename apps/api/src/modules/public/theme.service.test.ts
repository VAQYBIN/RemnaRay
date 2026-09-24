import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { crc32 } from 'node:zlib';

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

  it('stores a safe logo override and rejects active SVG content', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rr-theme-upload-'));
    const previous = process.env.RR_THEME_UPLOAD_DIR;
    process.env.RR_THEME_UPLOAD_DIR = root;
    try {
      const instance = service();
      await expect(
        instance.uploadLogo('manta', 'brand.svg', 'image/svg+xml', Buffer.from('<svg/>')),
      ).resolves.toMatchObject({ slug: 'manta', asset: 'logo.svg' });
      expect(readFileSync(join(root, 'manta', 'overrides', 'logo.svg'), 'utf8')).toBe('<svg/>');
      expect((await instance.active()).assets.logo).toMatch(/^\/themes\/manta\/logo\.svg\?v=/u);
      await expect(
        instance.uploadLogo(
          'manta',
          'brand.svg',
          'image/svg+xml',
          Buffer.from('<svg><script>alert(1)</script></svg>'),
        ),
      ).rejects.toThrow('must not contain scripts');
    } finally {
      if (previous === undefined) delete process.env.RR_THEME_UPLOAD_DIR;
      else process.env.RR_THEME_UPLOAD_DIR = previous;
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/** A stored (uncompressed) zip, enough for the archive upload to read. */
function storedZip(files: Record<string, Buffer>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const fileName = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, fileName, data);
    centrals.push(central, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe('ThemeService SVG checks (section 19)', () => {
  let root = '';
  let previous: string | undefined;
  const withUploads = async (run: (instance: ThemeService) => Promise<void>) => {
    root = mkdtempSync(join(tmpdir(), 'rr-theme-svg-'));
    previous = process.env.RR_THEME_UPLOAD_DIR;
    process.env.RR_THEME_UPLOAD_DIR = root;
    try {
      await run(service());
    } finally {
      if (previous === undefined) delete process.env.RR_THEME_UPLOAD_DIR;
      else process.env.RR_THEME_UPLOAD_DIR = previous;
      rmSync(root, { recursive: true, force: true });
    }
  };

  it.each([
    ['a handler after a slash', '<svg/onload=alert(1)>'],
    [
      'a namespaced script',
      '<svg xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>',
    ],
    ['a javascript: link', '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>'],
    [
      'an entity-encoded javascript: link',
      '<svg><a href="jav&#x61;script&#58;alert(1)">x</a></svg>',
    ],
    ['a split javascript: link', '<svg><a href="java\tscript:alert(1)">x</a></svg>'],
    [
      'an animated href',
      '<svg><a><animate attributeName="href" values="javascript:alert(1)"/></a></svg>',
    ],
    [
      'HTML in foreignObject',
      '<svg><foreignObject><iframe src="https://evil.test"></iframe></foreignObject></svg>',
    ],
    ['an HTML data: URL', '<svg><image href="data:text/html;base64,PHNjcmlwdD4="/></svg>'],
  ])('refuses %s in a logo', async (_name, svg) => {
    await withUploads(async (instance) => {
      await expect(
        instance.uploadLogo('manta', 'brand.svg', 'image/svg+xml', Buffer.from(svg)),
      ).rejects.toThrow(/SVG/u);
      expect(existsSync(join(root, 'manta', 'overrides', 'logo.svg'))).toBe(false);
    });
  });

  it('refuses an SVG that is not UTF-8, which the text checks cannot read', async () => {
    await withUploads(async (instance) => {
      const utf16 = Buffer.from('\ufeff<svg onload="alert(1)"/>', 'utf16le');
      await expect(
        instance.uploadLogo('manta', 'brand.svg', 'image/svg+xml', utf16),
      ).rejects.toThrow(/SVG/u);
    });
  });

  it('checks the SVG files of an uploaded theme archive as well', async () => {
    await withUploads(async (instance) => {
      const manta = resolve(__dirname, '../../../../../themes/manta');
      const files: Record<string, Buffer> = {};
      for (const name of readdirSync(manta))
        files[`brand/${name}`] = readFileSync(join(manta, name));
      const manifest = JSON.parse(files['brand/theme.json']?.toString() ?? '{}') as Record<
        string,
        unknown
      >;
      files['brand/theme.json'] = Buffer.from(JSON.stringify({ ...manifest, slug: 'brand' }));

      await expect(instance.uploadArchive(storedZip(files))).resolves.toEqual({ slug: 'brand' });

      files['brand/mascot.svg'] = Buffer.from('<svg><script>alert(1)</script></svg>');
      files['brand/theme.json'] = Buffer.from(JSON.stringify({ ...manifest, slug: 'evil' }));
      await expect(instance.uploadArchive(storedZip(files))).rejects.toThrow(/SVG/u);
      expect(existsSync(join(root, 'evil'))).toBe(false);
    });
  });
});
