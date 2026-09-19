import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

test(
  'M2 payment core is idempotent and credits late payments to balance',
  { timeout: 240_000 },
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
      const { BalanceProvider } =
        await import('../apps/api/dist/modules/payments/builtin-providers.js');
      const prisma = createPrismaClient(databaseUrl);
      const infra = { db: prisma };
      const registry = new PaymentProviderRegistry();
      registry.register(new MockPaymentProvider());
      registry.register(new BalanceProvider());
      const repository = new PaymentsRepository(prisma);
      const service = new PaymentsService(infra, repository, registry);
      const user = await prisma.user.create({
        data: { telegramId: 992000001n, language: 'ru', referralCode: 'M2PAY001' },
      });
      const plan = await prisma.plan.create({
        data: {
          slug: 'm2-core',
          name: { ru: 'M2', en: 'M2' },
          durationDays: 30,
          squads: [],
          priceMinor: 29900n,
        },
      });
      const invoice = await service.createInvoice({
        userId: user.id,
        kind: 'purchase',
        planId: plan.id,
        provider: 'mock',
        idempotencyKey: 'm2-paid',
      });
      const body = JSON.stringify({
        eventId: 'paid-1',
        providerInvoiceId: invoice.providerInvoiceId,
        type: 'paid',
        paidAmountMinorRub: '29900',
      });
      const signature = createHmac('sha256', 'mock-secret').update(body).digest('hex');
      await service.receiveWebhook(
        'mock',
        Buffer.from(body),
        { 'x-mock-signature': signature },
        '127.0.0.1',
      );
      await service.receiveWebhook(
        'mock',
        Buffer.from(body),
        { 'x-mock-signature': signature },
        '127.0.0.1',
      );
      assert.equal((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status, 'paid');
      assert.equal(await prisma.transaction.count({ where: { invoiceId: invoice.id } }), 1);
      assert.equal(
        await prisma.ledgerEntry.count({
          where: {
            transactionId: {
              in: (
                await prisma.transaction.findMany({
                  where: { invoiceId: invoice.id },
                  select: { id: true },
                })
              ).map((row) => row.id),
            },
          },
        }),
        2,
      );
      assert.equal(
        (await prisma.subscription.findFirst({ where: { userId: user.id } })).status,
        'active',
      );

      const topup = await service.createInvoice({
        userId: user.id,
        kind: 'topup',
        provider: 'mock',
        amountMinor: 5000n,
        idempotencyKey: 'm2-topup',
      });
      const topupBody = JSON.stringify({
        eventId: 'paid-topup',
        providerInvoiceId: topup.providerInvoiceId,
        type: 'paid',
        paidAmountMinorRub: '5000',
      });
      await service.receiveWebhook(
        'mock',
        Buffer.from(topupBody),
        { 'x-mock-signature': createHmac('sha256', 'mock-secret').update(topupBody).digest('hex') },
        '127.0.0.1',
      );
      const balancePlan = await prisma.plan.create({
        data: {
          slug: 'm2-balance',
          name: { ru: 'Balance', en: 'Balance' },
          durationDays: 1,
          squads: [],
          priceMinor: 4000n,
        },
      });
      const balanceInvoice = await service.createInvoice({
        userId: user.id,
        kind: 'purchase',
        planId: balancePlan.id,
        provider: 'balance',
        idempotencyKey: 'm2-balance',
      });
      assert.equal(
        (await prisma.invoice.findUnique({ where: { id: balanceInvoice.id } })).status,
        'paid',
      );
      const balanceTransaction = await prisma.transaction.findFirst({
        where: { invoiceId: balanceInvoice.id },
      });
      assert.equal(
        await prisma.account
          .findFirst({ where: { userId: user.id } })
          .then((row) => row.balanceMinor),
        1000n,
      );
      await repository.refund(balanceTransaction.id, 1000n, 'test refund');
      assert.equal(
        await prisma.account
          .findFirst({ where: { userId: user.id } })
          .then((row) => row.balanceMinor),
        2000n,
      );

      const late = await service.createInvoice({
        userId: user.id,
        kind: 'topup',
        provider: 'mock',
        amountMinor: 5000n,
        idempotencyKey: 'm2-late',
      });
      await repository.expire(new Date(Date.now() + 31 * 60_000));
      const lateBody = JSON.stringify({
        eventId: 'paid-late',
        providerInvoiceId: late.providerInvoiceId,
        type: 'paid',
        paidAmountMinorRub: '5000',
      });
      await service.receiveWebhook(
        'mock',
        Buffer.from(lateBody),
        { 'x-mock-signature': createHmac('sha256', 'mock-secret').update(lateBody).digest('hex') },
        '127.0.0.1',
      );
      assert.equal((await prisma.invoice.findUnique({ where: { id: late.id } })).status, 'paid');
      assert.equal(
        await prisma.transaction.count({ where: { invoiceId: late.id, type: 'topup' } }),
        1,
      );
      await prisma.$disconnect();
    } finally {
      await postgres.stop();
    }
  },
);
