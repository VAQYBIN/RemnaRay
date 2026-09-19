import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  createRemnawaveClient,
  type PanelUser,
  type RemnawaveClient,
} from '@remnaray/remnawave-sdk';

import { Infrastructure } from '../../infra/infra.module';
import { SettingsService } from '../settings/settings.service';

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

  async syncUser(userId: string, reason: string): Promise<PanelUser | null> {
    const user = await this.infra.db.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const subscription = await this.infra.db.subscription.findFirst({
      where: { userId, status: { in: ['provisioning', 'active', 'grace'] } },
      orderBy: { expiresAt: 'desc' },
    });
    const client = await this.client();
    try {
      let panelUser = await this.infra.db.panelUser.findUnique({ where: { userId } });
      let current: PanelUser | null = panelUser
        ? await client.users.getByUuid(panelUser.panelUuid)
        : null;
      if (!current) {
        if (panelUser) await this.infra.db.panelUser.delete({ where: { userId } });
        const found = await client.users.getByTelegramId(Number(user.telegramId));
        current = chooseDuplicate(found);
        if (!current && subscription) {
          current = await client.users.create(
            desiredCreate(user, subscription, String(await this.settings.get('brand.name'))),
          );
        }
        if (!current) return null;
        panelUser = await this.saveSnapshot(userId, current, false);
      }
      if (subscription) {
        const desired = desiredUpdate(subscription, user.telegramId, user.email, current.uuid);
        current = await client.users.update(desired);
        if (current.status === 'DISABLED' && subscription.status === 'active')
          current = await client.users.enable(current.uuid);
      }
      await this.saveSnapshot(userId, current, false);
      if (subscription?.status === 'provisioning')
        await this.infra.db.subscription.update({
          where: { id: subscription.id },
          data: { status: 'active' },
        });
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

  async reconcile(): Promise<{ checked: number; drifted: number }> {
    const client = await this.client();
    let drifted = 0;
    try {
      const rows = await this.infra.db.panelUser.findMany({
        take: 200,
        orderBy: { updatedAt: 'asc' },
      });
      for (const row of rows) {
        const current = await client.users.getByUuid(row.panelUuid);
        if (!current) {
          await this.syncUser(row.userId, 'reconcile:missing');
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
          await this.syncUser(row.userId, 'reconcile:drift');
          drifted += 1;
        } else await this.saveSnapshot(row.userId, current, false);
      }
      return { checked: rows.length, drifted };
    } finally {
      await client.close();
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

  async revokeSubscription(userId: string): Promise<{ subscriptionUrl: string }> {
    const lockKey = `rr:revoke:${userId}`;
    const acquired = await this.infra.redis.set(lockKey, '1', 'EX', 86_400, 'NX');
    if (acquired !== 'OK') throw new RevokeRateLimitError();
    try {
      const row = await this.infra.db.panelUser.findUnique({ where: { userId } });
      if (!row) throw new PanelUnavailableError();
      const client = await this.client();
      try {
        const updated = await client.users.revokeSubscription(row.panelUuid);
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
      uuid?: string;
      telegramId?: number;
      status?: string;
      expireAt?: string;
    };
    if (data.uuid && body.event === 'user.deleted') {
      await this.infra.db.panelUser.deleteMany({ where: { panelUuid: data.uuid } });
      return;
    }
    if (!data.uuid) return;
    const row = await this.infra.db.panelUser.findFirst({ where: { panelUuid: data.uuid } });
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
    activeInternalSquads: subscription.squads.map((uuid) => ({ uuid, name: uuid })),
    tag: 'trial',
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
  uuid: string,
) {
  return {
    uuid,
    telegramId: Number(telegramId),
    email,
    expireAt: subscription.expiresAt.toISOString(),
    trafficLimitBytes: Number(subscription.trafficLimitBytes),
    trafficLimitStrategy: subscription.trafficResetStrategy as PanelUser['trafficLimitStrategy'],
    hwidDeviceLimit: subscription.deviceLimit || null,
    activeInternalSquads: subscription.squads.map((id) => ({ uuid: id, name: id })),
  };
}
function snapshot(userId: string, current: PanelUser, conflict: boolean) {
  return {
    userId,
    panelId: 1,
    panelUuid: current.uuid,
    panelUsername: current.username,
    shortUuid: current.shortUuid,
    subscriptionUrl: current.subscriptionUrl,
    panelStatus: current.status,
    usedTrafficBytes: BigInt(current.usedTrafficBytes),
    trafficLimitBytes: BigInt(current.trafficLimitBytes),
    expireAtPanel: new Date(current.expireAt),
    hwidDeviceLimit: current.hwidDeviceLimit,
    squads: current.activeInternalSquads.map((squad) => squad.uuid),
    conflict,
    syncedAt: new Date(),
    syncError: null,
  };
}
