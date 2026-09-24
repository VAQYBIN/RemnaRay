import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * TASK-M2-008 acceptance on a real database (section 11.3.6): a duplicate
 * `successful_payment` makes one transaction, and an expired invoice paid in
 * the precheckout window is credited to the balance (EX-02).
 */
test(
  'M2 Telegram Stars: bot-delivered payments are applied once and late ones reach the balance',
  { timeout: 240_000 },
  async () => {
    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    const { TelegramMock } = await import('../packages/telegram-mock/dist/index.js');
    const telegram = new TelegramMock();
    const apiRoot = await telegram.start();
    const appKey = randomBytes(32).toString('base64');
    const previous = {
      appKey: process.env.RR_APP_KEY,
      telegram: process.env.RR_TELEGRAM_API_URL,
    };
    process.env.RR_APP_KEY = appKey;
    process.env.RR_TELEGRAM_API_URL = apiRoot;
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
      const { StarsService } = await import('../apps/api/dist/modules/payments/stars.service.js');
      const { createPaymentProviderRegistry } =
        await import('../apps/api/dist/modules/payments/payments.registry.js');
      const { encryptSetting } =
        await import('../apps/api/dist/modules/settings/settings.crypto.js');
      const prisma = createPrismaClient(databaseUrl);
      const infra = { db: prisma };
      const repository = new PaymentsRepository(prisma);
      const settings = {
        get: (key) => Promise.resolve(key === 'bot.token' ? telegram.token : undefined),
      };
      const payments = new PaymentsService(
        infra,
        repository,
        createPaymentProviderRegistry({}),
        settings,
      );
      const stars = new StarsService(infra, repository);

      // Exactly what the console writes when an administrator enables Stars.
      await prisma.paymentProvider.upsert({
        where: { code: 'stars' },
        create: {
          code: 'stars',
          enabled: true,
          displayName: { ru: 'Звёзды', en: 'Stars' },
          configEnc: encryptSetting({ starsPerRub: 0.75 }, appKey).enc,
        },
        update: { enabled: true, configEnc: encryptSetting({ starsPerRub: 0.75 }, appKey).enc },
      });
      const telegramId = 992000042n;
      const user = await prisma.user.create({
        data: { telegramId, language: 'ru', referralCode: 'M2STAR01' },
      });
      const plan = await prisma.plan.create({
        data: {
          slug: 'm2-stars',
          name: { ru: 'Звёздный', en: 'Starry' },
          durationDays: 30,
          squads: [],
          priceMinor: 29900n,
          priceOverrides: { XTR: 200 },
        },
      });

      const invoice = await payments.createInvoice({
        userId: user.id,
        kind: 'purchase',
        planId: plan.id,
        provider: 'stars',
        idempotencyKey: 'm2-stars-paid',
      });
      assert.equal(invoice.providerInvoiceId, `inv_${invoice.id}`);
      assert.equal(invoice.providerCurrency, 'XTR');
      assert.equal(invoice.providerAmount.toFixed(0), '200');
      assert.match(invoice.paymentUrl, /^https:\/\/t\.me\/\$/u);
      const link = telegram.calls.find((call) => call.method === 'createInvoiceLink');
      assert.deepEqual(link.payload.prices, [{ label: 'Звёздный', amount: 200 }]);
      assert.equal(link.payload.provider_token, '');

      // create-link returns what the bot sends with sendInvoice.
      const forBot = await stars.invoiceForBot(String(telegramId), { invoiceId: invoice.id });
      assert.deepEqual(
        { payload: forBot.payload, amount: forBot.amount, currency: forBot.currency },
        { payload: `inv_${invoice.id}`, amount: 200, currency: 'XTR' },
      );

      const precheckout = {
        telegramId: Number(telegramId),
        invoicePayload: `inv_${invoice.id}`,
        totalAmount: 200,
        currency: 'XTR',
      };
      assert.deepEqual(await stars.precheckout(precheckout), { ok: true });
      await assert.rejects(stars.precheckout({ ...precheckout, totalAmount: 199 }), {
        code: 'AMOUNT_MISMATCH',
      });
      await assert.rejects(stars.precheckout({ ...precheckout, telegramId: 1 }), {
        code: 'INVOICE_NOT_FOUND',
      });

      const payment = {
        telegramId: Number(telegramId),
        telegramPaymentChargeId: 'stars-charge-1',
        providerPaymentChargeId: 'stars-provider-1',
        invoicePayload: `inv_${invoice.id}`,
        totalAmount: 200,
        currency: 'XTR',
      };
      const first = await stars.successfulPayment(payment);
      const second = await stars.successfulPayment(payment);
      assert.equal(first.status, 'paid');
      assert.equal(second.duplicate, true);
      assert.equal((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status, 'paid');
      const transactions = await prisma.transaction.findMany({ where: { invoiceId: invoice.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, 'purchase');
      assert.equal(transactions[0].amountMinor, 29900n);
      assert.equal(
        await prisma.ledgerEntry.count({ where: { transactionId: transactions[0].id } }),
        2,
      );
      assert.equal(
        await prisma.paymentEvent.count({
          where: { provider: 'stars', externalId: 'stars-charge-1' },
        }),
        1,
      );
      assert.equal(
        (await prisma.subscription.findFirst({ where: { userId: user.id } })).status,
        'active',
      );
      await assert.rejects(stars.precheckout(precheckout), { code: 'INVOICE_NOT_PENDING' });

      // EX-02: the invoice expires between precheckout and payment.
      const late = await payments.createInvoice({
        userId: user.id,
        kind: 'purchase',
        planId: plan.id,
        provider: 'stars',
        idempotencyKey: 'm2-stars-late',
      });
      await repository.expire(new Date(Date.now() + 61 * 60_000));
      await assert.rejects(
        stars.precheckout({ ...precheckout, invoicePayload: `inv_${late.id}` }),
        { code: 'INVOICE_NOT_PENDING' },
      );
      await stars.successfulPayment({
        ...payment,
        telegramPaymentChargeId: 'stars-charge-late',
        invoicePayload: `inv_${late.id}`,
      });
      const lateTransactions = await prisma.transaction.findMany({ where: { invoiceId: late.id } });
      assert.equal(lateTransactions.length, 1);
      assert.equal(lateTransactions[0].type, 'topup');
      assert.equal(
        (await prisma.account.findFirst({ where: { userId: user.id, kind: 'user' } })).balanceMinor,
        29900n,
      );

      // A redelivery racing the first delivery applies once and fails neither,
      // even on an invoice the short payment leaves `underpaid` (EX-12).
      const short = await payments.createInvoice({
        userId: user.id,
        kind: 'purchase',
        planId: plan.id,
        provider: 'stars',
        idempotencyKey: 'm2-stars-short',
      });
      const shortPayment = {
        ...payment,
        telegramPaymentChargeId: 'stars-charge-short',
        invoicePayload: `inv_${short.id}`,
        totalAmount: 100,
      };
      const results = await Promise.allSettled([
        stars.successfulPayment(shortPayment),
        stars.successfulPayment(shortPayment),
        stars.successfulPayment(shortPayment),
      ]);
      assert.deepEqual(
        results.map((result) => result.status),
        ['fulfilled', 'fulfilled', 'fulfilled'],
      );
      assert.equal(
        (await prisma.invoice.findUnique({ where: { id: short.id } })).status,
        'underpaid',
      );
      const shortTransactions = await prisma.transaction.findMany({
        where: { invoiceId: short.id },
      });
      assert.equal(shortTransactions.length, 1);
      assert.equal(shortTransactions[0].type, 'topup');
      assert.equal(shortTransactions[0].amountMinor, 14950n);

      // No event is invented from an HTTP body: Stars have no webhook.
      const events = await prisma.paymentEvent.count();
      await assert.rejects(payments.receiveWebhook('stars', Buffer.from('{}'), {}, '127.0.0.1'), {
        code: 'WEBHOOK_NOT_SUPPORTED',
      });
      assert.equal(await prisma.paymentEvent.count(), events);

      await prisma.$disconnect();
    } finally {
      await telegram.stop();
      if (previous.appKey === undefined) delete process.env.RR_APP_KEY;
      else process.env.RR_APP_KEY = previous.appKey;
      if (previous.telegram === undefined) delete process.env.RR_TELEGRAM_API_URL;
      else process.env.RR_TELEGRAM_API_URL = previous.telegram;
      await postgres.stop();
    }
  },
);
