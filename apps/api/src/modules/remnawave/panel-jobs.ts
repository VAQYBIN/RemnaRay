import type { Prisma } from '@remnaray/db';

/**
 * Section 7.3 `panel.sync-user`, written in the caller's transaction: the
 * store is the source of truth for expiry, limits, squads and enabled state
 * (10.6), and a change the panel never hears of is undone by nothing but the
 * next reconciliation, which only looks at drift in what it compares.
 */
export async function queuePanelSync(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: string,
): Promise<void> {
  await tx.outboxJob.create({
    data: {
      queue: 'panel',
      name: 'panel.sync-user',
      payload: { userId, reason },
      jobId: `sync:${userId}`,
    },
  });
}

/**
 * FR-023: a plan change resets the panel traffic only when the new limit is
 * below what is used, which `panel.reset-traffic` reads from the panel when
 * it runs. An unlimited plan (0) never needs it. Written before the sync, so
 * the relay publishes it first.
 */
export async function queueDowngradeReset(
  tx: Prisma.TransactionClient,
  userId: string,
  newLimitBytes: bigint,
  occurrence: string,
): Promise<void> {
  if (newLimitBytes <= 0n) return;
  await tx.outboxJob.create({
    data: {
      queue: 'panel',
      name: 'panel.reset-traffic',
      payload: { userId, ifUsedAboveBytes: newLimitBytes.toString() },
      // One job per change: an id kept by BullMQ would swallow a later one.
      jobId: `panel:traffic:${occurrence}`,
    },
  });
}
