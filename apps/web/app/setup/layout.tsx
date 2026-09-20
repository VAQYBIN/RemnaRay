import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';

import { ToastProvider } from '@remnaray/ui';

import { adminLocale, adminMessages, adminTheme, adminThemeStyle } from '../../lib/admin';
import { getAdminLanguage } from '../../lib/admin-config';
import '../globals.css';

export const metadata: Metadata = {
  title: 'RemnaRay — setup',
  robots: { index: false, follow: false },
};

/** Section 18.2: the wizard always uses the neutral `_admin` theme. */
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const locale = adminLocale(await getAdminLanguage());
  const theme = adminTheme();
  return (
    <html lang={locale}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: adminThemeStyle(theme) }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={adminMessages(locale)}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
