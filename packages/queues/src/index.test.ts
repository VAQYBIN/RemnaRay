import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES, QUEUE_PREFIX, toJobId } from './index.js';

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

  it('names the section 7.3 queues', () => {
    expect([...QUEUE_NAMES]).toEqual(['panel', 'payments', 'notify', 'broadcast', 'maintenance']);
  });
});
