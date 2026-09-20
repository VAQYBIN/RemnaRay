import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export type BackupStatus = {
  ok: boolean;
  state: string;
  at: string | null;
  file: string | null;
  sizeBytes: number;
  ageHours: number | null;
};

/** Section 20.5 writes one line: `<state> <iso8601> <file> <bytes>`. */
export function parseStatusLine(line: string): Omit<BackupStatus, 'ok' | 'ageHours'> {
  const [state, at, file, size] = line.trim().split(/\s+/u);
  return {
    state: state ?? 'unknown',
    at: at && at !== '-' ? at : null,
    file: file && file !== '-' ? file : null,
    sizeBytes: Number(size ?? 0) || 0,
  };
}

/** Section 20.3: a backup older than 26 hours counts as missing. */
export const BACKUP_MAX_AGE_HOURS = 26;

export function backupStatus(directory: string): BackupStatus {
  const file = resolve(directory, '.last-status');
  if (!existsSync(file))
    return { ok: false, state: 'missing', at: null, file: null, sizeBytes: 0, ageHours: null };

  const parsed = parseStatusLine(readFileSync(file, 'utf8'));
  const writtenAt = parsed.at ? Date.parse(parsed.at) : statSync(file).mtimeMs;
  const ageHours = Number.isNaN(writtenAt) ? null : (Date.now() - writtenAt) / 3_600_000;
  return {
    ...parsed,
    ageHours,
    ok: parsed.state === 'ok' && ageHours !== null && ageHours <= BACKUP_MAX_AGE_HOURS,
  };
}
