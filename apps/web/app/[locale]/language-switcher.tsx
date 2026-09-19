'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { usePathname, useRouter } from '../../i18n/navigation';
import { routing, type Locale } from '../../i18n/routing';

export default function LanguageSwitcher({
  current,
  enabled,
}: {
  current: Locale;
  enabled: string[];
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const locales = routing.locales.filter((locale) => enabled.includes(locale));
  if (locales.length < 2) return null;

  return (
    <div className="flex items-center gap-1" role="group">
      {locales.map((locale) => (
        <button
          aria-current={locale === current ? 'true' : undefined}
          className={
            locale === current
              ? 'rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground'
              : 'rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground'
          }
          disabled={pending}
          key={locale}
          lang={locale}
          type="button"
          onClick={() => {
            startTransition(() => {
              router.replace(pathname, { locale });
            });
          }}
        >
          {t(`language.${locale}`)}
        </button>
      ))}
    </div>
  );
}
