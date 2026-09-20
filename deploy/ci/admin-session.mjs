/**
 * Step 9 of section 22.7 changes a setting "through the API", and the
 * administration API of section 9.2 is behind a password and a TOTP code. This
 * opens that session and prints it as shell assignments:
 *
 *   eval "$(node deploy/ci/admin-session.mjs https://rr.test owner@example.test pw)"
 *   # ADMIN_SESSION=<rr_asid>  ADMIN_CSRF=<token>
 *
 * The TOTP secret comes from `RR_SMOKE_TOTP_SECRET`, or from the stand fixture
 * `seed-dev` wrote. With
 * `--resolve <ip>` the request is sent to that address and the certificate is
 * not verified, which is what a self-signed stand needs and a real domain
 * must not get.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { request } from 'node:https';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { TOTP, Secret } from 'otpauth';

const [baseUrl, email, password] = process.argv.slice(2);
if (!baseUrl || !email || !password) {
  process.stderr.write('usage: admin-session.mjs <baseUrl> <email> <password> [--resolve <ip>]\n');
  process.exit(2);
}
const resolveIndex = process.argv.indexOf('--resolve');
const resolveTo = resolveIndex > 0 ? process.argv[resolveIndex + 1] : undefined;
// Against a live deployment there is no seeded fixture to read, so the secret
// is named directly; on a stand it comes from what `seed-dev` printed.
const totpSecret =
  process.env.RR_SMOKE_TOTP_SECRET ??
  JSON.parse(readFileSync(process.env.RR_SMOKE_STAND_FILE ?? 'deploy/ci/.stand.json', 'utf8')).admin
    .totpSecret;

const origin = new URL(baseUrl);

function post(path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const call = request(
      {
        host: origin.hostname,
        port: origin.port || 443,
        path,
        method: 'POST',
        // Section 19.3: an administration mutation needs both of these, and a
        // client that cannot send them is not a browser on the same origin.
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          'x-requested-with': 'RemnaRay',
          'sec-fetch-site': 'same-origin',
          origin: origin.origin,
          ...(cookie ? { cookie } : {}),
        },
        ...(resolveTo
          ? {
              rejectUnauthorized: false,
              // Node asks for every address when it selects the family
              // itself, which it does by default; then the answer is a list.
              lookup: (_hostname, options, done) => {
                if (options.all) done(null, [{ address: resolveTo, family: 4 }]);
                else done(null, resolveTo, 4);
              },
            }
          : {}),
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (response.statusCode !== 200)
            reject(new Error(`POST ${path} → ${String(response.statusCode)}: ${text}`));
          else resolve({ body: JSON.parse(text), headers: response.headers });
        });
      },
    );
    call.on('error', reject);
    call.end(payload);
  });
}

/**
 * A code may be redeemed once (`rr:admin:totp:<id>:<counter>`), and the browser
 * suite of step 10 signs in moments after this does. Both record the period
 * they spent in the same file, so neither presents a code the other used.
 */
const PERIOD_SECONDS = 30;
const periodFile = process.env.RR_E2E_TOTP_PERIOD_FILE ?? 'e2e/.auth/totp-period';

function readSpentPeriod() {
  try {
    return Number.parseInt(readFileSync(periodFile, 'utf8'), 10);
  } catch {
    return -1;
  }
}

async function freshPeriod() {
  const spent = readSpentPeriod();
  let period = Math.floor(Date.now() / (PERIOD_SECONDS * 1000));
  while (period === spent) {
    await sleep(1000);
    period = Math.floor(Date.now() / (PERIOD_SECONDS * 1000));
  }
  mkdirSync(dirname(periodFile), { recursive: true });
  writeFileSync(periodFile, String(period), 'utf8');
}

const login = await post('/api/admin/v1/auth/login', { email, password });
const totp = new TOTP({
  issuer: 'RemnaRay',
  label: email,
  algorithm: 'SHA1',
  digits: 6,
  period: PERIOD_SECONDS,
  secret: Secret.fromBase32(totpSecret),
});
await freshPeriod();
const verified = await post('/api/admin/v1/auth/totp', {
  challengeId: login.body.challengeId,
  code: totp.generate(),
});

const setCookie = [verified.headers['set-cookie'] ?? []].flat().join('; ');
const session = /rr_asid=([^;]+)/u.exec(setCookie)?.[1];
if (!session) throw new Error('The TOTP step returned no rr_asid cookie');

process.stdout.write(`ADMIN_SESSION='${decodeURIComponent(session)}'\n`);
process.stdout.write(`ADMIN_CSRF='${verified.body.csrfToken}'\n`);
