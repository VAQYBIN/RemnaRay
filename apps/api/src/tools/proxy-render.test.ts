import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  caddyHasRateLimit,
  customFiles,
  fill,
  renderProfile,
  sourcesFrom,
  writeAtomically,
  type ProxySources,
  type TlsMode,
} from './proxy-render';

// The API compiles to CommonJS (section 6.1), so `__dirname` is the portable
// anchor here; Vitest provides it for the TypeScript source as well.
const proxyRoot = resolve(__dirname, '../../../../deploy/proxy');
const templates = resolve(proxyRoot, 'nginx');

const sources: ProxySources = {
  domain: 'shop.example.com',
  extraDomains: [],
  acmeEmail: 'ops@example.com',
  adminAllowlist: [],
  dockerCidr: '172.28.0.0/16',
  apiDocs: false,
  caddyRateLimit: true,
};

function render(tlsMode: TlsMode, overrides: Partial<ProxySources> = {}, certificate = true) {
  const files = renderProfile(
    templates,
    { ...sources, ...overrides },
    { profile: 'nginx', tlsMode, certificatePresent: certificate },
  );
  return new Map(files.map((file) => [file.name, file.content]));
}

describe('proxy template rendering (section 21.2)', () => {
  it('substitutes only `{{NAME}}` placeholders and leaves unknown ones alone', () => {
    expect(fill('a {{ONE}} b {{TWO}} c', { ONE: '1' })).toBe('a 1 b {{TWO}} c');
  });

  it('renders the whole nginx set for every TLS mode', () => {
    for (const mode of ['acme', 'certbot', 'custom'] as const) {
      const files = render(mode);
      expect([...files.keys()].sort()).toEqual(
        [
          'common-proxy.inc',
          'nginx.conf',
          'ratelimits.inc',
          'security-headers.inc',
          'site.conf',
          `tls-${mode}.inc`,
          'tls-cert.inc',
        ].sort(),
      );
      expect(files.get('nginx.conf')).toContain(`include /etc/nginx/conf.d/tls-${mode}.inc;`);
      expect(files.get('nginx.conf')).toContain('set_real_ip_from 172.28.0.0/16;');
      expect(files.get('site.conf')).toContain('server_name shop.example.com;');
      expect(files.get('site.conf')).not.toContain('{{');
      expect(files.get('nginx.conf')).not.toContain('{{');
    }
  });

  it('loads the ACME module only in `acme` mode', () => {
    expect(render('acme').get('nginx.conf')).toContain(
      'load_module modules/ngx_http_acme_module.so;',
    );
    expect(render('certbot').get('nginx.conf')).not.toContain('load_module');
    expect(render('acme').get('tls-cert.inc')).toContain('acme_certificate letsencrypt;');
    expect(render('certbot').get('tls-cert.inc')).toContain(
      '/etc/letsencrypt/live/shop.example.com/fullchain.pem',
    );
    expect(render('custom').get('tls-cert.inc')).toContain('/etc/nginx/certs/fullchain.pem');
  });

  it('renders the HTTP-only bootstrap while certbot has no certificate', () => {
    const bootstrap = render('certbot', {}, false).get('site.conf') ?? '';
    expect(bootstrap).not.toContain('listen 443');
    expect(bootstrap).toContain('/.well-known/acme-challenge/');
    expect(render('certbot', {}, true).get('site.conf')).toContain('listen 443 ssl;');
  });

  it('adds the redirect server only when there are extra domains', () => {
    expect(render('acme').get('site.conf')).not.toContain('return 301 https://shop.example.com');
    const withExtra = render('acme', { extraDomains: ['www.example.com', 'shop.example.net'] });
    expect(withExtra.get('site.conf')).toContain('server_name www.example.com shop.example.net;');
    expect(withExtra.get('site.conf')).toContain(
      'return 301 https://shop.example.com$request_uri;',
    );
    expect(withExtra.get('site.conf')).toContain(
      'server_name shop.example.com www.example.com shop.example.net;',
    );
  });

  it('renders the administration allowlist and the API docs denial', () => {
    const open = render('acme').get('site.conf') ?? '';
    expect(open).not.toContain('allow 203.0.113.0/24;');
    expect(open).toContain('location = /api/docs {\n        deny all;');

    const restricted =
      render('acme', { adminAllowlist: ['203.0.113.0/24', '198.51.100.7'], apiDocs: true }).get(
        'site.conf',
      ) ?? '';
    expect(restricted).toContain(
      '        allow 203.0.113.0/24;\n        allow 198.51.100.7;\n        deny all;',
    );
    expect(restricted).not.toContain(
      'deny all;\n        proxy_pass http://rr_api;\n    }\n    # --- the public API',
    );
  });

  it('refuses `none`, which section 21.7 reserves for the external profile', () => {
    expect(() => render('none')).toThrow(/external profile/u);
  });

  it('carries the owner`s `custom.d` files through untouched', () => {
    const files = customFiles(templates);
    expect(files.every((file) => file.name.startsWith('custom.d/'))).toBe(true);
  });
});

