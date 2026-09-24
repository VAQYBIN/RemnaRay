import { describe, expect, it } from 'vitest';

import {
  backoffStrategy,
  jobOptions,
  OUTGOING_WEBHOOK_BACKOFF,
  QUEUE_NAMES,
  QUEUE_PREFIX,
  toJobId,
} from './index.js';

describe('toJobId', () => {
  it('replaces the separator BullMQ reserves', () => {
    // Without this every identifier the application builds is refused with
    // "Custom Id cannot contain :", and nothing ever reaches a queue.
    expect(toJobId('alert:payment.late:01a0-bec6')).toBe('alert-payment.late-01a0-bec6');
    expect(toJobId('panel:setup-reconcile')).toBe('panel-setup-reconcile');
  });

  it('keeps an identifier that needs no translation', () => {
    expect(toJobId('panel-sync')).toBe('panel-sync');
    expect(toJobId('01a0bec6-c9b4-7329-95c1-a12cbf9679e2')).toBe(
      '01a0bec6-c9b4-7329-95c1-a12cbf9679e2',
    );
  });

  it('never hands BullMQ an all-digit identifier, which it also refuses', () => {
    expect(toJobId('998000001')).toBe('j-998000001');
    expect(toJobId('17:29')).toBe('17-29');
  });

  it('is one-to-one, so two identifiers never deduplicate each other', () => {
    expect(toJobId('panel:a')).not.toBe(toJobId('panel:b'));
    expect(toJobId('evt:1')).not.toBe(toJobId('evt:2'));
  });
});

describe('the queue namespace', () => {
  it('is one value, shared by the producer and the consumer', () => {
    // A relay that publishes under `rr:q` and a worker that waits on `bull`
    // share a queue name and nothing else: the job is enqueued, nothing
    // consumes it, and neither side reports a problem.
    expect(QUEUE_PREFIX).toBe('rr:q');
  });

  it('names the section 7.3 queues and the section 9.8 webhooks queue', () => {
    expect([...QUEUE_NAMES]).toEqual([
      'panel',
      'payments',
      'notify',
      'broadcast',
      'maintenance',
      'webhooks',
    ]);
  });
});

describe('section 7.3 job options', () => {
  const row = (name: string, jobId: string | null) => ({
    id: '01a0bec6-c9b4-7329-95c1-a12cbf9679e2',
    name,
    jobId,
  });

  it('retries panel.sync-user ten times from five seconds and keeps the latest request', () => {
    const options = jobOptions(row('panel.sync-user', 'sync:user-1'));
    expect(options).toMatchObject({
      attempts: 10,
      backoff: { type: 'exponential', delay: 5_000 },
      deduplication: { id: 'sync-user-1', keepLastIfActive: true },
    });
    // The BullMQ id is the outbox row: a kept, finished sync under
    // `sync:<userId>` used to swallow every later renewal of the user.
    expect(options.jobId).toBe('01a0bec6-c9b4-7329-95c1-a12cbf9679e2');
    // The longest wait of ten attempts stays within the one-hour ceiling.
    expect(5_000 * 2 ** (10 - 2)).toBeLessThanOrEqual(3_600_000);
  });

  it('retries payments.apply-event five times from two seconds', () => {
    expect(jobOptions(row('payments.apply-event', 'evt:e-1'))).toMatchObject({
      jobId: 'evt-e-1',
      attempts: 5,
      backoff: { type: 'exponential', delay: 2_000 },
    });
  });

  it('retries notify.send three times ten seconds apart', () => {
    expect(jobOptions(row('notify.send', 'notify:k'))).toMatchObject({
      jobId: 'notify-k',
      attempts: 3,
      backoff: { type: 'fixed', delay: 10_000 },
    });
  });

  it('retries broadcast.chunk three times', () => {
    expect(jobOptions(row('broadcast.chunk', 'broadcast:b:0:1'))).toMatchObject({
      attempts: 3,
    });
  });

  it('runs the jobs the table gives one attempt once, under their own id', () => {
    for (const name of ['panel.reconcile-all', 'notify.alert', 'payments.poll-pending']) {
      const options = jobOptions(row(name, `${name}:x`));
      expect(options.attempts).toBeUndefined();
      expect(options.deduplication).toBeUndefined();
      expect(options.jobId).toBe(toJobId(`${name}:x`));
    }
    expect(jobOptions(row('notify.alert', null)).jobId).toBe(
      '01a0bec6-c9b4-7329-95c1-a12cbf9679e2',
    );
  });
});

describe('section 9.8 outgoing webhook retries', () => {
  it('tries a delivery once and retries it five times', () => {
    expect(
      jobOptions({
        id: '01a0bec6-c9b4-7329-95c1-a12cbf9679e2',
        name: 'webhooks.deliver',
        jobId: 'webhook:x:y',
      }),
    ).toMatchObject({
      attempts: 6,
      backoff: { type: OUTGOING_WEBHOOK_BACKOFF },
      jobId: 'webhook-x-y',
    });
  });

  it('waits 1 min, 5 min, 30 min, 2 h and 12 h', () => {
    // BullMQ passes the attempts made, the failed one included.
    expect([1, 2, 3, 4, 5].map((made) => backoffStrategy(made, OUTGOING_WEBHOOK_BACKOFF))).toEqual([
      60_000, 300_000, 1_800_000, 7_200_000, 43_200_000,
    ]);
  });

  it('refuses a backoff type it does not know', () => {
    expect(() => backoffStrategy(1, 'custom')).toThrow(/unknown backoff type/u);
  });
});

describe('the other panel writes', () => {
  it.each(['panel.reset-traffic', 'panel.delete-user'])('retries %s like a sync', (name) => {
    expect(
      jobOptions({ id: '01a0bec6-c9b4-7329-95c1-a12cbf9679e2', name, jobId: 'panel:delete:u' }),
    ).toMatchObject({
      attempts: 10,
      backoff: { type: 'exponential', delay: 5_000 },
      jobId: 'panel-delete-u',
    });
  });
});
