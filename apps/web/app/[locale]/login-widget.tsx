'use client';

import { useEffect, useRef, useState } from 'react';

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
  const host = useRef<HTMLDivElement>(null);

  /**
   * The widget script renders its `<iframe>` where its own `<script>` element
   * is. `next/script` appends to `document.body`, which put the button at the
   * very bottom of the page, outside the `#login` block the landing's «Войти»
   * points at; the element is therefore created inside the block. The iframe
   * arrives without a title, which fails the WCAG frame-title check
   * (NFR-010), so it is named as soon as it appears.
   */
  useEffect(() => {
    const container = host.current;
    if (!container || !botUsername) return;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = 'large';
    script.dataset.userpic = 'false';
    script.dataset.requestAccess = 'write';
    script.dataset.onauth = 'onRemnaRayTelegramAuth(user)';
    container.prepend(script);
    const title = () => {
      for (const frame of container.querySelectorAll('iframe[id^="telegram-login-"]:not([title])'))
        frame.setAttribute('title', label);
    };
    const observer = new MutationObserver(title);
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const node of container.querySelectorAll(
        'script[data-telegram-login], iframe[id^="telegram-login-"]',
      ))
        node.remove();
    };
  }, [botUsername, label]);

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
    <div aria-label={label} id="login" ref={host} role="group">
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {errorLabel}
        </p>
      ) : null}
    </div>
  );
}
