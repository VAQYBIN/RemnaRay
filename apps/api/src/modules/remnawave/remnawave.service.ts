import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  createRemnawaveClient,
  PanelError,
  type PanelUser,
  type RemnawaveClient,
} from '@remnaray/remnawave-sdk';

import { Infrastructure } from '../../infra/infra.module';
import { SettingsService } from '../settings/settings.service';
import { emitWebhook, subscriptionData } from '../webhooks/outgoing';

/** EX-01: how long a subscription may stay `provisioning`. */
const PROVISIONING_DEADLINE_MS = 24 * 60 * 60 * 1000;

/** Section 10.3: `rr:lock:panel:<userId>`, PX 30 s. */
const PANEL_LOCK_MS = 30_000;
const RELEASE_LOCK = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0`;

/** Another panel write for the user holds the lock; the job is retried. */
export class PanelBusyError extends Error {
  readonly code = 'PANEL_BUSY';
  constructor(userId: string) {
    super(`another panel operation holds the lock of user ${userId}`);
  }
}

export class PanelUnavailableError extends Error {
  readonly code = 'PANEL_UNAVAILABLE';
  constructor() {
    super('Remnawave panel is unavailable');
  }
}

export class RevokeRateLimitError extends Error {
  readonly code = 'REVOKE_RATE_LIMITED';
  constructor() {
    super('Subscription link can be reset once per 24 hours');
  }
}

@Injectable()
export class RemnawaveService {
  constructor(
    private readonly infra: Infrastructure,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Section 10.3: one panel write per user at a time, whichever job it is and
   * however many run at once (the `panel` worker runs two). Taken with a token
   * and released only by its holder, so an operation outliving the 30 s does
   * not release the next holder's lock.
   */
  private async locked<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    const key = `rr:lock:panel:${userId}`;
    const token = randomUUID();
    if ((await this.infra.redis.set(key, token, 'PX', PANEL_LOCK_MS, 'NX')) !== 'OK')
      throw new PanelBusyError(userId);
    try {
      return await operation();
    } finally {
      await this.infra.redis.eval(RELEASE_LOCK, 1, key, token);
    }
  }

  async syncUser(userId: string, reason: string): Promise<PanelUser | null> {
    return this.locked(userId, () => this.sync(userId, reason));
  }

  private async sync(userId: string, reason: string): Promise<PanelUser | null> {
    const user = await this.infra.db.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const subscription = await this.infra.db.subscription.findFirst({
      where: { userId, status: { in: ['provisioning', 'active', 'grace'] } },
      orderBy: { expiresAt: 'desc' },
    });
    const plan = subscription?.planId
      ? await this.infra.db.plan.findUnique({
          where: { id: subscription.planId },
          select: { slug: true },
        })
      : null;
    const tag = panelTag(plan?.slug ?? null);
    const client = await this.client();
    try {
      let panelUser = await this.infra.db.panelUser.findUnique({ where: { userId } });
      let current: PanelUser | null = panelUser
        ? panelUser.panelUserId === null
          ? null
          : await client.users.getById(panelUser.panelUserId)
        : null;
      if (!current) {
        if (panelUser) await this.infra.db.panelUser.delete({ where: { userId } });
        const found = await client.users.getByTelegramId(Number(user.telegramId));
        current = chooseDuplicate(found);
        if (!current && subscription) {
          current = await client.users.create(
            desiredCreate(user, subscription, String(await this.settings.get('brand.name')), tag),
          );
        }
        if (!current) return null;
        panelUser = await this.saveSnapshot(userId, current, false);
      }
      if (subscription) {
        const desired = desiredUpdate(subscription, user.telegramId, user.email, current.id, tag);
        current = await client.users.update(desired);
        if (current.status === 'DISABLED' && subscription.status === 'active')
          current = await client.users.enable(current.id);
      } else if (current.status !== 'DISABLED' && (await this.revoked(userId, user.isBanned))) {
        // FR-141: a ban revokes the subscription and disables the panel user.
        // With no live subscription there is nothing else to write.
        current = await client.users.disable(current.id);
      }
      await this.saveSnapshot(userId, current, false);
      if (subscription?.status === 'provisioning') await this.activate(subscription);
      return current;
    } catch (error) {
      await this.infra.db.panelUser.updateMany({
        where: { userId },
        data: {
          syncError: `${reason}: ${error instanceof Error ? error.message : 'unknown error'}`,
        },
      });
      throw error;
    } finally {
      await client.close();
    }
  }

  /** A banned user, or one whose latest subscription was revoked. */
  private async revoked(userId: string, isBanned: boolean): Promise<boolean> {
    if (isBanned) return true;
    const latest = await this.infra.db.subscription.findFirst({
      where: { userId },
      orderBy: { expiresAt: 'desc' },
      select: { status: true },
    });
    return latest?.status === 'revoked';
  }

  /**
   * EX-01 completion (section 10.3): `provisioning → active` once the panel has
   * the user, with `subscription.activated` (9.8) and the customer's
   * `sub.activated` message carrying the link. Conditional on the status, so
   * two syncs activate once.
   */
  private async activate(subscription: {
    id: string;
    userId: string;
    planId: string | null;
    source: string;
    startsAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    await this.infra.db.$transaction(async (tx) => {
      const { count } = await tx.subscription.updateMany({
        where: { id: subscription.id, status: 'provisioning' },
        data: { status: 'active' },
      });
      if (count === 0) return;
      await emitWebhook(
        tx,
        'subscription.activated',
        subscription.userId,
        subscriptionData({ ...subscription, status: 'active' }),
      );
      const dedupKey = `sub.activated:${subscription.id}:${subscription.expiresAt.toISOString()}`;
      await tx.outboxJob.create({
        data: {
          queue: 'notify',
          name: 'notify.send',
          payload: {
            event: 'sub.activated',
            userId: subscription.userId,
            subscriptionId: subscription.id,
            dedupKey,
            params: { until: subscription.expiresAt.toISOString().slice(0, 10) },
          },
          jobId: `notify:${dedupKey}`,
        },
      });
    });
  }

  /**
   * EX-01: a subscription still `provisioning` is synced again on every
   * reconciliation, since a sync's own retries end within about an hour and a
   * user with no `panel_users` row is not otherwise revisited. After 24 h it
   * is `provisioning_failed`, and the administrators are alerted.
   */
  async retryProvisioning(now = new Date()): Promise<{ retried: number; failed: number }> {
    const stuck = await this.infra.db.subscription.findMany({
      where: { status: 'provisioning' },
      select: { id: true, userId: true, createdAt: true },
    });
    let retried = 0;
    let failed = 0;
    for (const subscription of stuck) {
      await this.infra.db.$transaction(async (tx) => {
        if (subscription.createdAt.getTime() > now.getTime() - PROVISIONING_DEADLINE_MS) {
          await tx.outboxJob.create({
            data: {
              queue: 'panel',
              name: 'panel.sync-user',
              payload: { userId: subscription.userId, reason: 'provisioning' },
              jobId: `sync:${subscription.userId}`,
            },
          });
          retried += 1;
          return;
        }
        const { count } = await tx.subscription.updateMany({
          where: { id: subscription.id, status: 'provisioning' },
          data: { status: 'provisioning_failed' },
        });
        if (count === 0) return;
        await tx.outboxJob.create({
          data: {
            queue: 'notify',
            name: 'notify.alert',
            payload: { type: 'provisioning.failed', details: subscription.userId },
            jobId: `alert:provisioning.failed:${subscription.id}`,
          },
        });
        failed += 1;
      });
    }
    return { retried, failed };
  }

  async reconcile(): Promise<{
    checked: number;
    drifted: number;
    retried: number;
    failed: number;
  }> {
    // Before the panel is asked anything: a panel that is down is the reason
    // these are still waiting.
    const provisioning = await this.retryProvisioning();
    const client = await this.client();
    let drifted = 0;
    try {
      const rows = await this.infra.db.panelUser.findMany({
        take: 200,
        orderBy: { updatedAt: 'asc' },
      });
      for (const row of rows) {
        if (row.panelUserId === null) {
          await this.resync(row.userId, 'reconcile:legacy-panel-id');
          drifted += 1;
          continue;
        }
        const current = await client.users.getById(row.panelUserId);
        if (!current) {
          await this.resync(row.userId, 'reconcile:missing');
          drifted += 1;
          continue;
        }
        const subscription = await this.infra.db.subscription.findFirst({
          where: { userId: row.userId, status: { in: ['provisioning', 'active', 'grace'] } },
          orderBy: { expiresAt: 'desc' },
        });
        const expiresDrift =
          subscription &&
          Math.abs(currentExpire(current) - subscription.expiresAt.getTime()) > 60_000;
        const trafficDrift =
          subscription && current.trafficLimitBytes !== Number(subscription.trafficLimitBytes);
        const squadDrift =
          subscription &&
          !sameSet(
            current.activeInternalSquads.map((squad) => squad.uuid),
            subscription.squads,
          );
        if (
          expiresDrift ||
          trafficDrift ||
          squadDrift ||
          (subscription?.status === 'active' && current.status === 'DISABLED')
        ) {
          await this.resync(row.userId, 'reconcile:drift');
          drifted += 1;
        } else await this.saveSnapshot(row.userId, current, false);
      }
      return { checked: rows.length, drifted, ...provisioning };
    } finally {
      await client.close();
    }
  }

  /** A user whose panel write is under way is left to that write. */
  private async resync(userId: string, reason: string): Promise<void> {
    try {
      await this.syncUser(userId, reason);
    } catch (error) {
      if (!(error instanceof PanelBusyError)) throw error;
    }
  }

  async health() {
    const client = await this.client();
    try {
      return await client.system.health();
    } finally {
      await client.close();
    }
  }

  /** HWID devices registered for the user's panel account (FR-026). */
  async devices(userId: string): Promise<
    {
      hwid: string;
      platform: string | null;
      osVersion: string | null;
      deviceModel: string | null;
      createdAt: string | null;
    }[]
  > {
    const row = await this.infra.db.panelUser.findUnique({ where: { userId } });
    if (!row) return [];
    const client = await this.client();
    try {
      if (row.panelUserId === null) throw new PanelUnavailableError();
      const devices = await client.hwid.list(row.panelUserId);
      return devices.flatMap((device) => {
        const hwid = typeof device.hwid === 'string' ? device.hwid : null;
        if (!hwid) return [];
        return [
          {
            hwid,
            platform: typeof device.platform === 'string' ? device.platform : null,
            osVersion: typeof device.osVersion === 'string' ? device.osVersion : null,
            deviceModel: typeof device.deviceModel === 'string' ? device.deviceModel : null,
            createdAt: typeof device.createdAt === 'string' ? device.createdAt : null,
          },
        ];
      });
    } finally {
      await client.close();
    }
  }

  async removeDevice(userId: string, hwid: string): Promise<void> {
    const row = await this.infra.db.panelUser.findUnique({ where: { userId } });
    if (!row) throw new PanelUnavailableError();
    const client = await this.client();
    try {
      if (row.panelUserId === null) throw new PanelUnavailableError();
      await client.hwid.remove(row.panelUserId, hwid);
    } finally {
      await client.close();
    }
  }

  async revokeSubscription(userId: string): Promise<{ subscriptionUrl: string }> {
    const lockKey = `rr:revoke:${userId}`;
    const acquired = await this.infra.redis.set(lockKey, '1', 'EX', 86_400, 'NX');
    if (acquired !== 'OK') throw new RevokeRateLimitError();
    try {
      const row = await this.infra.db.panelUser.findUnique({ where: { userId } });
      if (!row) throw new PanelUnavailableError();
      const client = await this.client();
      try {
        if (row.panelUserId === null) throw new PanelUnavailableError();
        const updated = await client.users.revokeSubscription(row.panelUserId);
        await this.saveSnapshot(userId, updated, false);
        return { subscriptionUrl: updated.subscriptionUrl };
      } finally {
        await client.close();
      }
    } catch (error) {
      await this.infra.redis.del(lockKey);
      throw error;
    }
  }

  /**
   * Queue consumer for `panel.reset-traffic` (`POST /api/users/{userId}/
   * actions/reset-traffic`, ADR-010): the console's "reset traffic" (FR-141),
   * a renewal of the same plan (10.4), and a downgrade (FR-023). A downgrade
   * passes the new limit as `ifUsedAboveBytes`, and the traffic is reset only
   * when the panel reports more used than that, read when the job runs. A
   * user the panel does not know yet has no traffic to reset.
   */
  async resetTraffic(userId: string, ifUsedAboveBytes?: bigint): Promise<{ reset: boolean }> {
    return this.locked(userId, () => this.reset(userId, ifUsedAboveBytes));
  }

  private async reset(userId: string, ifUsedAboveBytes?: bigint): Promise<{ reset: boolean }> {
    const row = await this.infra.db.panelUser.findUnique({ where: { userId } });
    if (!row || row.panelUserId === null) return { reset: false };
    const client = await this.client();
    try {
      if (ifUsedAboveBytes !== undefined) {
        const current = await client.users.getById(row.panelUserId);
        if (!current || BigInt(current.userTraffic.usedTrafficBytes) <= ifUsedAboveBytes)
          return { reset: false };
      }
      const updated = await client.users.resetTraffic(row.panelUserId);
      await this.saveSnapshot(userId, updated, false);
      return { reset: true };
    } finally {
      await client.close();
    }
  }

  /**
   * Queue consumer for `panel.delete-user`: section 19.5 anonymization deletes
   * the panel user (`DELETE /api/users/{userId}`, ADR-010). A panel that no
   * longer has the user answers 404, which is the state asked for. The local
   * mapping goes too, so reconciliation does not look for the user again.
   */
  async deleteUser(userId: string): Promise<{ deleted: boolean }> {
    return this.locked(userId, () => this.remove(userId));
  }

  private async remove(userId: string): Promise<{ deleted: boolean }> {
    const row = await this.infra.db.panelUser.findUnique({ where: { userId } });
    if (!row) return { deleted: false };
    if (row.panelUserId !== null) {
      const client = await this.client();
      try {
        await client.users.delete(row.panelUserId);
      } catch (error) {
        if (!(error instanceof PanelError && error.status === 404)) throw error;
      } finally {
        await client.close();
      }
    }
    await this.infra.db.panelUser.deleteMany({ where: { userId } });
    return { deleted: true };
  }

  async verifyWebhook(
    body: unknown,
    signature: string | undefined,
    timestamp: string | undefined,
  ): Promise<boolean> {
    const secret = await this.settings.get('panel.webhook_secret');
    if (typeof secret !== 'string' || !secret || !signature || !timestamp) return false;
    const age = Math.abs(Date.now() - Date.parse(timestamp));
    if (!Number.isFinite(age) || age > 300_000) return false;
    const expected = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    const actual = Buffer.from(signature, 'hex');
    const calculated = Buffer.from(expected, 'hex');
    return actual.length === calculated.length && timingSafeEqual(actual, calculated);
  }

  async handleWebhook(body: unknown): Promise<void> {
    if (typeof body !== 'object' || body === null || !('event' in body) || !('data' in body))
      return;
    const data = body.data as {
      id?: number;
      telegramId?: number;
      status?: string;
      expireAt?: string;
    };
    if (typeof data.id === 'number' && body.event === 'user.deleted') {
      await this.infra.db.panelUser.deleteMany({ where: { panelUserId: data.id } });
      return;
    }
    if (typeof data.id !== 'number') return;
    const row = await this.infra.db.panelUser.findFirst({ where: { panelUserId: data.id } });
    if (!row) return;
    await this.infra.db.panelUser.update({
      where: { userId: row.userId },
      data: {
        panelStatus: data.status ?? 'ACTIVE',
        ...(data.expireAt ? { expireAtPanel: new Date(data.expireAt) } : {}),
        syncedAt: new Date(),
        syncError: null,
      },
    });
  }

  private async client(): Promise<RemnawaveClient> {
    const baseUrl = await this.settings.get('panel.base_url');
    const apiToken = await this.settings.get('panel.api_token');
    if (typeof baseUrl !== 'string' || !baseUrl || typeof apiToken !== 'string' || !apiToken)
      throw new PanelUnavailableError();
    return createRemnawaveClient({
      baseUrl,
      apiToken,
      extraHeaders: (await this.settings.get('panel.extra_headers')) as Record<string, string>,
    });
  }

  private async saveSnapshot(userId: string, current: PanelUser, conflict: boolean) {
    return this.infra.db.panelUser.upsert({
      where: { userId },
      create: snapshot(userId, current, conflict),
      update: snapshot(userId, current, conflict),
    });
  }
}

/**
 * Section 10.3 tags the panel user with the plan's slug, or `trial`. The
 * panel takes `/^[A-Z0-9_]+$/`, at most 16 characters (remnawave/backend
 * `create-user.command.ts`, `update-user.command.ts`), and refuses anything
 * else with 400; a slug is `[a-z0-9][a-z0-9_-]{0,63}`, so it is upper-cased,
 * `-` becomes `_`, and it is cut to 16.
 */
export function panelTag(slug: string | null): string {
  return (slug ?? 'trial')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/gu, '_')
    .slice(0, 16);
}

function chooseDuplicate(users: PanelUser[]): PanelUser | null {
  return (
    [...users].sort(
      (left, right) =>
        Number(right.status === 'ACTIVE') - Number(left.status === 'ACTIVE') ||
        Date.parse(right.expireAt) - Date.parse(left.expireAt),
    )[0] ?? null
  );
}
function currentExpire(user: PanelUser): number {
  return Date.parse(user.expireAt);
}
function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}
function desiredCreate(
  user: { telegramId: bigint; email: string | null },
  subscription: {
    expiresAt: Date;
    trafficLimitBytes: bigint;
    trafficResetStrategy: string;
    deviceLimit: number;
    squads: string[];
  },
  brand: string,
  tag: string,
) {
  return {
    username: `rr_${user.telegramId.toString()}`,
    telegramId: Number(user.telegramId),
    email: user.email,
    description: `RemnaRay ${brand}`,
    expireAt: subscription.expiresAt.toISOString(),
    trafficLimitBytes: Number(subscription.trafficLimitBytes),
    trafficLimitStrategy: subscription.trafficResetStrategy as PanelUser['trafficLimitStrategy'],
    hwidDeviceLimit: subscription.deviceLimit || null,
    activeInternalSquads: subscription.squads,
    tag,
  };
}
function desiredUpdate(
  subscription: {
    expiresAt: Date;
    trafficLimitBytes: bigint;
    trafficResetStrategy: string;
    deviceLimit: number;
    squads: string[];
  },
  telegramId: bigint,
  email: string | null,
  id: number,
  tag: string,
) {
  return {
    id,
    tag,
    telegramId: Number(telegramId),
    email,
    expireAt: subscription.expiresAt.toISOString(),
    trafficLimitBytes: Number(subscription.trafficLimitBytes),
    trafficLimitStrategy: subscription.trafficResetStrategy as PanelUser['trafficLimitStrategy'],
    hwidDeviceLimit: subscription.deviceLimit || null,
    activeInternalSquads: subscription.squads,
  };
}
function snapshot(userId: string, current: PanelUser, conflict: boolean) {
  return {
    userId,
    panelId: 1,
    panelUserId: current.id,
    panelUuid: current.vlessUuid,
    panelUsername: current.username,
    shortUuid: current.shortUuid,
    subscriptionUrl: current.subscriptionUrl,
    panelStatus: current.status,
    usedTrafficBytes: BigInt(current.userTraffic.usedTrafficBytes),
    trafficLimitBytes: BigInt(current.trafficLimitBytes),
    expireAtPanel: new Date(current.expireAt),
    hwidDeviceLimit: current.hwidDeviceLimit,
    squads: current.activeInternalSquads.map((squad) => squad.uuid),
    conflict,
    syncedAt: new Date(),
    syncError: null,
  };
}
