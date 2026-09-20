import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import type { AdminRole } from '@remnaray/domain/rbac';

import { Infrastructure } from '../../infra/infra.module';
import { Audited } from '../admin/audit.interceptor';
import { ApiError } from '../me/me.errors';

/** Section 15.6 alphabet: no look-alike glyphs. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const OPERATOR_MAX_USES = 100;

const promocodeInputSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u),
  type: z.enum(['discount_percent', 'discount_fixed', 'bonus_days', 'bonus_balance']),
  value: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(BigInt),
  maxUses: z.number().int().positive().nullable().default(null),
  maxUsesPerUser: z.number().int().positive().default(1),
  validFrom: z.iso.datetime().nullable().default(null),
  validUntil: z.iso.datetime().nullable().default(null),
  planIds: z.array(z.uuid()).default([]),
  firstPurchaseOnly: z.boolean().default(false),
  minAmountMinor: z
    .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
    .transform(BigInt)
    .default(0n),
  isActive: z.boolean().default(true),
});

const promocodePatchSchema = promocodeInputSchema.partial().extend({
  reason: z.string().min(3).max(500).optional(),
});

const generateSchema = promocodeInputSchema.omit({ code: true }).extend({
  count: z.number().int().min(1).max(1000),
  prefix: z
    .string()
    .max(16)
    .regex(/^[A-Z0-9-]*$/u)
    .default(''),
});

const listQuerySchema = z.object({
  q: z.string().min(1).max(64).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

function randomCode(length = 8): string {
  let code = '';
  for (let index = 0; index < length; index += 1)
    code += ALPHABET[randomInt(ALPHABET.length)] ?? 'A';
  return code;
}

function view(promocode: {
  id: string;
  code: string;
  type: string;
  value: bigint;
  maxUses: number | null;
  maxUsesPerUser: number;
  usedCount: number;
  validFrom: Date | null;
  validUntil: Date | null;
  planIds: string[];
  firstPurchaseOnly: boolean;
  minAmountMinor: bigint;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: promocode.id,
    code: promocode.code,
    type: promocode.type,
    value: Number(promocode.value),
    maxUses: promocode.maxUses,
    maxUsesPerUser: promocode.maxUsesPerUser,
    usedCount: promocode.usedCount,
    validFrom: promocode.validFrom?.toISOString() ?? null,
    validUntil: promocode.validUntil?.toISOString() ?? null,
    planIds: promocode.planIds,
    firstPurchaseOnly: promocode.firstPurchaseOnly,
    minAmountMinor: Number(promocode.minAmountMinor),
    isActive: promocode.isActive,
    createdAt: promocode.createdAt.toISOString(),
  };
}

@Injectable()
export class PromocodesService {
  constructor(private readonly infra: Infrastructure) {}

  async list(query: unknown) {
    const input = listQuerySchema.parse(query ?? {});
    const rows = await this.infra.db.promocode.findMany({
      where: {
        deletedAt: null,
        ...(input.q ? { code: { contains: input.q.toUpperCase() } } : {}),
        ...(input.isActive ? { isActive: input.isActive === 'true' } : {}),
      },
      orderBy: { id: 'desc' },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, input.limit);
    return {
      items: page.map(view),
      nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async create(body: unknown, admin: { id: string; role: AdminRole }) {
    const input = promocodeInputSchema.parse(body);
    this.assertOperatorAllowed(admin, input);
    const created = await this.infra.db.promocode.create({
      data: this.toData({ ...input, code: input.code.toUpperCase() }, admin.id),
    });
    return new Audited(null, view(created));
  }

  /** Section 15.6 batch generation with an optional prefix. */
  async generate(body: unknown, admin: { id: string; role: AdminRole }) {
    const input = generateSchema.parse(body);
    this.assertOperatorAllowed(admin, input);
    const codes = new Set<string>();
    while (codes.size < input.count) codes.add(`${input.prefix}${randomCode()}`);
    const list = [...codes];
    await this.infra.db.promocode.createMany({
      data: list.map((code) => this.toData({ ...input, code }, admin.id)),
      skipDuplicates: true,
    });
    return new Audited(null, { generated: list.length }, { codes: list });
  }

  async update(id: string, body: unknown, admin: { id: string; role: AdminRole }) {
    const input = promocodePatchSchema.parse(body);
    const before = await this.require(id);
    this.assertOperatorAllowed(admin, input);
    const after = await this.infra.db.promocode.update({
      where: { id },
      data: {
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.value === undefined ? {} : { value: input.value }),
        ...(input.maxUses === undefined ? {} : { maxUses: input.maxUses }),
        ...(input.maxUsesPerUser === undefined ? {} : { maxUsesPerUser: input.maxUsesPerUser }),
        ...(input.validFrom === undefined
          ? {}
          : { validFrom: input.validFrom ? new Date(input.validFrom) : null }),
        ...(input.validUntil === undefined
          ? {}
          : { validUntil: input.validUntil ? new Date(input.validUntil) : null }),
        ...(input.planIds === undefined ? {} : { planIds: input.planIds }),
        ...(input.firstPurchaseOnly === undefined
          ? {}
          : { firstPurchaseOnly: input.firstPurchaseOnly }),
        ...(input.minAmountMinor === undefined ? {} : { minAmountMinor: input.minAmountMinor }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });
    return new Audited(view(before), view(after));
  }

  async remove(id: string) {
    const before = await this.require(id);
    const after = await this.infra.db.promocode.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return new Audited(
      view(before),
      { deletedAt: after.deletedAt?.toISOString() ?? null },
      {
        deleted: true,
      },
    );
  }

  async redemptions(id: string) {
    const rows = await this.infra.db.promocodeRedemption.findMany({
      where: { promocodeId: id },
      orderBy: { id: 'desc' },
      take: 200,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        invoiceId: row.invoiceId,
        status: row.status,
        appliedValueMinor: row.appliedValueMinor === null ? null : Number(row.appliedValueMinor),
        appliedDays: row.appliedDays,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /** CSV export for the promocode table (section 14.1). */
  async exportCsv(): Promise<string> {
    const rows = await this.infra.db.promocode.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
    const header = 'code,type,value,used,max_uses,valid_until,active';
    const lines = rows.map((row) =>
      [
        row.code,
        row.type,
        row.value.toString(),
        row.usedCount.toString(),
        row.maxUses === null ? '' : row.maxUses.toString(),
        row.validUntil?.toISOString() ?? '',
        row.isActive ? 'true' : 'false',
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  /**
   * Section 14.2: an operator may create codes up to `max_uses` 100 and never a
   * `bonus_balance` code.
   */
  private assertOperatorAllowed(
    admin: { role: AdminRole },
    input: { type?: string | undefined; maxUses?: number | null | undefined },
  ): void {
    if (admin.role !== 'operator') return;
    if (input.type === 'bonus_balance')
      throw new ApiError('FORBIDDEN', HttpStatus.FORBIDDEN, 'Operators cannot grant balance.');
    if (input.maxUses === null || (input.maxUses ?? 0) > OPERATOR_MAX_USES)
      throw new ApiError('FORBIDDEN', HttpStatus.FORBIDDEN, 'Operator max_uses limit is 100.');
  }

  private toData(input: z.output<typeof promocodeInputSchema> & { code: string }, adminId: string) {
    return {
      code: input.code.toUpperCase(),
      type: input.type,
      value: input.value,
      maxUses: input.maxUses,
      maxUsesPerUser: input.maxUsesPerUser,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      planIds: input.planIds,
      firstPurchaseOnly: input.firstPurchaseOnly,
      minAmountMinor: input.minAmountMinor,
      isActive: input.isActive,
      createdBy: adminId,
    };
  }

  private async require(id: string) {
    const promocode = await this.infra.db.promocode.findFirst({
      where: { id, deletedAt: null },
    });
    if (!promocode) throw new NotFoundException('NOT_FOUND');
    return promocode;
  }
}
