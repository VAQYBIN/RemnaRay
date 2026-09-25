import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The running version. The image bakes it in from the release tag
 * (`RR_APP_VERSION`, a build argument of `app.Dockerfile`); a source checkout
 * falls back to its `package.json`.
 */
export function appVersion(): string {
  if (process.env.RR_APP_VERSION) return process.env.RR_APP_VERSION;
  try {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return manifest.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const FINAL = /^(\d+)\.(\d+)\.(\d+)$/u;

/** Compares two `X.Y.Z` versions numerically; `null` when either is not one. */
export function compareVersions(left: string, right: string): number | null {
  const a = FINAL.exec(left);
  const b = FINAL.exec(right);
  if (!a || !b) return null;
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(a[index]) - Number(b[index]);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export type UpdateRelease = {
  version: string;
  url: string;
  security: boolean;
  publishedAt: string | null;
};

/**
 * Section 24.6: the newest release, whether it is newer than the running
 * version, and whether any release between the two carries the security
 * category — a fix skipped on the way is still one to take.
 */
export function updateFor(current: string, releases: UpdateRelease[]) {
  const sorted = [...releases].sort((a, b) => compareVersions(b.version, a.version) ?? 0);
  const latest = sorted[0] ?? null;
  const newer = sorted.filter((release) => (compareVersions(release.version, current) ?? 0) > 0);
  const known = compareVersions(current, current) !== null;
  return {
    current,
    latest: latest?.version ?? null,
    url: latest?.url ?? null,
    available: known && newer.length > 0,
    security: known && newer.some((release) => release.security),
  };
}
