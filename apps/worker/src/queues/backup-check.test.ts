import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { backupStatus, BACKUP_MAX_AGE_HOURS, parseStatusLine } from './backup-check';

function directoryWith(line: string | null): string {
  const root = mkdtempSync(join(tmpdir(), 'rr-backup-status-'));
  if (line !== null) writeFileSync(resolve(root, '.last-status'), line, 'utf8');
  return root;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

describe('maintenance.backup-check (section 20.3)', () => {
  it('reads the one line the backup container writes', () => {
    expect(parseStatusLine('ok 2026-09-20T03:00:00Z remnaray-20260920-0300.dump 4096\n')).toEqual({
      state: 'ok',
      at: '2026-09-20T03:00:00Z',
      file: 'remnaray-20260920-0300.dump',
      sizeBytes: 4096,
    });
    expect(parseStatusLine('failed 2026-09-20T03:00:00Z - 0')).toMatchObject({
      state: 'failed',
      file: null,
      sizeBytes: 0,
    });
  });

  it('treats a missing, failed or stale backup as not ok', () => {
    const missing = directoryWith(null);
    const fresh = directoryWith(`ok ${hoursAgo(2)} remnaray-x.dump 4096`);
    const stale = directoryWith(`ok ${hoursAgo(BACKUP_MAX_AGE_HOURS + 1)} remnaray-x.dump 4096`);
    const failed = directoryWith(`failed ${hoursAgo(1)} - 0`);
    try {
      expect(backupStatus(missing)).toMatchObject({ ok: false, state: 'missing' });
      expect(backupStatus(fresh)).toMatchObject({ ok: true, state: 'ok', sizeBytes: 4096 });
      expect(backupStatus(stale).ok).toBe(false);
      expect(backupStatus(stale).ageHours).toBeGreaterThan(BACKUP_MAX_AGE_HOURS);
      expect(backupStatus(failed)).toMatchObject({ ok: false, state: 'failed' });
    } finally {
      for (const root of [missing, fresh, stale, failed])
        rmSync(root, { recursive: true, force: true });
    }
  });
});
