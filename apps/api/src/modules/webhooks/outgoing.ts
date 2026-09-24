import { createHmac, randomBytes } from 'node:crypto';

import type { Prisma } from '@remnaray/db';
import { z } from 'zod';

/** Section 9.8 events. */
export const OUTGOING_EVENTS = [
  'user.created',
  'subscription.activated',
  'subscription.expired',
  'payment.succeeded',
  'payment.refunded',
  'referral.rewarded',
] as const;

export type OutgoingEvent = (typeof OUTGOING_EVENTS)[number];

/** The body section 9.8 sends, byte for byte the same on every retry. */
export const outgoingEventSchema = z.object({
  id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/u),
  type: z.enum(OUTGOING_EVENTS),
  createdAt: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()),
});

export type OutgoingEventBody = z.infer<typeof outgoingEventSchema>;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A ULID (the "01J…" of section 9.8): 48-bit milliseconds, 80 random bits. */
export function ulid(now = Date.now()): string {
  let time = '';
  let rest = now;
  for (let index = 0; index < 10; index += 1) {
    time = CROCKFORD.charAt(rest % 32) + time;
    rest = Math.floor(rest / 32);
  }
  const bytes = randomBytes(10);
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let random = '';
  for (let index = 0; index < 16; index += 1) {
    random = CROCKFORD.charAt(Number(bits & 31n)) + random;
    bits >>= 5n;
  }
  return time + random;
}

/** `X-RemnaRay-Signature: sha256=<hmac(body, secret)>`. */
export function signature(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** Minor units as the JSON number section 9.8 shows. */
export function minor(value: bigint): number {
  return Number(value);
}

/** The `data` of `subscription.activated` and `subscription.expired`. */
export function subscriptionData(subscription: {
  id: string;
  planId: string | null;
  source: string;
  status: string;
  startsAt: Date;
  expiresAt: Date;
}): Record<string, unknown> {
  return {
    subscriptionId: subscription.id,
    planId: subscription.planId,
    source: subscription.source,
    status: subscription.status,
    startsAt: subscription.startsAt.toISOString(),
    expiresAt: subscription.expiresAt.toISOString(),
  };
}

/**
 * Records a section 9.8 event in the transaction that made it happen. The
 * recipients live in an encrypted setting, so the event is one outbox row
 * here, and `webhooks.dispatch` fans it out to the recipients subscribed at
 * the time it runs; a rolled-back change therefore sends nothing.
 */
export async function emitWebhook(
  tx: Prisma.TransactionClient,
  type: OutgoingEvent,
  userId: string,
  data: Record<string, unknown> = {},
  now = new Date(),
): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
  const telegramId = user?.telegramId ?? null;
  const event: OutgoingEventBody = {
    id: ulid(now.getTime()),
    type,
    createdAt: now.toISOString(),
    data: {
      userId,
      telegramId: telegramId === null ? null : Number(telegramId),
      ...data,
    },
  };
  await tx.outboxJob.create({
    data: {
      queue: 'webhooks',
      name: 'webhooks.dispatch',
      payload: event as never,
      jobId: `webhook:${event.id}`,
    },
  });
}
