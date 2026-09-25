import { describe, expect, it, vi } from 'vitest';

import { PENDING_LIMIT, ReloadReports, type ReloadOutcome } from './reload-report';

function api(statuses: number[]) {
  const recorded: ReloadOutcome[] = [];
  const send = vi.fn((outcome: ReloadOutcome) => {
    const status = statuses.shift() ?? 200;
    if (status === 200) recorded.push(outcome);
    return Promise.resolve(
      new Response(
        status === 200 ? '{"recorded":true}' : '{"error":{"code":"SETUP_NOT_COMPLETED"}}',
        {
          status,
        },
      ),
    );
  });
  return { send, recorded };
}

describe('section 21.6 proxy reload results', () => {
  it('keeps a result the API refused during setup and records it once the API accepts', async () => {
    // The wizard's domain step triggers the reload; the API answers 503 until
    // the wizard finishes (section 17.4).
    const { send, recorded } = api([503, 503]);
    const log = vi.fn();
    const reports = new ReloadReports(send, log);

    await reports.add(false, 'nginx: [emerg] unknown directive');
    expect(recorded).toEqual([]);
    expect(reports.waiting).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('503'));

    await reports.flush();
    expect(reports.waiting).toBe(1);
    await reports.flush();
    expect(recorded).toEqual([{ ok: false, error: 'nginx: [emerg] unknown directive' }]);
    expect(reports.waiting).toBe(0);
  });

  it('keeps it when the API cannot be reached, and sends the waiting ones in order', async () => {
    const recorded: ReloadOutcome[] = [];
    let down = true;
    const reports = new ReloadReports((outcome) => {
      if (down) return Promise.reject(new Error('ECONNREFUSED'));
      recorded.push(outcome);
      return Promise.resolve(new Response('{}'));
    }, vi.fn());

    await reports.add(true);
    await reports.add(false, 'refused');
    expect(reports.waiting).toBe(2);
    down = false;
    await reports.add(true);
    expect(recorded).toEqual([{ ok: true }, { ok: false, error: 'refused' }, { ok: true }]);
  });

  it('bounds what it keeps and says what it dropped', async () => {
    const log = vi.fn();
    const reports = new ReloadReports(
      () => Promise.resolve(new Response('', { status: 503 })),
      log,
    );
    for (let index = 0; index <= PENDING_LIMIT; index += 1) await reports.add(true);
    expect(reports.waiting).toBe(PENDING_LIMIT);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('1 proxy reload result(s) dropped'));
  });

  it('cuts the error to the 500 characters the API accepts', async () => {
    const { send, recorded } = api([]);
    await new ReloadReports(send, vi.fn()).add(false, 'x'.repeat(600));
    expect(recorded[0]?.error).toHaveLength(500);
  });
});
