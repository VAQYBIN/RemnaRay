'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

import { useRouter } from '../../i18n/navigation';
import type { Locale } from '../../i18n/routing';

type TelegramAuth = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onRemnaRayTelegramAuth?: (payload: TelegramAuth) => void;
  }
}

/**
 * Telegram Login Widget (section 13.3). The bot username comes from
 * `GET /api/v1/public/config`, so changing it in settings needs no rebuild.
 * The widget only renders once `/setdomain` has been configured for the bot.
 */
export default function LoginWidget({
  botUsername,
  unavailableLabel,
  label,
  errorLabel,
  locale,
}: {
  botUsername: string;
  unavailableLabel: string;
  label: string;
  errorLabel: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [error, setError] = useState(false);

  /**
   * The widget script injects its own `<iframe>` next to the `<script>` tag
   * Next.js appends to `document.body`, and it arrives without a title, which
   * fails the WCAG frame-title check (NFR-010). Name it as soon as it appears.
   */
  useEffect(() => {
    const title = () => {
      for (const frame of document.querySelectorAll('iframe[id^="telegram-login-"]:not([title])'))
        frame.setAttribute('title', label);
    };
    title();
    const observer = new MutationObserver(title);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [label]);

  useEffect(() => {
    window.onRemnaRayTelegramAuth = (payload) => {
      setError(false);
      void fetch('/api/v1/auth/telegram', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Requested-With': 'RemnaRay' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) throw new Error('telegram-auth-failed');
          router.replace('/account', { locale });
        })
        .catch(() => {
          setError(true);
        });
    };
    return () => {
      delete window.onRemnaRayTelegramAuth;
    };
  }, [errorLabel, locale, router]);

  if (!botUsername) return <p className="text-sm text-muted-foreground">{unavailableLabel}</p>;

  return (
    <div aria-label={label} id="login" role="group">
      <Script
        data-onauth="onRemnaRayTelegramAuth(user)"
        data-request-access="write"
        data-size="large"
        data-telegram-login={botUsername}
        data-userpic="false"
        src="https://telegram.org/js/telegram-widget.js?22"
        strategy="afterInteractive"
      />
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {errorLabel}
        </p>
      ) : null}
    </div>
  );
}
