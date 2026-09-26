import { randomUUID } from 'node:crypto';
import { InlineKeyboard } from 'grammy';

import type { ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, formatMinor, paymentKeyboard, show } from './common.js';
import { showInvoice } from './payments.js';

/**
 * Section 12 `plan:change` (FR-023, EX-06): every other public plan with its
 * quote — the credit for the unused time and what is left to pay.
 */
export async function showPlanChange(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const telegramId = ctx.from.id;
  const [state, plans] = await Promise.all([api.getSubscription(telegramId), api.getPlans()]);
  if (!state.subscription?.canChangePlan) {
    await show(ctx, ctx.t('bot.screen.planChange.unavailable'), backButton(ctx, 'sub'));
    return;
  }
  const currentId = state.subscription.plan?.id;
  const keyboard = new InlineKeyboard();
  for (const plan of plans.items.filter((item) => item.id !== currentId)) {
    let quote;
    try {
      quote = await api.getPlanChangeQuote(telegramId, plan.id);
    } catch {
      continue;
    }
    keyboard
      .text(
        ctx.t('bot.btn.planChangeTo', {
          plan: plan.name[ctx.locale] ?? plan.name['ru'] ?? plan.slug,
          toPay: formatMinor(quote.toPayMinor),
        }),
        `plan:change:${plan.slug}`,
      )
      .row();
  }
  keyboard.text(ctx.t('bot.btn.back'), 'sub');
  await show(ctx, ctx.t('bot.screen.planChange.title'), keyboard);
}

/** `plan:change:<slug>:confirm`: the calculation and how to pay it. */
export async function confirmPlanChange(
  ctx: RrContext,
  api: ApiClient,
  slug: string,
): Promise<void> {
  if (!ctx.from) return;
  const telegramId = ctx.from.id;
  const plan = (await api.getPlans()).items.find((item) => item.slug === slug);
  if (!plan) {
    await show(ctx, ctx.t('bot.screen.planChange.unavailable'), backButton(ctx, 'sub'));
    return;
  }
  const [quote, methods] = await Promise.all([
    api.getPlanChangeQuote(telegramId, plan.id),
    api.getPaymentMethods(telegramId),
  ]);
  const keyboard = paymentKeyboard(
    ctx,
    methods.items,
    quote.toPayMinor,
    (code) => `plan:change:go:${plan.slug}:${code}`,
  ).text(ctx.t('bot.btn.back'), 'plan:change');
  await show(
    ctx,
    ctx.t('bot.screen.planChange.confirm', {
      plan: plan.name[ctx.locale] ?? plan.name['ru'] ?? plan.slug,
      price: formatMinor(quote.newPriceMinor),
      credit: formatMinor(quote.creditMinor),
      toPay: formatMinor(quote.toPayMinor),
    }),
    keyboard,
  );
}

/** `plan:change:go:<slug>:<provider>`: a `plan_change` invoice (FR-023). */
export async function payPlanChange(
  ctx: RrContext,
  api: ApiClient,
  slug: string,
  provider: string,
): Promise<void> {
  if (!ctx.from) return;
  const plan = (await api.getPlans()).items.find((item) => item.slug === slug);
  if (!plan) {
    await show(ctx, ctx.t('bot.screen.planChange.unavailable'), backButton(ctx, 'sub'));
    return;
  }
  const invoice = await api.createInvoice(
    ctx.from.id,
    { kind: 'plan_change', planId: plan.id, provider },
    randomUUID(),
  );
  ctx.session.lastInvoiceId = invoice.id;
  await showInvoice(ctx, invoice);
}
