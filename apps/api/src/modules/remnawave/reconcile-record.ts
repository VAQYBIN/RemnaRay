import type Redis from 'ioredis';

/** The last `panel.reconcile-all` run, for «Последняя сверка с панелью» (AC-146). */
export type ReconcileRecord = {
  at: string;
  checked: number;
  drifted: number;
  retried: number;
  failed: number;
};

const KEY = 'rr:panel:reconcile:last';

export async function recordReconcile(
  redis: Pick<Redis, 'set'>,
  result: Omit<ReconcileRecord, 'at'>,
  at = new Date(),
): Promise<void> {
  await redis.set(KEY, JSON.stringify({ at: at.toISOString(), ...result }));
}

/** Null before the first run, or when Valkey cannot be read. */
export async function lastReconcile(redis: Pick<Redis, 'get'>): Promise<ReconcileRecord | null> {
  try {
    const raw = await redis.get(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ReconcileRecord>;
    return typeof value.at === 'string' ? (value as ReconcileRecord) : null;
  } catch {
    return null;
  }
}