describe('proxy sources and atomic writes', () => {
  it('prefers the stored settings and falls back to the environment', () => {
    process.env.RR_DOMAIN = 'env.example.com';
    expect(sourcesFrom([])).toMatchObject({ domain: 'env.example.com', extraDomains: [] });
    expect(
      sourcesFrom([
        { key: 'domain.main', value: 'db.example.com' },
        { key: 'domain.extra_domains', value: ['www.example.com', 7] },
        { key: 'admin.ip_allowlist', value: ['203.0.113.0/24'] },
      ]),
    ).toMatchObject({
      domain: 'db.example.com',
      extraDomains: ['www.example.com'],
      adminAllowlist: ['203.0.113.0/24'],
    });
  });

  it('writes only what changed, and reports whether anything did', () => {
    const directory = mkdtempSync(join(tmpdir(), 'rr-proxy-'));
    try {
      const files = [{ name: 'nginx.conf', content: 'one' }];
      expect(writeAtomically(directory, files)).toBe(true);
      expect(readFileSync(resolve(directory, 'nginx.conf'), 'utf8')).toBe('one');
      expect(writeAtomically(directory, files)).toBe(false);
      expect(writeAtomically(directory, [{ name: 'nginx.conf', content: 'two' }])).toBe(true);
      expect(readFileSync(resolve(directory, 'nginx.conf'), 'utf8')).toBe('two');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function renderCaddy(tlsMode: TlsMode, overrides: Partial<ProxySources> = {}) {
  const files = renderProfile(
    resolve(proxyRoot, 'caddy'),
    { ...sources, ...overrides },
    { profile: 'caddy', tlsMode, certificatePresent: true },
  );
  return files.find((file) => file.name === 'Caddyfile')?.content ?? '';
}

describe('Caddy template rendering (section 21.4)', () => {
  it('renders one Caddyfile with every placeholder resolved', () => {
    const caddyfile = renderCaddy('acme');

    expect(caddyfile).not.toContain('{{');
    expect(caddyfile).toContain('email ops@example.com');
    expect(caddyfile).toContain('trusted_proxies static 172.28.0.0/16');
    expect(caddyfile).toContain('shop.example.com {');
    expect(caddyfile).toContain('reverse_proxy api:3000');
    expect(caddyfile).toContain('respond @webhooks_bad_method 405');
  });

  it('carries the rate-limit zones only when the image has the module', () => {
    const withModule = renderCaddy('acme');
    expect(withModule).toContain('order rate_limit before basicauth');
    for (const zone of ['rr_webhooks', 'rr_auth', 'rr_admin', 'rr_api', 'rr_general'])
      expect(withModule).toContain(`zone ${zone} {`);

    const stock = renderCaddy('acme', { caddyRateLimit: false });
    expect(stock).not.toContain('rate_limit');
    expect(stock).not.toContain('order rate_limit');
  });

  it('knows which image carries `caddy-ratelimit`', () => {
    expect(caddyHasRateLimit('ghcr.io/remnaray/caddy:1')).toBe(true);
    expect(caddyHasRateLimit(undefined)).toBe(true);
    expect(caddyHasRateLimit('caddy:2-alpine')).toBe(false);
    expect(caddyHasRateLimit('docker.io/library/caddy:2')).toBe(false);
  });

  it('names the owner`s certificate only in `custom` mode, and refuses certbot', () => {
    expect(renderCaddy('acme')).not.toContain('tls /certs');
    expect(renderCaddy('custom')).toContain('tls /certs/fullchain.pem /certs/privkey.pem');
    expect(() => renderCaddy('certbot')).toThrow(/certbot is not supported/u);
  });

  it('adds the redirect site and the administration allowlist only when they apply', () => {
    expect(renderCaddy('acme')).not.toContain('redir https://shop.example.com');
    expect(renderCaddy('acme')).toContain('respond /api/docs 404');

    const restricted = renderCaddy('acme', {
      extraDomains: ['www.example.com', 'shop.example.net'],
      adminAllowlist: ['203.0.113.0/24'],
      apiDocs: true,
    });
    expect(restricted).toContain('www.example.com, shop.example.net {');
    expect(restricted).toContain('redir https://shop.example.com{uri} permanent');
    expect(restricted).toContain('@rr_denied not client_ip 203.0.113.0/24');
    expect(restricted).not.toContain('respond /api/docs 404');
  });
});
