import type { ReferralConfig, SourceTransaction, TrialLimits, Tx } from './rewards.types';

const SOURCE_TYPES = new Set(['purchase', 'topup']);

async function accountId(tx: Tx, kind: string, userId?: string): Promise<string> {
  if (kind === 'user' && userId) {
    await tx.$executeRawUnsafe(
      `INSERT INTO accounts (kind, user_id, currency) VALUES ('user'::account_kind, $1::uuid, 'RUB') ON CONFLICT DO NOTHING`,
      userId,
    );
    const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM accounts WHERE kind = 'user'::account_kind AND user_id = $1::uuid LIMIT 1`,
      userId,
    );
    if (!rows[0]) throw new Error('ACCOUNT_NOT_FOUND');
    return rows[0].id;
  }
  const existing = await tx.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM accounts WHERE kind = $1::account_kind AND currency = 'RUB' LIMIT 1`,
    kind,
  );
  if (existing[0]) return existing[0].id;
  const created = await tx.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO accounts (kind, currency) VALUES ($1::account_kind, 'RUB') RETURNING id`,
    kind,
  );
  if (!created[0]) throw new Error('ACCOUNT_NOT_FOUND');
  return created[0].id;
}

async function post(
  tx: Tx,
  input: {
    userId: string;
    type: 'referral_reward' | 'referral_reversal' | 'promo_bonus';
    amountMinor: bigint;
    parentId?: string;
    debitKind: string;
    creditKind: string;
    creditUserId?: string;
    debitUserId?: string;
    reason?: string;
  },
): Promise<{ id: string }> {
  const debit = await accountId(tx, input.debitKind, input.debitUserId);
  const credit = await accountId(tx, input.creditKind, input.creditUserId);
  const transaction = await tx.transaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      status: 'completed',
      amountMinor: input.amountMinor,
      currency: 'RUB',
      ...(input.parentId ? { parentId: input.parentId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });
  await tx.ledgerEntry.create({
    data: {
      transactionId: transaction.id,
      debitAccountId: debit,
      creditAccountId: credit,
      amountMinor: input.amountMinor,
      currency: 'RUB',
    },
  });
  await tx.account.update({
    where: { id: debit },
    data: { balanceMinor: { decrement: input.amountMinor } },
  });
  await tx.account.update({
    where: { id: credit },
    data: { balanceMinor: { increment: input.amountMinor } },
  });
  return transaction;
}

/**
 * Section 15.2 accrual. Runs inside the payment transaction so a reward can
 * never exist without its source, and is idempotent on `source_transaction_id`.
 */
export async function accrueReferralReward(
  tx: Tx,
  config: ReferralConfig,
  source: SourceTransaction,
  trial: TrialLimits,
  now = new Date(),
): Promise<{ rewardId: string; amountMinor: bigint } | null> {
  if (!config.enabled) return null;
  if (!SOURCE_TYPES.has(source.type)) return null;
  if (source.type === 'topup' && !config.countTopups) return null;
  if (source.amountMinor < config.minSourceAmountMinor) return null;

  const attribution = await tx.referralAttribution.findUnique({
    where: { refereeId: source.userId },
  });
  if (!attribution || attribution.status === 'rejected') return null;

  const isFirst = attribution.status === 'pending';
  let amount: bigint;
  if (config.mode === 'percent_first' || config.mode === 'fixed_first') {
    if (!isFirst) return null;
    amount =
      config.mode === 'fixed_first'
        ? config.fixedMinor
        : (source.amountMinor * BigInt(config.percent)) / 100n;
  } else {
    if (config.allMonths > 0) {
      const limit = new Date(attribution.createdAt);
      limit.setUTCMonth(limit.getUTCMonth() + config.allMonths);
      if (now > limit) return null;
    }
    amount = (source.amountMinor * BigInt(config.percent)) / 100n;
  }
  if (amount <= 0n) return null;

  const existing = await tx.referralReward.findUnique({
    where: { sourceTransactionId: source.id },
  });
  if (existing) return null;

  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const todayCount = await tx.referralReward.count({
    where: {
      createdAt: { gte: startOfDay },
      status: { not: 'reversed' },
      attributionId: {
        in: (
          await tx.referralAttribution.findMany({
            where: { referrerId: attribution.referrerId },
            select: { id: true },
          })
        ).map((row) => row.id),
      },
    },
  });
  if (todayCount >= config.maxRewardsPerDay) {
    await tx.outboxJob.create({
      data: {
        queue: 'notify',
        name: 'notify.admin-alert',
        payload: { alert: 'referral.daily_cap', referrerId: attribution.referrerId },
      },
    });
    return null;
  }

  const rewardTx = await post(tx, {
    userId: attribution.referrerId,
    type: 'referral_reward',
    amountMinor: amount,
    parentId: source.id,
    debitKind: 'referral_expense',
    creditKind: 'user',
    creditUserId: attribution.referrerId,
  });
  const reward = await tx.referralReward.create({
    data: {
      attributionId: attribution.id,
      transactionId: rewardTx.id,
      sourceTransactionId: source.id,
      amountMinor: amount,
      ...(config.holdHours > 0
        ? { holdUntil: new Date(now.getTime() + config.holdHours * 3_600_000) }
        : {}),
      status: config.holdHours > 0 ? 'held' : 'released',
    },
  });

  if (isFirst) {
    await tx.referralAttribution.update({
      where: { id: attribution.id },
      data: { status: 'converted', convertedTransactionId: source.id, convertedAt: now },
    });
    if (config.inviteeBonusTrigger === 'first_paid')
      await grantInviteeBonus(tx, config, source.userId, trial, now);
  }

  await tx.outboxJob.create({
    data: {
      queue: 'notify',
      name: 'notify.referral-reward',
      payload: {
        userId: attribution.referrerId,
        amountMinor: amount.toString(),
        rewardId: reward.id,
      },
    },
  });

  return { rewardId: reward.id, amountMinor: amount };
}

/** Section 15.2 reversal, proportional on a partial refund and rounded down. */
export async function reverseReferralReward(
  tx: Tx,
  sourceTransactionId: string,
  refundedMinor: bigint,
  sourceAmountMinor: bigint,
): Promise<bigint> {
  const reward = await tx.referralReward.findUnique({
    where: { sourceTransactionId },
  });
  if (!reward || reward.status === 'reversed' || sourceAmountMinor <= 0n) return 0n;
  const amount =
    refundedMinor >= sourceAmountMinor
      ? reward.amountMinor
      : (reward.amountMinor * refundedMinor) / sourceAmountMinor;
  if (amount <= 0n) return 0n;

  const attribution = await tx.referralAttribution.findUnique({
    where: { id: reward.attributionId },
  });
  if (!attribution) return 0n;

  const reversal = await post(tx, {
    userId: attribution.referrerId,
    type: 'referral_reversal',
    amountMinor: amount,
    parentId: reward.transactionId,
    debitKind: 'user',
    debitUserId: attribution.referrerId,
    creditKind: 'referral_expense',
    reason: 'referral source refunded',
  });
  await tx.referralReward.update({
    where: { sourceTransactionId },
    data: { status: 'reversed', reversalTransactionId: reversal.id },
  });
  return amount;
}

/** Section 15.2 invitee bonus: extra days on a live subscription, or balance. */
export async function grantInviteeBonus(
  tx: Tx,
  config: ReferralConfig,
  userId: string,
  trial: TrialLimits,
  now = new Date(),
): Promise<void> {
  if (config.inviteeBonus.type === 'none' || config.inviteeBonus.value <= 0) return;
  if (config.inviteeBonus.type === 'balance') {
    await post(tx, {
      userId,
      type: 'promo_bonus',
      amountMinor: BigInt(config.inviteeBonus.value),
      debitKind: 'promo_expense',
      creditKind: 'user',
      creditUserId: userId,
      reason: 'referral invitee bonus',
    });
    return;
  }

  const live = await tx.subscription.findFirst({
    where: { userId, status: { in: ['provisioning', 'active', 'grace'] } },
    orderBy: { expiresAt: 'desc' },
  });
  const days = config.inviteeBonus.value;
  if (live) {
    const base = live.expiresAt > now ? live.expiresAt : now;
    await tx.subscription.update({
      where: { id: live.id },
      data: { expiresAt: new Date(base.getTime() + days * 86_400_000) },
    });
    return;
  }
  await tx.subscription.create({
    data: {
      userId,
      source: 'promo',
      status: 'active',
      startsAt: now,
      expiresAt: new Date(now.getTime() + days * 86_400_000),
      trafficLimitBytes: BigInt(trial.trafficGb) * 1024n ** 3n,
      trafficResetStrategy: 'NO_RESET',
      deviceLimit: trial.deviceLimit,
      squads: trial.squads,
    },
  });
}
