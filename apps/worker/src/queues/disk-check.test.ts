import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { diskStatus } from './disk-check';

describe('section 20.3 disk check', () => {
  it('reads the size and the space left of the filesystem holding the path', () => {
    const status = diskStatus(mkdtempSync(join(tmpdir(), 'rr-disk-')));
    expect(status.available).toBe(true);
    expect(status.totalBytes).toBeGreaterThan(0);
    expect(status.freeBytes).toBeGreaterThanOrEqual(0);
    expect(status.freeBytes).toBeLessThanOrEqual(status.totalBytes);
  });

  it('says so when the volume is not mounted', () => {
    expect(diskStatus('/nonexistent/rr-pgdata')).toEqual({
      available: false,
      totalBytes: 0,
      freeBytes: 0,
      error: 'ENOENT',
    });
  });
});
