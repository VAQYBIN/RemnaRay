import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as yauzl from 'yauzl';
import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

import { themeSchema, type Theme, type ThemeTokens } from '@remnaray/theme-schema';

import { SettingsService } from '../settings/settings.service';

export const THEME_CHANGED_CHANNEL = 'rr:theme.changed';

export type { ThemeTokens };

type CacheEntry = { tokens: ThemeTokens; fingerprint: string };

function themeRoots(): string[] {
  return [
    process.env.RR_THEMES_DIR,
    '/themes',
    resolve(process.cwd(), 'themes'),
    resolve(process.cwd(), '..', '..', 'themes'),
  ].filter((value): value is string => Boolean(value));
}

function uploadRoot(): string {
  return process.env.RR_THEME_UPLOAD_DIR ?? '/uploads/themes';
}

/** Resolves the mounted `themes/` directory (compose mounts it read-only at `/themes`). */
export function themeDirectory(): string {
  return themeRoots().find((candidate) => existsSync(candidate)) ?? '/themes';
}

@Injectable()
export class ThemeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThemeService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private subscriber: Redis | undefined;

  constructor(private readonly settings: SettingsService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.load(await this.activeSlug());
    } catch (error) {
      this.logger.warn(`Active theme is not loadable yet: ${String(error)}`);
    }
    this.subscriber = new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    try {
      await this.subscriber.subscribe(THEME_CHANGED_CHANNEL);
      this.subscriber.on('message', (channel) => {
        if (channel === THEME_CHANGED_CHANNEL) this.cache.clear();
      });
    } catch (error) {
      this.logger.warn(`Theme change subscription unavailable: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  /** Scans the mounted directory so a new theme is visible without a restart (18.3). */
  list(): { slug: string; name: string; brandName: string; builtin: boolean }[] {
    const roots = [themeDirectory(), uploadRoot()].filter(
      (root, index, all) => existsSync(root) && all.indexOf(root) === index,
    );
    const slugs = new Set(
      roots.flatMap((root) =>
        readdirSync(root, { withFileTypes: true })
          .filter(
            (entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, 'theme.json')),
          )
          .map((entry) => entry.name),
      ),
    );
    return [...slugs]
      .flatMap((entry) => {
        try {
          const theme = this.read(entry).theme;
          return [
            {
              slug: theme.slug,
              name: theme.name,
              brandName: theme.brand.name,
              builtin: theme.slug === '_admin',
            },
          ];
        } catch (error) {
          this.logger.warn(`Skipping invalid theme ${entry}: ${String(error)}`);
          return [];
        }
      })
      .sort((left, right) => left.slug.localeCompare(right.slug));
  }

  async activeSlug(): Promise<string> {
    return String(await this.settings.get('theme.slug'));
  }

  async active(): Promise<ThemeTokens> {
    return this.load(await this.activeSlug());
  }

  load(slug: string): ThemeTokens {
    if (!/^(?:_admin|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(slug))
      throw new NotFoundException('NOT_FOUND');
    const { theme, fingerprint } = this.read(slug);
    const cached = this.cache.get(slug);
    if (cached && cached.fingerprint === fingerprint) return cached.tokens;

    const version = fingerprint.slice(0, 12);
    const assets: Record<string, string> = {};
    const url = (file: string) => this.assetUrl(theme.slug, file, version);
    assets['logo'] = url(theme.assets.logo);
    assets['logoDark'] = url(theme.assets.logoDark);
    assets['mark'] = url(theme.assets.mark);
    assets['mascot'] = url(theme.assets.mascot.default);
    assets['mascotEmpty'] = url(theme.assets.mascot.empty);
    assets['mascotError'] = url(theme.assets.mascot.error);
    assets['mascotSuccess'] = url(theme.assets.mascot.success);
    assets['og'] = url(theme.assets.og);
    assets['favicon'] = url(theme.assets.favicon);
    assets['appleTouchIcon'] = url(theme.assets.appleTouchIcon);
    assets['botAvatar'] = url(theme.assets.botAvatar);

    const tokens: ThemeTokens = {
      slug: theme.slug,
      name: theme.name,
      version: theme.version,
      brand: theme.brand,
      colors: theme.colors,
      typography: theme.typography,
      radius: theme.radius,
      landing: theme.landing,
      assets,
      etag: `"${version}"`,
    };
    this.cache.set(slug, { tokens, fingerprint });
    return tokens;
  }

  /** Absolute path of a theme asset, used by the bot for `botAvatar`. */
  assetPath(slug: string, file: string): string | null {
    const path = this.assetFile(slug, file);
    return existsSync(path) ? path : null;
  }

  async uploadLogo(slug: string, filename: string, mimetype: string, contents: Buffer) {
    if (!/^(?:_admin|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(slug))
      throw new NotFoundException('NOT_FOUND');
    if (!['image/png', 'image/svg+xml'].includes(mimetype))
      throw new Error('Only PNG and SVG logos are supported');
    if (contents.length === 0 || contents.length > 10 * 1024 * 1024)
      throw new Error('Logo is empty or too large');
    if (
      mimetype === 'image/svg+xml' &&
      /<script\b|\son[a-z]+\s*=/iu.test(contents.toString('utf8'))
    )
      throw new Error('SVG must not contain scripts or event handlers');

    // The filename is accepted only as metadata; it never controls a path.
    const extension = mimetype === 'image/png' ? '.png' : '.svg';
    const directory = resolve(uploadRoot(), slug, 'overrides');
    await mkdir(directory, { recursive: true });
    const target = resolve(directory, `logo${extension}`);
    const temporary = resolve(directory, `.logo-${randomUUID()}.tmp`);
    await writeFile(temporary, contents, { mode: 0o600 });
    await rename(temporary, target);
    this.cache.delete(slug);
    return { slug, asset: basename(target), filename: filename.slice(0, 200) };
  }

  async uploadArchive(contents: Buffer) {
    if (contents.length === 0 || contents.length > 10 * 1024 * 1024)
      throw new Error('Theme archive is empty or too large');
    const temporary = resolve(uploadRoot(), `.theme-${randomUUID()}`);
    await mkdir(temporary, { recursive: true });
    let entries = 0;
    let totalBytes = 0;
    try {
      const zip = await yauzl.fromBufferPromise(contents, {
        lazyEntries: true,
        validateEntrySizes: true,
      });
      try {
        for await (const entry of zip.eachEntry()) {
          const name = entry.fileName.replaceAll('\\', '/');
          const parts = name.split('/').filter(Boolean);
          if (parts.length === 0 || name.startsWith('/') || parts.includes('..'))
            throw new Error('Theme archive contains an unsafe path');
          if (name.endsWith('/')) continue;
          entries += 1;
          totalBytes += entry.uncompressedSize;
          if (entries > 100 || totalBytes > 50 * 1024 * 1024)
            throw new Error('Theme archive is too large');
          const target = resolve(temporary, ...parts);
          await mkdir(dirname(target), { recursive: true });
          await pipeline(await zip.openReadStreamPromise(entry), createWriteStream(target));
        }
      } finally {
        zip.close();
      }

      const directManifest = resolve(temporary, 'theme.json');
      const directories = readdirSync(temporary, { withFileTypes: true }).filter((entry) =>
        entry.isDirectory(),
      );
      const source = existsSync(directManifest)
        ? temporary
        : directories.length === 1 &&
            directories[0] &&
            existsSync(resolve(temporary, directories[0].name, 'theme.json'))
          ? resolve(temporary, directories[0].name)
          : '';
      if (!source) throw new Error('Theme archive must contain theme.json');
      const theme = themeSchema.parse(
        JSON.parse(readFileSync(resolve(source, 'theme.json'), 'utf8')),
      );
      if (theme.slug === '_admin') throw new Error('The admin theme cannot be uploaded');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme.slug)) throw new Error('Theme slug is invalid');
      this.validateThemeFiles(source, theme);

      const target = resolve(uploadRoot(), theme.slug);
      await rm(target, { recursive: true, force: true });
      await rename(source, target);
      if (source !== temporary) await rm(temporary, { recursive: true, force: true });
      this.cache.delete(theme.slug);
      return { slug: theme.slug };
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  private read(slug: string): { theme: Theme; fingerprint: string } {
    const directory = this.themeRoot(slug);
    const manifest = resolve(directory, 'theme.json');
    if (!existsSync(manifest)) throw new NotFoundException('NOT_FOUND');
    const raw = readFileSync(manifest, 'utf8');
    const theme = themeSchema.parse(JSON.parse(raw));
    const hash = createHash('sha256').update(raw);
    for (const file of [
      theme.assets.logo,
      theme.assets.logoDark,
      theme.assets.mark,
      theme.assets.mascot.default,
      theme.assets.mascot.empty,
      theme.assets.mascot.error,
      theme.assets.mascot.success,
      theme.assets.og,
      theme.assets.favicon,
      theme.assets.appleTouchIcon,
      theme.assets.botAvatar,
    ]) {
      const path = this.assetFile(slug, file);
      if (!existsSync(path)) throw new Error(`Missing theme asset: ${file}`);
      const stat = statSync(path);
      hash.update(`${file}:${stat.size.toString()}:${stat.mtimeMs.toString()}`);
    }
    return { theme, fingerprint: hash.digest('hex') };
  }

  private assetFile(slug: string, declared: string): string {
    const override = resolve(uploadRoot(), slug, 'overrides');
    if (declared === 'logo.svg' || declared === 'logo.png') {
      for (const candidate of [declared, 'logo.svg', 'logo.png']) {
        const path = resolve(override, candidate);
        if (existsSync(path)) return path;
      }
    }
    return resolve(this.themeRoot(slug), declared);
  }

  private themeRoot(slug: string): string {
    const uploaded = resolve(uploadRoot(), slug);
    return existsSync(resolve(uploaded, 'theme.json')) ? uploaded : resolve(themeDirectory(), slug);
  }

  private validateThemeFiles(directory: string, theme: Theme) {
    for (const file of [
      theme.assets.logo,
      theme.assets.logoDark,
      theme.assets.mark,
      theme.assets.mascot.default,
      theme.assets.mascot.empty,
      theme.assets.mascot.error,
      theme.assets.mascot.success,
      theme.assets.og,
      theme.assets.favicon,
      theme.assets.appleTouchIcon,
      theme.assets.botAvatar,
    ]) {
      if (!existsSync(resolve(directory, file))) throw new Error(`Missing theme asset: ${file}`);
    }
  }

  assetUrl(slug: string, declared: string, version: string): string {
    const actual = this.assetFile(slug, declared);
    const overridePrefix = `${resolve(uploadRoot(), slug)}/`;
    const file = actual.startsWith(overridePrefix) ? basename(actual) : declared;
    return `/themes/${slug}/${file}?v=${version}`;
  }
}
