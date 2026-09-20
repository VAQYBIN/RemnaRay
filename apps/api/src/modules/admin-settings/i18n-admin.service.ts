import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import {
  assertIcu,
  localeDirectory,
  namespaces,
  SUPPORTED_LOCALES,
  type Locale,
} from '@remnaray/i18n-core';

import { Infrastructure } from '../../infra/infra.module';
import { Audited } from '../admin/audit.interceptor';
import { I18nService } from '../public/i18n.service';

const LEGAL_DOCUMENTS = ['terms', 'privacy', 'offer'] as const;
type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

const patchSchema = z.object({
  patch: z.record(z.string(), z.string().max(8000).nullable()),
  reason: z.string().min(3).max(500).optional(),
});

const legalSchema = z.object({
  markdown: z.string().min(1).max(200_000),
  reason: z.string().min(3).max(500).optional(),
});

function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

/** Section 18.5 override administration. */
@Injectable()
export class I18nAdminService {
  constructor(
    private readonly infra: Infrastructure,
    private readonly i18n: I18nService,
  ) {}

  async entries(lang: string, namespace: string) {
    if (!isLocale(lang) || !namespaces.includes(namespace as (typeof namespaces)[number]))
      throw new NotFoundException('NOT_FOUND');
    return { items: await this.i18n.entries(lang, namespace) };
  }

  /**
   * `null` removes an override. Every value is compiled as ICU before it is
   * stored, so a broken template can never reach a user.
   */
  async patch(lang: string, namespace: string, body: unknown, adminId: string) {
    if (!isLocale(lang) || !namespaces.includes(namespace as (typeof namespaces)[number]))
      throw new NotFoundException('NOT_FOUND');
    const input = patchSchema.parse(body);
    const before = await this.i18n.entries(lang, namespace);

    for (const [key, value] of Object.entries(input.patch)) {
      if (value === null) {
        await this.infra.db.localeOverride.deleteMany({ where: { lang, namespace, key } });
        continue;
      }
      assertIcu(lang, key, value);
      await this.infra.db.localeOverride.upsert({
        where: { lang_namespace_key: { lang, namespace, key } },
        create: { lang, namespace, key, value, updatedBy: adminId },
        update: { value, updatedBy: adminId, updatedAt: new Date() },
      });
    }
    await this.i18n.invalidate();
    const after = await this.i18n.entries(lang, namespace);
    return new Audited(
      before.filter((row) => Object.hasOwn(input.patch, row.key)),
      after.filter((row) => Object.hasOwn(input.patch, row.key)),
      { applied: Object.keys(input.patch) },
    );
  }

  async legal(doc: string, lang: string) {
    if (!LEGAL_DOCUMENTS.includes(doc as LegalDocument) || !isLocale(lang))
      throw new NotFoundException('NOT_FOUND');
    const override = (await this.i18n.namespace(lang, 'legal')).messages[`legal.${doc}.markdown`];
    const file = join(localeDirectory(), lang, 'legal', `${doc}.md`);
    return {
      doc,
      lang,
      markdown: override ?? (existsSync(file) ? readFileSync(file, 'utf8') : ''),
      overridden: override !== undefined,
    };
  }

  async setLegal(doc: string, lang: string, body: unknown, adminId: string) {
    if (!LEGAL_DOCUMENTS.includes(doc as LegalDocument) || !isLocale(lang))
      throw new NotFoundException('NOT_FOUND');
    const input = legalSchema.parse(body);
    const before = await this.legal(doc, lang);
    const key = `legal.${doc}.markdown`;
    await this.infra.db.localeOverride.upsert({
      where: { lang_namespace_key: { lang, namespace: 'legal', key } },
      create: { lang, namespace: 'legal', key, value: input.markdown, updatedBy: adminId },
      update: { value: input.markdown, updatedBy: adminId, updatedAt: new Date() },
    });
    await this.i18n.invalidate();
    return new Audited(
      { length: before.markdown.length },
      { length: input.markdown.length },
      { saved: true },
    );
  }
}
