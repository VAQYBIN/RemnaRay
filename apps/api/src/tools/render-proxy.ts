/**
 * `proxy-config` (section 21.2): renders `deploy/proxy/<profile>` into the
 * shared `proxy-conf` volume, atomically, and asks `proxy-reloader` to apply
 * it. With `--watch` it re-renders on `rr:settings.changed` and publishes
 * `rr:proxy.reload` only when the output actually changed.
 */
import { resolve } from 'node:path';
import process from 'node:process';
import { createPrismaClient } from '@remnaray/db';
import Redis from 'ioredis';

import {
  PROXY_PROFILES,
  PROXY_SETTING_KEYS,
  TLS_MODES,
  certbotCertificatePresent,
  customFiles,
  renderProfile,
  sourcesFrom,
  writeAtomically,
  type ProxyProfile,
  type TlsMode,
} from './proxy-render';

const SETTINGS_CHANNEL = 'rr:settings.changed';
const RELOAD_CHANNEL = 'rr:proxy.reload';

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

async function main(): Promise<void> {
  const profile = flag('profile', process.env.RR_PROXY_PROFILE ?? 'nginx');
  const tlsMode = flag('tls', process.env.RR_TLS_MODE ?? 'acme');
  const templates = flag('templates', '/templates');
  const output = flag('out', '/proxy-conf');
  const watch = process.argv.includes('--watch');

  if (!PROXY_PROFILES.includes(profile as ProxyProfile)) {
    process.stderr.write(`Unsupported proxy profile: ${profile}\n`);
    process.exitCode = 1;
    return;
  }
  if (!TLS_MODES.includes(tlsMode as TlsMode)) {
    process.stderr.write(`Unsupported TLS mode: ${tlsMode}\n`);
    process.exitCode = 1;
    return;
  }

  const directory = resolve(templates, profile);
  const db = createPrismaClient();
  const valkeyUrl = process.env.VALKEY_URL ?? 'redis://valkey:6379/0';
  const publisher = new Redis(valkeyUrl, { maxRetriesPerRequest: null });

  const render = async (announce: boolean): Promise<void> => {
    const rows = await db.setting.findMany({ where: { key: { in: PROXY_SETTING_KEYS } } });
    const sources = sourcesFrom(rows);
    const files = [
      ...renderProfile(directory, sources, {
        profile: profile as ProxyProfile,
        tlsMode: tlsMode as TlsMode,
        certificatePresent: certbotCertificatePresent(process.env.RR_CERTBOT_STATE_DIR),
      }),
      ...customFiles(directory),
      { name: '.profile-ready', content: `${profile}\n` },
    ];
    const changed = writeAtomically(output, files);
    process.stdout.write(
      `${changed ? 'rendered' : 'unchanged'} ${profile}/${tlsMode} for ${sources.domain}\n`,
    );
    if (changed && announce)
      await publisher.publish(RELOAD_CHANNEL, JSON.stringify({ at: Date.now() }));
  };

  await render(false);

  if (!watch) {
    await publisher.quit();
    await db.$disconnect();
    return;
  }

  const subscriber = new Redis(valkeyUrl, { maxRetriesPerRequest: null });
  await subscriber.subscribe(SETTINGS_CHANNEL);
  subscriber.on('message', (channel) => {
    if (channel !== SETTINGS_CHANNEL) return;
    void render(true).catch((error: unknown) => {
      process.stderr.write(`Proxy render failed: ${String(error)}\n`);
    });
  });
  process.stdout.write(`watching ${SETTINGS_CHANNEL}\n`);
}

void main();
