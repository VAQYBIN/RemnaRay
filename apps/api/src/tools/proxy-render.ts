import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

export const TLS_MODES = ['acme', 'certbot', 'custom', 'none'] as const;
export type TlsMode = (typeof TLS_MODES)[number];
export const PROXY_PROFILES = ['nginx', 'caddy'] as const;
export type ProxyProfile = (typeof PROXY_PROFILES)[number];

export type ProxySources = {
  domain: string;
  extraDomains: string[];
  acmeEmail: string;
  adminAllowlist: string[];
  dockerCidr: string;
  apiDocs: boolean;
};

export type RenderOptions = {
  profile: ProxyProfile;
  tlsMode: TlsMode;
  /** `certbot` renders an HTTP-only bootstrap until the certificate exists. */
  certificatePresent: boolean;
};

export type RenderedFile = { name: string; content: string };

/** Section 21.2 replaces `{{NAME}}` placeholders; nothing else is interpreted. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{\{([A-Z0-9_]+)\}\}/gu, (match, name: string) =>
    name in values ? (values[name] ?? '') : match,
  );
}

function indentedBlock(lines: string[], indent: string): string {
  return lines.map((line) => `${indent}${line}`).join('\n');
}

export function placeholders(
  sources: ProxySources,
  options: RenderOptions,
): Record<string, string> {
  const extra = sources.extraDomains.join(' ');
  const allowlist =
    sources.adminAllowlist.length > 0
      ? indentedBlock(
          [...sources.adminAllowlist.map((cidr) => `allow ${cidr};`), 'deny all;'],
          '        ',
        )
      : '';
  return {
    DOMAIN: sources.domain,
    EXTRA_DOMAINS: extra,
    EXTRA_DOMAINS_SUFFIX: extra ? ` ${extra}` : '',
    ACME_EMAIL: sources.acmeEmail,
    TLS_MODE: options.tlsMode,
    DOCKER_CIDR: sources.dockerCidr,
    ADMIN_ALLOWLIST: sources.adminAllowlist.join(' '),
    ADMIN_ALLOWLIST_BLOCK: allowlist,
    API_DOCS_BLOCK: sources.apiDocs ? '' : indentedBlock(['deny all;'], '        '),
    LOAD_MODULE_BLOCK:
      options.tlsMode === 'acme' ? 'load_module modules/ngx_http_acme_module.so;\n' : '',
  };
}

/**
 * The redirect server for `extra_domains` only exists when there are any: an
 * empty `server_name` would make nginx answer every unmatched host with a
 * redirect to the main domain.
 */
function extraDomainsServer(values: Record<string, string>): string {
  const extra = values['EXTRA_DOMAINS'] ?? '';
  const domain = values['DOMAIN'] ?? '';
  if (!extra) return '';
  return `# ---------- additional domains redirect to the main one ----------
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${extra};
    include /etc/nginx/conf.d/tls-cert.inc;
    return 301 https://${domain}$request_uri;
}
`;
}

function readTemplate(directory: string, name: string): string {
  return readFileSync(resolve(directory, name), 'utf8');
}

/**
 * Renders one profile from `deploy/proxy/<profile>`. Templates end in `.tmpl`
 * and lose that suffix; `*.inc` files without it are copied verbatim, which is
 * what section 21.2 calls the shared includes.
 */
export function renderProfile(
  directory: string,
  sources: ProxySources,
  options: RenderOptions,
): RenderedFile[] {
  if (!existsSync(directory)) throw new Error(`No proxy templates for profile ${options.profile}`);
  if (options.tlsMode === 'none' && options.profile !== 'caddy')
    throw new Error('RR_TLS_MODE=none is only valid with the external profile');

  const values = placeholders(sources, options);
  values['EXTRA_DOMAINS_SERVER'] = extraDomainsServer(values);

  const files: RenderedFile[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.inc')) continue;
    files.push({ name: entry.name, content: readTemplate(directory, entry.name) });
  }

  if (options.profile === 'nginx') {
    const site =
      options.tlsMode === 'certbot' && !options.certificatePresent
        ? 'site-bootstrap.conf.tmpl'
        : 'site.conf.tmpl';
    files.push(
      { name: 'nginx.conf', content: fill(readTemplate(directory, 'nginx.conf.tmpl'), values) },
      { name: 'site.conf', content: fill(readTemplate(directory, site), values) },
      {
        name: `tls-${options.tlsMode}.inc`,
        content: fill(readTemplate(directory, `tls-${options.tlsMode}.inc.tmpl`), values),
      },
      {
        name: 'tls-cert.inc',
        content: fill(readTemplate(directory, `tls-cert-${options.tlsMode}.inc.tmpl`), values),
      },
    );
    return files;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tmpl')) continue;
    files.push({
      name: entry.name.slice(0, -'.tmpl'.length),
      content: fill(readTemplate(directory, entry.name), values),
    });
  }
  if (files.length === 0) throw new Error(`No proxy templates for profile ${options.profile}`);
  return files;
}

/** `custom.d/*.conf` is the owner's extension point and is never rewritten. */
export function customFiles(directory: string): RenderedFile[] {
  const custom = resolve(directory, 'custom.d');
  if (!existsSync(custom)) return [];
  return readdirSync(custom, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.conf'))
    .map((entry) => ({
      name: `custom.d/${entry.name}`,
      content: readFileSync(resolve(custom, entry.name), 'utf8'),
    }));
}

type SettingRow = { key: string; value: unknown };

function settingValue(rows: SettingRow[], key: string): unknown {
  return rows.find((row) => row.key === key)?.value;
}

function stringOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function listOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * Section 21.2 names the sources: `settings.domain.*`,
 * `settings.admin.ip_allowlist` and `.env`. Only non-secret keys are read, so
 * no decryption key is needed in the renderer.
 */
export function sourcesFrom(rows: SettingRow[]): ProxySources {
  return {
    domain: stringOf(settingValue(rows, 'domain.main'), process.env.RR_DOMAIN ?? 'localhost'),
    acmeEmail: stringOf(settingValue(rows, 'domain.acme_email'), process.env.RR_ACME_EMAIL ?? ''),
    extraDomains: listOf(settingValue(rows, 'domain.extra_domains')),
    adminAllowlist: listOf(settingValue(rows, 'admin.ip_allowlist')),
    dockerCidr: process.env.RR_DOCKER_CIDR ?? '172.28.0.0/16',
    apiDocs: process.env.RR_API_DOCS === 'true',
  };
}

export const PROXY_SETTING_KEYS = [
  'domain.main',
  'domain.acme_email',
  'domain.extra_domains',
  'admin.ip_allowlist',
];

/** `tmp` + `rename`, so nginx never reads a half-written file (section 21.2). */
export function writeAtomically(outputDirectory: string, files: RenderedFile[]): boolean {
  let changed = false;
  for (const file of files) {
    const target = resolve(outputDirectory, file.name);
    mkdirSync(dirname(target), { recursive: true });
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current === file.content) continue;
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, file.content, 'utf8');
    renameSync(temporary, target);
    changed = true;
  }
  return changed;
}
