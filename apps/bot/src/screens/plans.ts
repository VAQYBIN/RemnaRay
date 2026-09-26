import { InlineKeyboard } from 'grammy';

import type { ApiClient, PublicPlan } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, formatMinor, show } from './common.js';

export async function showPlans(ctx: RrContext, api: ApiClient): Promise<void> {
  const result = await api.getPlans();
  const keyboard = new InlineKeyboard();
  for (const plan of result.items) keyboard.text(planLabel(ctx, plan), `plan:${plan.slug}`).row();
  keyboard.text(ctx.t('bot.btn.back'), 'home');
  await show(ctx, ctx.t('bot.screen.plans.title'), keyboard);
}

export async function showPlan(ctx: RrContext, api: ApiClient, slug: string): Promise<void> {
  if (!ctx.from) return;
  const plan = (await api.getPlans()).items.find((item) => item.slug === slug);
  if (!plan) {
    await show(ctx, ctx.t('bot.error.invoice_expired'), backButton(ctx, 'plans'));
    return;
  }
  const methods = await api.getPaymentMethods(ctx.from.id);
  const keyboard = new InlineKeyboard();
  for (const method of methods.items.filter((item) => item.available))
    keyboard
      .text(method.displayName[ctx.locale] ?? method.code, `pay:${plan.slug}:${method.code}`)
      .row();
  keyboard.text(ctx.t('bot.btn.back'), 'plans');
  const name = plan.name[ctx.locale] ?? plan.name.ru ?? plan.slug;
  await show(
    ctx,
    ctx.t('bot.screen.plan.details', {
      plan: name,
      price: formatMinor(plan.price.amountMinor, plan.price.currency),
      days: plan.durationDays,
    }),
    keyboard,
  );
}

function planLabel(ctx: RrContext, plan: PublicPlan): string {
  const name = plan.name[ctx.locale] ?? plan.name.ru ?? plan.slug;
  return `${name} · ${formatMinor(plan.price.amountMinor, plan.price.currency)}`;
}
