'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { z } from 'zod';

import { Button, cn } from '@remnaray/ui';

import { browserApi } from '../../../lib/api';
import { invalidate } from '../../../lib/resource';
import { Link, usePathname, useRouter } from '../../../i18n/navigation';
import type { Locale } from '../../../i18n/routing';

const links = [
  { href: '/account', key: 'subscription' },
  { href: '/account/plans', key: 'plans' },
  { href: '/account/balance', key: 'balance' },
  { href: '/account/referrals', key: 'referrals' },
  { href: '/account/devices', key: 'devices' },
  { href: '/account/settings', key: 'settings' },
] as const;

export default function AccountNav({
  locale,
  showReferrals,
  showTopUp,
}: {
  locale: Locale;
  showReferrals: boolean;
  showTopUp: boolean;
}) {
  const t = useTranslations('account');
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const visible = links.filter(
    (link) => (link.key !== 'referrals' || showReferrals) && (link.key !== 'balance' || showTopUp),
  );

  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
      <ul className="flex flex-wrap gap-1">
        {visible.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
                href={link.href}
              >
                {t(`nav.${link.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
      <Button
        disabled={pending}
        size="sm"
        variant="secondary"
        onClick={() => {
          startTransition(async () => {
            await browserApi()
              .send('POST', 'api/v1/auth/logout', z.unknown())
              .catch(() => undefined);
            invalidate();
            router.replace('/', { locale });
          });
        }}
      >
        {t('logout')}
      </Button>
    </nav>
  );
}
