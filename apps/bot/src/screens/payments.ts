import { randomUUID } from 'node:crypto';
import { InlineKeyboard } from 'grammy';

import type { ApiClient, InvoiceView } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, formatDate, formatMinor, show } from './common.js';

export async function createPayment(
  ctx: RrContext,
  api: ApiClient,
  slug: string,
  provider: string,
): Promise<void> {
  if (!ctx.from) return;
  const plan = (await api.getPlans()).items.find((item) => item.slug === slug);
  if (!plan) {
    await show(ctx, ctx.t('bot.error.invoice_expired'), backButton(ctx, 'plans'));
    return;
  }
  const invoice = await api.createInvoice(
    ctx.from.id,
    { kind: 'purchase', planId: plan.id, provider },
    randomUUID(),
  );
  ctx.session.lastInvoiceId = invoice.id;
  await showInvoice(ctx, invoice);
}

export async function checkPayment(
  ctx: RrContext,
  api: ApiClient,
  invoiceId: string,
): Promise<void> {
  if (!ctx.from) return;
  await showInvoice(ctx, await api.checkInvoice(ctx.from.id, invoiceId));
}

export async function showInvoice(ctx: RrContext, invoice: InvoiceView): Promise<void> {
  if (invoice.status === 'paid') {
    await show(ctx, ctx.t('bot.screen.pay.ok'), backButton(ctx));
    return;
  }
  const keyboard = new InlineKeyboard();
  // Section 11.3.6: a Stars invoice's link is its `pay` button.
  const payUrl = invoice.paymentUrl ?? invoice.starsInvoiceLink;
  if (payUrl) keyboard.url(ctx.t('bot.btn.pay'), payUrl).row();
  keyboard
    .text(ctx.t('bot.btn.check'), `inv:check:${invoice.id}`)
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  await show(
    ctx,
    ctx.t('bot.screen.pay.wait', {
      price: formatMinor(invoice.amount.amountMinor, invoice.amount.currency),
      until: formatDate(invoice.expiresAt, ctx.locale),
    }),
    keyboard,
  );
}
