import { InlineKeyboard } from 'grammy';

import type { ApiClient } from '../api-client.js';
import type { RrContext } from '../types.js';
import { backButton, formatDate, formatMinor, show } from './common.js';

/**
 * Section 12 `ref` (FR-151): the bot link `t.me/<bot>?start=ref_<code>`, the
 * statistics — invited, paid, earned — and the programme's terms, with
 * `ref:share` (switch_inline_query with the invitation), `ref:list` and back.
 */
export async function showReferrals(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const [state, config] = await Promise.all([api.getReferrals(ctx.from.id), api.getConfig()]);
  const program = state.program;
  const terms =
    program.mode === 'fixed_first'
      ? ctx.t('bot.screen.ref.termsFixed', { amount: formatMinor(program.fixedMinor) })
      : program.mode === 'percent_all'
        ? ctx.t('bot.screen.ref.termsPercentAll', { percent: program.percent })
        : ctx.t('bot.screen.ref.termsPercent', { percent: program.percent });
  const bonus =
    program.inviteeBonus.type === 'none' || program.inviteeBonus.value <= 0
      ? ''
      : program.inviteeBonus.type === 'days'
        ? ctx.t('bot.screen.ref.bonusDays', { days: program.inviteeBonus.value })
        : ctx.t('bot.screen.ref.bonusBalance', {
            amount: formatMinor(program.inviteeBonus.value),
          });
  const keyboard = new InlineKeyboard()
    .switchInline(
      ctx.t('bot.btn.refShare'),
      ctx.t('bot.screen.ref.invite', { brand: config.brandName, link: state.botLink }),
    )
    .row()
    .text(ctx.t('bot.btn.refList'), 'ref:list')
    .row()
    .text(ctx.t('bot.btn.back'), 'home');
  const details = ctx.t('bot.screen.ref.details', {
    link: state.botLink,
    invited: state.invited,
    converted: state.converted,
    earned: formatMinor(state.earned.amountMinor, state.earned.currency),
  });
  await show(ctx, [details, terms, bonus].filter(Boolean).join('\n'), keyboard);
}

/** `ref:list`: the most recent invited customers, names masked (section 13.4). */
export async function showReferralList(ctx: RrContext, api: ApiClient): Promise<void> {
  if (!ctx.from) return;
  const page = await api.getReferralList(ctx.from.id);
  const lines = page.items.map((item) =>
    ctx.t('bot.screen.ref.item', {
      name: item.maskedName,
      date: formatDate(item.joinedAt),
      status: ctx.t(`bot.screen.ref.status.${item.status}`),
      reward: item.rewardMinor > 0 ? formatMinor(item.rewardMinor) : '—',
    }),
  );
  const body = lines.length > 0 ? lines.join('\n') : ctx.t('bot.screen.ref.listEmpty');
  await show(ctx, `${ctx.t('bot.screen.ref.listTitle')}\n${body}`, backButton(ctx, 'ref'));
}
