import { getTranslations } from 'next-intl/server';

import { getPublicConfig } from '../../lib/public-config';
import { Link } from '../../i18n/navigation';
import type { Locale } from '../../i18n/routing';
import LanguageSwitcher from './language-switcher';

function supportHref(contact: string): string | null {
  if (!contact) return null;
  if (contact.startsWith('http')) return contact;
  if (contact.startsWith('@')) return `https://t.me/${contact.slice(1)}`;
  if (contact.includes('@')) return `mailto:${contact}`;
  return null;
}

export default async function SiteFooter({ locale }: { locale: Locale }) {
  const [t, config] = await Promise.all([getTranslations('landing'), getPublicConfig()]);
  const support = supportHref(config.brand.supportContact);

  return (
    <footer className="border-t border-border px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <nav aria-label={t('legal.terms')} className="flex flex-wrap gap-4">
          <Link href="/terms">{t('legal.terms')}</Link>
          <Link href="/privacy">{t('legal.privacy')}</Link>
          <Link href="/offer">{t('legal.offer')}</Link>
          {support ? (
            <a href={support} rel="noreferrer">
              {t('footer.support')}
            </a>
          ) : null}
        </nav>
        <div className="flex items-center gap-4">
          <LanguageSwitcher current={locale} enabled={config.locales.enabled} />
          {config.brand.hidePoweredBy ? null : <span>{t('footer.poweredBy')}</span>}
        </div>
      </div>
    </footer>
  );
}
