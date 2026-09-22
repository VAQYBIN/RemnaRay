/**
 * Section 21.6: the only container with the docker socket. It applies a
 * rendered configuration when `rr:proxy.reload` arrives and when certbot drops
 * its deploy flag, and reports the outcome so it lands in `audit_log`.
 *
 * nginx is validated first: a configuration that fails `nginx -t` is never
 * applied, the previous one keeps serving and an alert is raised.
 */
import { watch, rmSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import Redis from 'ioredis';

import { dockerAgent, dockerExec, type ExecResult } from './docker-exec';

const RELOAD_CHANNEL = 'rr:proxy.reload';
const CERTBOT_FLAG_DIRECTORY = '/run/remnaray/certbot';
const CERTBOT_FLAG = '.renewed';

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

export function reloadCommands(profile: string): string[][] {
  return profile === 'caddy'
    ? [['caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']]
    : [
        ['nginx', '-t', '-c', '/etc/nginx/conf.d/nginx.conf'],
        ['nginx', '-c', '/etc/nginx/conf.d/nginx.conf', '-s', 'reload'],
      ];
}

async function report(ok: boolean, error: string | undefined): Promise<void> {
  const base = process.env.RR_API_URL ?? process.env.INTERNAL_API_URL ?? 'http://api:3000';
  try {
    await fetch(`${base}/api/internal/v1/system/proxy-reload-result`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': process.env.RR_INTERNAL_TOKEN ?? '',
      },
      body: JSON.stringify({ ok, ...(error ? { error: error.slice(0, 500) } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    process.stderr.write(`Proxy reload result not recorded: ${String(cause)}\n`);
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes('--reload')) rmSync('/tmp/proxy-reloader-ready', { force: true });
  const profile = flag('profile', process.env.RR_PROXY_PROFILE ?? 'nginx');
  const container =
    process.env.RR_PROXY_CONTAINER ??
    (profile === 'caddy' ? 'remnaray-proxy-caddy-1' : 'remnaray-proxy-nginx-1');
  const agent = dockerAgent(process.env.DOCKER_SOCKET ?? '/var/run/docker.sock');
  let running = false;

  const reload = async (reason: string): Promise<void> => {
    if (running) return;
    running = true;
    try {
      let last: ExecResult = { exitCode: 0, output: '' };
      for (const command of reloadCommands(profile)) {
        last = await dockerExec(container, command, agent);
        if (last.exitCode !== 0) break;
      }
      const ok = last.exitCode === 0;
      process.stdout.write(`${reason}: ${ok ? 'reloaded' : 'refused'} ${last.output}\n`);
      await report(ok, ok ? undefined : last.output);
      if (!ok && process.argv.includes('--reload')) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`Proxy reload failed: ${String(error)}\n`);
      await report(false, String(error));
      if (process.argv.includes('--reload')) process.exitCode = 1;
    } finally {
      running = false;
    }
  };

  if (process.argv.includes('--reload')) {
    await reload('manual');
    await agent.destroy();
    return;
  }

  const subscriber = new Redis(process.env.VALKEY_URL ?? 'redis://valkey:6379/0', {
    maxRetriesPerRequest: null,
  });
  await subscriber.subscribe(RELOAD_CHANNEL);
  subscriber.on('message', (channel) => {
    if (channel === RELOAD_CHANNEL) void reload(RELOAD_CHANNEL);
  });

  // certbot's `--deploy-hook` touches this file after a renewal; a graceful
  // reload then picks the new certificate up without dropping a connection.
  try {
    watch(CERTBOT_FLAG_DIRECTORY, (_event, filename) => {
      if (filename === CERTBOT_FLAG) void reload('certbot renewal');
    });
  } catch {
    process.stdout.write('certbot flag directory is not mounted; watching Pub/Sub only\n');
  }

  writeFileSync('/tmp/proxy-reloader-ready', 'ready\n');
  process.stdout.write(`watching ${RELOAD_CHANNEL} for ${container}\n`);
}

void main();
