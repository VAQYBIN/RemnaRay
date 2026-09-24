import type { QueueName } from '@remnaray/queues';

export type CronJob = { queue: QueueName; name: string; jobId: string };

const pad = (value: number) => String(value).padStart(2, '0');

/** `yyyymmddHHMM` in UTC, the minute key of section 7.3. */
export function minuteStamp(at: Date): string {
  return `${String(at.getUTCFullYear())}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}`;
}

/**
 * The every-minute and quarter-hour crons of section 7.3, for the minute
 * `at` falls in. The job id names the cron slot rather than the tick, so the
 * slot runs once however many ticks, restarts or workers add it.
 */
export function cronJobs(at: Date): CronJob[] {
  const slot = new Date(at);
  slot.setUTCMinutes(slot.getUTCMinutes() - (slot.getUTCMinutes() % 15), 0, 0);
  return [
    // FR-024: `active` past `expires_at` becomes `grace` or `expired`.
    {
      queue: 'maintenance',
      name: 'maintenance.subscriptions-expire',
      jobId: `maintenance:subscriptions-expire:${minuteStamp(at)}`,
    },
    // Section 10.5, cron `*/15 * * * *`.
    { queue: 'panel', name: 'panel.reconcile-all', jobId: `reconcile:${minuteStamp(slot)}` },
  ];
}
