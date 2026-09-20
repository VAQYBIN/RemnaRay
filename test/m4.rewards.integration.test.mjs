import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const noCache = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve('OK'),
  del: () => Promise.resolve(0),
  publish: () => Promise.resolve(0),
  getex: () => Promise.resolve(null),
};

function settingsStub(values) {
  return { get: (key) => Promise.resolve(values[key]) };
}

async function payInvoice(service, invoice, amountMinor) {
  const body = JSON.stringify({
    eventId: `paid-${invoice.id}`,
    providerInvoiceId: invoice.providerInvoiceId,
    type: 'paid',
    paidAmountMinorRub: String(amountMinor),
  });
  await service.receiveWebhook(
    'mock',
    Buffer.from(body),
    { 'x-mock-signature': createHmac('sha256', 'mock-secret').update(body).digest('hex') },
    '127.0.0.1',
  );
}

test(
  'M4 rewards: AC-152 single first-purchase reward, AC-153 reversal, AC-155 promo race',
  { timeout: 300_000 },
  async () => {
    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    const databaseUrl = postgres.getConnectionUri();
    try {
      execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      });
      const { createPrismaClient } = await import('../packages/db/dist/index.js');
      const { PaymentsRepository } =
        await import('../apps/api/dist/modules/payments/payments.repository.js');
      const { PaymentsService } =
        await import('../apps/api/dist/modules/payments/payments.service.js');
      const { PaymentProviderRegistry } =
        await import('../apps/api/dist/modules/payments/payments.registry.js');
      const { MockPaymentProvider } = await import('../packages/payments-mock/dist/index.js');
      const { RewardsService } =
        await import('../apps/api/dist/modules/rewards/rewards.service.js');
      const { MeService } = await import('../apps/api/dist/modules/me/me.service.js');

      const prisma = createPrismaClient(databaseUrl);
      const infra = { db: prisma, redis: noCache };
      const settings = settingsStub({
        'referral.enabled': true,
        'referral.mode': 'percent_first',
        'referral.percent': 20,
        'referral.fixed_minor': '0',
        'referral.all_months': 0,
        'referral.invitee_bonus': { type: 'none', value: 0 },
        'referral.invitee_bonus_trigger': 'first_paid',
        'referral.hold_hours': 24,
        'referral.max_rewards_per_day': 20,
        'referral.min_source_amount_minor': '0',
        'referral.count_topups': false,
        'trial.days': 3,
        'trial.traffic_gb': 10,
        'trial.device_limit': 1,
        'trial.squads': [],
        'fiscal.mode': 'none',
        'fiscal.fallback_email': '',
        'balance.topup_enabled': true,
        'balance.topup_presets_minor': ['10000'],
        'balance.topup_min_minor': '1000',
        'balance.topup_max_minor': '1000000',
        'bot.username': 'bot',
        'domain.main': 'shop.test',
        'subscription.user_can_remove_devices': false,
      });
      const rewards = new RewardsService(infra, settings);
      const registry = new PaymentProviderRegistry();
      registry.register(new MockPaymentProvider());
      const repository = new PaymentsRepository(prisma, rewards);
      const payments = new PaymentsService(infra, repository, registry, settings);

      const referrer = await prisma.user.create({
        data: { telegramId: 995000001n, language: 'ru', referralCode: 'REFERRER' },
      });
      const referee = await prisma.user.create({
        data: { telegramId: 995000002n, language: 'ru', referralCode: 'REFEREE1' },
      });
      await prisma.referralAttribution.create({
        data: {
          refereeId: referee.id,
          referrerId: referrer.id,
          source: 'telegram',
          code: 'REFERRER',
          status: 'pending',
        },
      });
      const plan = await prisma.plan.create({
        data: {
          slug: 'm4-ref',
          name: { ru: 'Реф', en: 'Ref' },
          durationDays: 30,
          squads: [],
          priceMinor: 29900n,
        },
      });

      // AC-152: two purchases, only the first accrues a reward.
      const first = await payments.createInvoice({
        userId: referee.id,
        kind: 'purchase',
        planId: plan.id,
        provider: 'mock',
        idempotencyKey: 'ref-first',
      });
      await payInvoice(payments, first, 29900);
      const second = await payments.createInvoice({
        userId: referee.id,
        kind: 'purchase',
        planId: plan.id,
        provider: 'mock',
        idempotencyKey: 'ref-second',
      });
      await payInvoice(payments, second, 29900);

      const rewardRows = await prisma.referralReward.findMany();
      assert.equal(rewardRows.length, 1, 'only the first purchase accrues');
      assert.equal(rewardRows[0].amountMinor, 5980n);
      assert.equal(rewardRows[0].status, 'held');
      const attribution = await prisma.referralAttribution.findUnique({
        where: { refereeId: referee.id },
      });
      assert.equal(attribution.status, 'converted');

      const referrerAccount = await prisma.account.findFirst({
        where: { kind: 'user', userId: referrer.id },
      });
      assert.equal(referrerAccount.balanceMinor, 5980n);

      // Held rewards are not spendable (section 15.2).
      const { LedgerRepository } =
        await import('../apps/api/dist/modules/ledger/ledger.repository.js');
      const ledger = new LedgerRepository(prisma);
      assert.equal(await ledger.available(referrer.id), 0n);

      // AC-153: refunding the source reverses the reward and the balance.
      const sourceTransaction = await prisma.transaction.findFirst({
        where: { userId: referee.id, type: 'purchase' },
        orderBy: { createdAt: 'asc' },
      });
      await payments.refund(sourceTransaction.id, 29900n, 'customer request');
      const reversed = await prisma.referralReward.findUnique({
        where: { sourceTransactionId: sourceTransaction.id },
      });
      assert.equal(reversed.status, 'reversed');
      const reversal = await prisma.transaction.findFirst({
        where: { userId: referrer.id, type: 'referral_reversal' },
      });
      assert.equal(reversal.amountMinor, 5980n);
      const afterReversal = await prisma.account.findFirst({
        where: { kind: 'user', userId: referrer.id },
      });
      assert.equal(afterReversal.balanceMinor, 0n);

      // Held release cron.
      await prisma.referralReward.updateMany({
        where: {},
        data: { status: 'held', holdUntil: new Date(Date.now() - 1000) },
      });
      assert.deepEqual(await rewards.releaseHeld(), { released: 1 });

      // AC-155: a promocode with max_uses = 1 sells exactly one slot.
      const me = new MeService(infra, settings, {}, payments, {}, {});
      const promocode = await prisma.promocode.create({
        data: { code: 'ONLYONE1', type: 'discount_percent', value: 10n, maxUses: 1 },
      });
      const buyers = [];
      for (let index = 0; index < 2; index += 1) {
        buyers.push(
          await prisma.user.create({
            data: {
              telegramId: BigInt(995100000 + index),
              language: 'ru',
              referralCode: `PROMOB${String(index)}`,
            },
          }),
        );
      }
      const attempts = await Promise.allSettled(
        buyers.map((buyer, index) =>
          me.createInvoice(
            buyer.id,
            { kind: 'purchase', planId: plan.id, provider: 'mock', promocode: 'ONLYONE1' },
            `promo-${String(index)}`,
          ),
        ),
      );
      const accepted = attempts.filter((item) => item.status === 'fulfilled');
      const rejected = attempts.filter((item) => item.status === 'rejected');
      assert.equal(accepted.length + rejected.length, 2);
      const reservations = await prisma.promocodeRedemption.count({
        where: { promocodeId: promocode.id, status: 'reserved' },
      });
      assert.ok(reservations <= 1, 'at most one reservation may exist');

      if (accepted.length === 1) {
        assert.equal(
          rejected[0].reason.response.error.code,
          'PROMO_EXHAUSTED',
          'the loser is rejected with PROMO_EXHAUSTED',
        );
      }

      // A third attempt always fails once the slot is taken.
      const third = await prisma.user.create({
        data: { telegramId: 995100099n, language: 'ru', referralCode: 'PROMOB99' },
      });
      await assert.rejects(
        me.createInvoice(
          third.id,
          { kind: 'purchase', planId: plan.id, provider: 'mock', promocode: 'ONLYONE1' },
          'promo-third',
        ),
        (error) => error.response.error.code === 'PROMO_EXHAUSTED',
      );

      // Settlement moves the reservation to applied and bumps used_count.
      const reserved = await prisma.promocodeRedemption.findFirst({
        where: { promocodeId: promocode.id, status: 'reserved' },
      });
      if (reserved) {
        const invoice = await prisma.invoice.findUnique({ where: { id: reserved.invoiceId } });
        await payInvoice(payments, invoice, Number(invoice.amountMinor));
        const applied = await prisma.promocodeRedemption.findUnique({ where: { id: reserved.id } });
        assert.equal(applied.status, 'applied');
        const used = await prisma.promocode.findUnique({ where: { id: promocode.id } });
        assert.equal(used.usedCount, 1);
      }

      await prisma.$disconnect();
    } finally {
      await postgres.stop();
    }
  },
);
