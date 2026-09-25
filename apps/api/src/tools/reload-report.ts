/**
 * Section 21.6: every proxy apply is reported to
 * `POST /api/internal/v1/system/proxy-reload-result`, which writes it to
 * `audit_log` and raises `proxy.config_invalid` for a refused configuration.
 *
 * The API refuses the report while the setup wizard runs (section 17.4 answers
 * every internal call `503 SETUP_NOT_COMPLETED`), and the wizard's domain step
 * is itself what triggers a reload; it may also be restarting. A report the
 * API did not accept is therefore kept and sent again until it is recorded,
 * oldest first so `audit_log` keeps the order.
 */
export type ReloadOutcome = { ok: boolean; error?: string };

export type SendReport = (outcome: ReloadOutcome) => Promise<Response>;

/** Kept at most: a reloader left refused for long drops the oldest outcomes. */
export const PENDING_LIMIT = 50;
export const REPORT_RETRY_MS = 30_000;

export function reportSender(base: string, token: string): SendReport {
  return (outcome) =>
    fetch(`${base}/api/internal/v1/system/proxy-reload-result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': token },
      body: JSON.stringify(outcome),
      signal: AbortSignal.timeout(10_000),
    });
}

export class ReloadReports {
  private readonly pending: ReloadOutcome[] = [];
  private flushing: Promise<void> | undefined;

  constructor(
    private readonly send: SendReport,
    private readonly log: (line: string) => void,
  ) {}

  get waiting(): number {
    return this.pending.length;
  }

  /** Queues the outcome and sends what is waiting; resolves once tried. */
  add(ok: boolean, error?: string): Promise<void> {
    this.pending.push({ ok, ...(error ? { error: error.slice(0, 500) } : {}) });
    if (this.pending.length > PENDING_LIMIT) {
      const dropped = this.pending.splice(0, this.pending.length - PENDING_LIMIT);
      this.log(`${String(dropped.length)} proxy reload result(s) dropped unrecorded\n`);
    }
    return this.flush();
  }

  /** Sends the waiting outcomes in order and stops at the first refusal. */
  flush(): Promise<void> {
    this.flushing ??= this.drain().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async drain(): Promise<void> {
    while (this.pending.length > 0) {
      const outcome = this.pending[0] as ReloadOutcome;
      try {
        const response = await this.send(outcome);
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          this.log(
            `Proxy reload result not recorded yet: ${String(response.status)} ${text.slice(0, 200)}\n`,
          );
          return;
        }
      } catch (cause) {
        this.log(`Proxy reload result not recorded yet: ${String(cause)}\n`);
        return;
      }
      this.pending.shift();
    }
  }
}
