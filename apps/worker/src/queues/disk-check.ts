import { statfsSync } from 'node:fs';

export type DiskStatus = {
  available: boolean;
  totalBytes: number;
  freeBytes: number;
  error?: string;
};

/**
 * Section 20.3 `maintenance.disk-check`: the filesystem holding the database
 * volume, mounted read-only into the worker. `statfs` needs no access to the
 * files, which stay the `postgres` user's. Free is what `df` calls available:
 * the blocks an unprivileged writer may still use.
 */
export function diskStatus(path: string): DiskStatus {
  try {
    const stats = statfsSync(path);
    return {
      available: true,
      totalBytes: stats.blocks * stats.bsize,
      freeBytes: stats.bavail * stats.bsize,
    };
  } catch (error) {
    return {
      available: false,
      totalBytes: 0,
      freeBytes: 0,
      error: (error as NodeJS.ErrnoException).code ?? String(error).slice(0, 200),
    };
  }
}
