import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import { compileSegment, type SegmentPlan } from '@remnaray/domain';
import { formatMessage, SUPPORTED_LOCALES, type Locale } from '@remnaray/i18n-core';

import { Infrastructure } from '../../infra/infra.module';
import { Audited } from '../admin/audit.interceptor';
import { ApiError } from '../me/me.errors';
import { SettingsService } from '../settings/settings.service';
import {
  broadcastInputSchema,
  broadcastPatchSchema,
  type BroadcastContent,
} from './broadcasts.schemas';

const CHUNK_SIZE = 500;
const PAUSE_CHECK_EVERY = 50;
const MESSAGES_PER_SECOND = 25;

const chunkSchema = z.object({
  broadcastId: z.uuid(),
  userIds: z.array(z.uuid()).min(1).max(CHUNK_SIZE),
});

type UserRow = {
  id: string;
  telegramId: bigint;
  firstName: string | null;
  language: string;
  balanceMinor?: bigint;
};

function placeholders(user: UserRow, extra: Record<string, string>): Record<string, string> {
  return { first_name: user.firstName ?? '', ...extra };
}

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly infra: Infrastructure,
    private readonly settings: SettingsService,
  ) {}

  async list() {
    const rows = await this.infra.db.broadcast.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return { items: rows.map((row) => this.view(row)) };
  }

  async get(id: string) {
    return this.view(await this.require(id));
  }

  async create(body: unknown, adminId: string) {
    const input = broadcastInputSchema.parse(body);
    const created = await this.infra.db.broadcast.create({
      data: {
        title: input.title,
        content: input.content as never,
        segment: input.segment as never,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status: 'draft',
        createdBy: adminId,
      },
    });
    return new Audited(null, this.view(created));
  }

  async update(id: string, body: unknown) {
    const input = broadcastPatchSchema.parse(body);
    const before = await this.require(id);
    if (before.status !== 'draft' && before.status !== 'paused')
      throw new ApiError('CONFLICT', HttpStatus.CONFLICT, 'A running broadcast cannot be edited.');
    const after = await this.infra.db.broadcast.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.content === undefined ? {} : { content: input.content as never }),
        ...(input.segment === undefined ? {} : { segment: input.segment as never }),
        ...(input.scheduledAt === undefined
          ? {}
          : { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }),
      },
    });
    return new Audited(this.view(before), this.view(after));
  }

  async remove(id: string) {
    const before = await this.require(id);
    const after = await this.infra.db.broadcast.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'canceled' },
    });
    return new Audited(this.view(before), this.view(after), { deleted: true });
  }

  /** Section 16.3 preview: the count and a masked sample. */
  async previewSegment(id: string) {
    const broadcast = await this.require(id);
    const ids = await this.resolveAudience(broadcast.segment);
    const sample = await this.infra.db.user.findMany({
      where: { id: { in: ids.slice(0, 5) } },
      select: { firstName: true, username: true },
    });
    return {
      count: ids.length,
      sample: sample.map((row) => ({
        maskedName: maskName(row.firstName ?? row.username ?? ''),
      })),
    };
  }

  /** «Тест на себя»: delivers to the administrator's own Telegram account. */
  async test(id: string, adminId: string) {
    const broadcast = await this.require(id);
    const admin = await this.infra.db.admin.findUnique({ where: { id: adminId } });
    if (!admin?.telegramId)
      throw new ApiError(
        'VALIDATION_ERROR',
        HttpStatus.BAD_REQUEST,
        'No Telegram id on this admin.',
      );
    const language = String(await this.settings.get('admin.language'));
    const locale: Locale = language === 'en' ? 'en' : 'ru';
    const content = broadcast.content as BroadcastContent;
    await this.deliver(
      admin.telegramId,
      this.render(content, locale, {
        first_name: admin.email,
        days_left: '0',
        plan: '',
        balance: '',
      }),
      await this.keyboard(content, locale),
      content.photo,
    );
    return { sent: true };
  }

  /**
   * Materializes the audience once (section 16.4) and queues chunks of 500.
   * A resumed run reuses the same deliveries, so nobody is messaged twice.
   */
  async start(id: string) {
    const broadcast = await this.require(id);
    if (broadcast.status === 'running')
      throw new ApiError('CONFLICT', HttpStatus.CONFLICT, 'Already running.');
    const resuming = broadcast.status === 'paused';
    const ids = resuming
      ? (
          await this.infra.db.broadcastDelivery.findMany({
            where: { broadcastId: id, status: 'pending' },
            select: { userId: true },
          })
        ).map((row) => row.userId)
      : await this.materialize(id, broadcast.segment);

    const after = await this.infra.db.broadcast.update({
      where: { id },
      data: {
        status: 'running',
        ...(resuming ? {} : { totalCount: ids.length, startedAt: new Date() }),
      },
    });
    for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
      const slice = ids.slice(index, index + CHUNK_SIZE);
      await this.infra.db.outboxJob.create({
        data: {
          queue: 'broadcast',
          name: 'broadcast.chunk',
          payload: { broadcastId: id, userIds: slice },
          jobId: `broadcast:${id}:${String(index)}:${String(after.startedAt?.getTime() ?? 0)}`,
        },
      });
    }
    return new Audited({ status: broadcast.status }, { status: 'running', queued: ids.length });
  }

  async setStatus(id: string, status: 'paused' | 'canceled' | 'running') {
    const before = await this.require(id);
    const after = await this.infra.db.broadcast.update({
      where: { id },
      data: { status, ...(status === 'canceled' ? { finishedAt: new Date() } : {}) },
    });
    return new Audited({ status: before.status }, { status: after.status });
  }

  async report(id: string) {
    const broadcast = await this.require(id);
    const grouped = await this.infra.db.broadcastDelivery.groupBy({
      by: ['status'],
      where: { broadcastId: id },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    const failures = await this.infra.db.broadcastDelivery.findMany({
      where: { broadcastId: id, status: 'failed' },
      take: 200,
    });
    return {
      broadcast: this.view(broadcast),
      counts: {
        pending: counts['pending'] ?? 0,
        sent: counts['sent'] ?? 0,
        blocked: counts['blocked'] ?? 0,
        failed: counts['failed'] ?? 0,
      },
      durationMs:
        broadcast.startedAt && broadcast.finishedAt
          ? broadcast.finishedAt.getTime() - broadcast.startedAt.getTime()
          : null,
      failures: failures.map((row) => ({ userId: row.userId, error: row.error })),
    };
  }

  async failuresCsv(id: string): Promise<string> {
    const rows = await this.infra.db.broadcastDelivery.findMany({
      where: { broadcastId: id, status: 'failed' },
      take: 5000,
    });
    return [
      'user_id,error',
      ...rows.map((row) => `${row.userId},"${(row.error ?? '').replaceAll('"', "'")}"`),
    ].join('\n');
  }

  /**
   * Section 16.4 chunk worker. Skips deliveries that are no longer pending, so
   * a resumed run never sends twice (AC-161), and stops as soon as the
   * broadcast leaves `running`.
   */
  async sendChunk(body: unknown) {
    const input = chunkSchema.parse(body);
    const broadcast = await this.require(input.broadcastId);
    const content = broadcast.content as BroadcastContent;
    if (broadcast.status !== 'running') return { sent: 0, blocked: 0, failed: 0, stopped: true };

    const pending = await this.infra.db.broadcastDelivery.findMany({
      where: { broadcastId: input.broadcastId, userId: { in: input.userIds }, status: 'pending' },
      select: { userId: true },
    });
    const users = await this.infra.db.user.findMany({
      where: { id: { in: pending.map((row) => row.userId) } },
      select: { id: true, telegramId: true, firstName: true, language: true },
    });

    let sent = 0;
    let blocked = 0;
    let failed = 0;
    let processed = 0;

    for (const user of users) {
      if (processed > 0 && processed % PAUSE_CHECK_EVERY === 0) {
        const current = await this.infra.db.broadcast.findUnique({
          where: { id: input.broadcastId },
          select: { status: true },
        });
        if (current?.status !== 'running') return { sent, blocked, failed, stopped: true };
      }
      processed += 1;

      const locale: Locale = SUPPORTED_LOCALES.includes(user.language as Locale)
        ? (user.language as Locale)
        : 'ru';
      try {
        await this.deliver(
          user.telegramId,
          this.render(content, locale, placeholders(user, {})),
          await this.keyboard(content, locale),
          content.photo,
        );
        await this.mark(input.broadcastId, user.id, 'sent');
        sent += 1;
      } catch (error) {
        const status = error instanceof BroadcastDeliveryError ? error.status : 0;
        if (status === 403) {
          await this.infra.db.user.update({
            where: { id: user.id },
            data: { botBlockedAt: new Date() },
          });
          await this.mark(input.broadcastId, user.id, 'blocked', String(error));
          blocked += 1;
        } else if (status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await this.mark(input.broadcastId, user.id, 'failed', String(error));
          failed += 1;
        } else {
          await this.mark(input.broadcastId, user.id, 'failed', String(error));
          failed += 1;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 / MESSAGES_PER_SECOND));
    }

    await this.infra.db.broadcast.update({
      where: { id: input.broadcastId },
      data: {
        sentCount: { increment: sent },
        blockedCount: { increment: blocked },
        failedCount: { increment: failed },
      },
    });
    const remaining = await this.infra.db.broadcastDelivery.count({
      where: { broadcastId: input.broadcastId, status: 'pending' },
    });
    if (remaining === 0)
      await this.infra.db.broadcast.update({
        where: { id: input.broadcastId },
        data: { status: 'done', finishedAt: new Date() },
      });
    return { sent, blocked, failed, stopped: false };
  }

  private async mark(
    broadcastId: string,
    userId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await this.infra.db.broadcastDelivery.update({
      where: { broadcastId_userId: { broadcastId, userId } },
      data: {
        status,
        ...(status === 'sent' ? { sentAt: new Date() } : {}),
        ...(error ? { error: error.slice(0, 500) } : {}),
      },
    });
  }

  private async materialize(id: string, segment: unknown): Promise<string[]> {
    const ids = await this.resolveAudience(segment);
    for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
      await this.infra.db.broadcastDelivery.createMany({
        data: ids.slice(index, index + CHUNK_SIZE).map((userId) => ({
          broadcastId: id,
          userId,
          status: 'pending',
        })),
        skipDuplicates: true,
      });
    }
    return ids;
  }

  /** Runs the compiled plan, resolving the parts the users table cannot answer. */
  private async resolveAudience(segment: unknown): Promise<string[]> {
    const plan: SegmentPlan = compileSegment(segment);
    let where: Record<string, unknown> = { ...plan.user };

    if (plan.referrerCode) {
      const referrer = await this.infra.db.user.findFirst({
        where: { referralCode: plan.referrerCode },
        select: { id: true },
      });
      where = { ...where, referrerId: referrer?.id ?? '00000000-0000-0000-0000-000000000000' };
    }

    let candidates = (
      await this.infra.db.user.findMany({ where: where as never, select: { id: true } })
    ).map((row) => row.id);

    if (plan.subscription.length > 0)
      candidates = await this.filterBySubscription(candidates, plan);
    if (plan.transactions.length > 0)
      candidates = await this.filterByTransactions(candidates, plan);
    return candidates;
  }

  private async filterBySubscription(candidates: string[], plan: SegmentPlan): Promise<string[]> {
    const wantsNone = plan.subscription.some(
      (item) => item.field === 'status' && item.value === null,
    );
    const subscriptions = await this.infra.db.subscription.findMany({
      where: { userId: { in: candidates } },
      orderBy: { expiresAt: 'desc' },
    });
    const live = new Map<string, (typeof subscriptions)[number]>();
    for (const subscription of subscriptions)
      if (subscription.userId && !live.has(subscription.userId))
        live.set(subscription.userId, subscription);

    if (wantsNone) return candidates.filter((id) => !live.has(id));

    const plans = await this.infra.db.plan.findMany({ select: { id: true, slug: true } });
    const slugs = new Map(plans.map((row) => [row.id, row.slug]));

    return candidates.filter((id) => {
      const subscription = live.get(id);
      if (!subscription) return false;
      return plan.subscription.every((condition) => {
        const actual =
          condition.field === 'planSlug'
            ? subscription.planId
              ? slugs.get(subscription.planId)
              : null
            : subscription[condition.field];
        return matches(actual, condition.value);
      });
    });
  }

  private async filterByTransactions(candidates: string[], plan: SegmentPlan): Promise<string[]> {
    const grouped = await this.infra.db.transaction.groupBy({
      by: ['userId'],
      where: { userId: { in: candidates }, type: 'purchase', status: 'completed' },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const stats = new Map(
      grouped.map((row) => [row.userId, { count: row._count._all, last: row._max.createdAt }]),
    );
    return candidates.filter((id) => {
      const row = stats.get(id) ?? { count: 0, last: null };
      return plan.transactions.every((condition) =>
        matches(condition.field === 'purchaseCount' ? row.count : row.last, condition.value),
      );
    });
  }

  private render(
    content: BroadcastContent,
    locale: Locale,
    values: Record<string, string>,
  ): string {
    const template = content.text[locale] ?? content.text.ru ?? content.text.en ?? '';
    return formatMessage(locale, { message: template }, 'message', values);
  }

  private async keyboard(content: BroadcastContent, locale: Locale) {
    const botUsername = String(await this.settings.get('bot.username'));
    return content.buttons.map((button) => ({
      text: formatMessage(locale, { text: button.text }, 'text'),
      ...(button.type === 'url'
        ? { url: button.value }
        : button.type === 'deeplink'
          ? { url: `https://t.me/${botUsername}?start=${button.value}` }
          : { callback_data: button.value }),
    }));
  }

  private async deliver(
    telegramId: bigint,
    text: string,
    buttons: Record<string, string>[],
    photo: string | null,
  ): Promise<void> {
    const token = String(await this.settings.get('bot.token'));
    if (!token) throw new BroadcastDeliveryError(0, 'BOT_TOKEN_MISSING');
    const base = process.env.RR_TELEGRAM_API_URL ?? 'https://api.telegram.org';
    const method = photo ? 'sendPhoto' : 'sendMessage';
    const response = await fetch(`${base}/bot${encodeURIComponent(token)}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        chat_id: telegramId.toString(),
        ...(photo ? { photo, caption: text } : { text }),
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
      }),
    });
    if (!response.ok) throw new BroadcastDeliveryError(response.status, await response.text());
  }

  private view(row: {
    id: string;
    title: string;
    content: unknown;
    segment: unknown;
    status: string;
    scheduledAt: Date | null;
    totalCount: number;
    sentCount: number;
    blockedCount: number;
    failedCount: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      segment: row.segment,
      status: row.status,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      totalCount: row.totalCount,
      sentCount: row.sentCount,
      blockedCount: row.blockedCount,
      failedCount: row.failedCount,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async require(id: string) {
    const broadcast = await this.infra.db.broadcast.findFirst({ where: { id, deletedAt: null } });
    if (!broadcast) throw new NotFoundException('NOT_FOUND');
    return broadcast;
  }
}

function matches(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (typeof expected !== 'object') return normalize(actual) === normalize(expected);
  const condition = expected as Record<string, unknown>;
  if ('not' in condition)
    return condition['not'] === null
      ? actual !== null && actual !== undefined
      : normalize(actual) !== normalize(condition['not']);
  if ('in' in condition)
    return (condition['in'] as unknown[]).some((item) => normalize(actual) === normalize(item));
  if ('notIn' in condition)
    return !(condition['notIn'] as unknown[]).some((item) => normalize(actual) === normalize(item));
  if (actual === null || actual === undefined) return false;
  if ('lt' in condition) return compare(actual, condition['lt']) < 0;
  if ('lte' in condition) return compare(actual, condition['lte']) <= 0;
  if ('gt' in condition) return compare(actual, condition['gt']) > 0;
  if ('gte' in condition) return compare(actual, condition['gte']) >= 0;
  return false;
}

function normalize(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

function compare(left: unknown, right: unknown): number {
  const a = left instanceof Date ? left.getTime() : Number(left);
  const b = right instanceof Date ? right.getTime() : Number(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

function maskName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '•••';
  return `${trimmed.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, trimmed.length - 1)))}`;
}

export class BroadcastDeliveryError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`telegram ${String(status)}: ${message.slice(0, 200)}`);
    this.name = 'BroadcastDeliveryError';
  }
}
