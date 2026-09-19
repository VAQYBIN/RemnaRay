'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
}: {
  botUsername: string;
  unavailableLabel: string;
  label: string;
}) {
  const router = useRouter();

  useEffect(() => {
    window.onRemnaRayTelegramAuth = (payload) => {
      void fetch('/api/v1/auth/telegram', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Requested-With': 'RemnaRay' },
        credentials: 'include',
        body: JSON.stringify(payload),
      }).then((response) => {
        if (response.ok) router.refresh();
      });
    };
    return () => {
      delete window.onRemnaRayTelegramAuth;
    };
  }, [router]);

  if (!botUsername) return <p className="text-sm text-muted-foreground">{unavailableLabel}</p>;

  return (
    <div aria-label={label} id="login">
      <Script
        data-onauth="onRemnaRayTelegramAuth(user)"
        data-request-access="write"
        data-size="large"
        data-telegram-login={botUsername}
        data-userpic="false"
        src="https://telegram.org/js/telegram-widget.js?22"
        strategy="afterInteractive"
      />
    </div>
  );
}
