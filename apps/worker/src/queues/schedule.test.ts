import { describe, expect, it } from 'vitest';

import { cronJobs, DAILY_CHECK_RETRY_MS, dailyCheckDue, minuteStamp } from './schedule';

describe('section 7.3 cron jobs', () => {
  it('stamps a minute as yyyymmddHHMM in UTC', () => {
    expect(minuteStamp(new Date('2026-09-25T07:05:59.999Z'))).toBe('202609250705');
  });

  it('expires subscriptions every minute (FR-024)', () => {
    const jobs = cronJobs(new Date('2026-09-25T07:05:10Z'));
    expect(jobs).toContainEqual({
      queue: 'maintenance',
      name: 'maintenance.subscriptions-expire',
      jobId: 'maintenance:subscriptions-expire:202609250705',
    });
  });

  it('reconciles the panel once per quarter hour under jobId reconcile:<yyyymmddHHMM>', () => {
    const reconcile = (at: string) =>
      cronJobs(new Date(at)).find((job) => job.name === 'panel.reconcile-all');

    expect(reconcile('2026-09-25T07:00:00Z')).toEqual({
      queue: 'panel',
      name: 'panel.reconcile-all',
      jobId: 'reconcile:202609250700',
    });
    // Every minute of the slot names the slot's start, so a late or missed
    // tick, a restart or a second worker still adds the job only once.
    expect(reconcile('2026-09-25T07:14:59Z')?.jobId).toBe('reconcile:202609250700');
    expect(reconcile('2026-09-25T07:15:00Z')?.jobId).toBe('reconcile:202609250715');
  });
});

describe('the section 19.2 and 20.3 daily checks', () => {
  const start = Date.parse('2026-09-25T07:00:00Z');
  const minutes = (count: number) => start + count * 60_000;

  it('runs at start', () => {
    expect(dailyCheckDue(start, {})).toBe(true);
  });

  it('asks a refused check again every five minutes, not a day later', () => {
    // Queued at start and refused with 503 while the wizard runs: nothing recorded.
    const refused = { queuedAt: start };
    expect(dailyCheckDue(minutes(4), refused)).toBe(false);
    expect(dailyCheckDue(minutes(5), refused)).toBe(true);
    expect(DAILY_CHECK_RETRY_MS).toBe(5 * 60_000);
  });

  it('waits a day after the check the API recorded', () => {
    const recorded = { queuedAt: start, recordedAt: minutes(1) };
    expect(dailyCheckDue(minutes(60), recorded)).toBe(false);
    expect(dailyCheckDue(minutes(24 * 60), recorded)).toBe(false);
    expect(dailyCheckDue(minutes(24 * 60 + 1), recorded)).toBe(true);
  });
});
