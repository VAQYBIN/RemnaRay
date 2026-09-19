import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
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
    const root = themeDirectory();
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, 'theme.json')))
      .flatMap((entry) => {
        try {
          const theme = this.read(entry.name).theme;
          return [
            {
              slug: theme.slug,
              name: theme.name,
              brandName: theme.brand.name,
              builtin: theme.slug === '_admin',
            },
          ];
        } catch (error) {
          this.logger.warn(`Skipping invalid theme ${entry.name}: ${String(error)}`);
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
    const url = (file: string) => `/themes/${theme.slug}/${file}?v=${version}`;
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
    const path = resolve(themeDirectory(), slug, file);
    return existsSync(path) ? path : null;
  }

  private read(slug: string): { theme: Theme; fingerprint: string } {
    const directory = resolve(themeDirectory(), slug);
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
      const path = resolve(directory, file);
      if (!existsSync(path)) throw new Error(`Missing theme asset: ${file}`);
      const stat = statSync(path);
      hash.update(`${file}:${stat.size.toString()}:${stat.mtimeMs.toString()}`);
    }
    return { theme, fingerprint: hash.digest('hex') };
  }
}
