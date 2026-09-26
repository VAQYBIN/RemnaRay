import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import type { MockRoute } from '../test-utils/render-page';

const navigationRouter = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

/**
 * A real anchor, unlike the pass-through mock the page tests use: these
 * assertions are about the markup a link renders (NFR-010).
 */
vi.mock('../i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/account',
  useRouter: () => navigationRouter,
  redirect: () => undefined,
  getPathname: () => '/account',
}));

vi.mock('next/script', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

const { renderPage } = await import('../test-utils/render-page');
const SubscriptionClient = (await import('../app/[locale]/account/subscription-client')).default;
const LoginWidget = (await import('../app/[locale]/login-widget')).default;

const userMe = {
  id: 'user-1',
  telegramId: 123,
  username: 'manta',
  firstName: 'Manta',
  language: 'ru',
  email: null,
  balance: { amountMinor: 0, currency: 'RUB' },
  balanceHeld: { amountMinor: 0, currency: 'RUB' },
  referralCode: 'AB12CD34',
  referralLink: 'https://shop.test/r/AB12CD34',
  botReferralLink: 'https://t.me/bot?start=ref_AB12CD34',
  marketingOptOut: false,
  trialAvailable: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const routes: Record<string, MockRoute> = {
  '/api/v1/me': { body: userMe },
  '/api/v1/me/subscription': { body: { subscription: null, panel: null, clients: [] } },
};

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('accessibility invariants', () => {
  it('styles links as buttons instead of nesting one inside the other', async () => {
    const document_ = parse(await renderPage(SubscriptionClient, routes));

    expect(document_.querySelectorAll('a button, button a')).toHaveLength(0);
    const link = document_.querySelector('a[href="/account/plans"]');
    expect(link?.className).toContain('inline-flex');
  });

  it('names the login container and the widget iframe the script injects', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <LoginWidget
          botUsername="manta_bot"
          errorLabel="Ошибка входа"
          label="Войти"
          locale="ru"
          unavailableLabel="—"
        />,
      );
      await Promise.resolve();
    });

    const host = container.querySelector('#login');
    expect(host?.getAttribute('role')).toBe('group');
    expect(host?.getAttribute('aria-label')).toBe('Войти');

    // The widget script puts its iframe where its own `<script>` is, so the
    // script must be inside the container the landing's «Войти» points at.
    const script = host?.querySelector('script[data-telegram-login="manta_bot"]');
    expect(script?.getAttribute('src')).toBe('https://telegram.org/js/telegram-widget.js?22');
    expect(script?.getAttribute('data-onauth')).toBe('onRemnaRayTelegramAuth(user)');
    const iframe = document.createElement('iframe');
    iframe.id = 'telegram-login-manta_bot';
    await act(async () => {
      script?.before(iframe);
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(iframe.getAttribute('title')).toBe('Войти');
    iframe.remove();

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  it('only navigates after the Telegram auth endpoint accepts the callback', async () => {
    const previousFetch = globalThis.fetch;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const payload = {
      id: 123,
      first_name: 'Manta',
      auth_date: 1,
      hash: 'a'.repeat(64),
    };

    try {
      navigationRouter.replace.mockClear();
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
      await act(async () => {
        root.render(
          <LoginWidget
            botUsername="manta_bot"
            errorLabel="Ошибка входа"
            label="Войти"
            locale="ru"
            unavailableLabel="—"
          />,
        );
        await Promise.resolve();
      });
      await act(async () => {
        window.onRemnaRayTelegramAuth?.(payload);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(navigationRouter.replace).not.toHaveBeenCalled();
      expect(container.querySelector('[role="alert"]')?.textContent).toBe('Ошибка входа');
    } finally {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      container.remove();
      globalThis.fetch = previousFetch;
    }
  });
});
