'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@remnaray/ui';

/** Schemes a client template may never name: they would run in this page. */
const BLOCKED_SCHEMES = new Set(['javascript', 'data', 'vbscript', 'file', 'blob']);

/**
 * The client's deep link for the subscription link carried in the fragment,
 * or null when either is unusable. Only a configured template is ever opened,
 * and only with an https subscription link. The page cannot tell the shop's
 * links from anybody else's, so it never opens one by itself: the customer
 * sees the server's address and taps.
 */
export function deepLinkFor(template: string, fragment: string): string | null {
  let value: string;
  try {
    value = decodeURIComponent(fragment.replace(/^#/u, ''));
  } catch {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/iu.exec(template)?.[1]?.toLowerCase();
  if (!scheme || BLOCKED_SCHEMES.has(scheme)) return null;
  return template.replaceAll('{url}', encodeURIComponent(value));
}

export default function OpenClient({
  name,
  template,
  storeUrls,
}: {
  name: string;
  template: string;
  storeUrls: Record<string, string>;
}) {
  const t = useTranslations('account');
  const { toast } = useToast();
  const [target, setTarget] = useState<
    { link: string; subscription: string; host: string } | null | undefined
  >(undefined);

  useEffect(() => {
    const link = deepLinkFor(template, window.location.hash);
    if (!link) {
      setTarget(null);
      return;
    }
    const subscription = decodeURIComponent(window.location.hash.slice(1));
    setTarget({ link, subscription, host: new URL(subscription).host });
  }, [template]);

  const stores = Object.entries(storeUrls).filter(([, url]) => /^https?:\/\//u.test(url));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('open.title', { client: name })}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {target === null ? (
          <p className="text-sm text-muted-foreground">{t('open.missing')}</p>
        ) : target ? (
          <>
            <p className="text-sm">{t('open.server', { host: target.host })}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={target.link} rel="noreferrer">
                  {t('open.button', { client: name })}
                </a>
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(target.subscription).then(() => {
                    toast({ title: t('subscription.copied') });
                  });
                }}
              >
                {t('subscription.copy')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t('open.hint')}</p>
          </>
        ) : null}
        {stores.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {stores.map(([platform, url]) => (
              <li key={platform}>
                <Button asChild size="sm" variant="secondary">
                  <a href={url} rel="noreferrer">
                    {t('open.install', { platform })}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
