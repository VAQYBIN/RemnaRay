import type { Tx } from './rewards.types';

/**
 * Section 15.5 settlement: a reserved redemption becomes `applied` and bumps
 * `used_count` when the invoice is paid.
 */
export async function applyReservedPromocode(tx: Tx, invoiceId: string): Promise<void> {
  const redemption = await tx.promocodeRedemption.findFirst({
    where: { invoiceId, status: 'reserved' },
  });
  if (!redemption) return;
  await tx.promocodeRedemption.update({
    where: { id: redemption.id },
    data: { status: 'applied' },
  });
  await tx.promocode.update({
    where: { id: redemption.promocodeId },
    data: { usedCount: { increment: 1 } },
  });
  await tx.outboxJob.create({
    data: {
      queue: 'notify',
      name: 'notify.send',
      payload: {
        event: 'promo.applied',
        userId: redemption.userId,
        dedupKey: `promo.applied:${redemption.id}`,
        params: {},
      },
      jobId: `notify:promo.applied:${redemption.id}`,
    },
  });
}

/** A canceled or expired invoice frees the reserved slot again. */
export async function releaseReservedPromocode(tx: Tx, invoiceId: string): Promise<void> {
  await tx.promocodeRedemption.updateMany({
    where: { invoiceId, status: 'reserved' },
    data: { status: 'released' },
  });
}
