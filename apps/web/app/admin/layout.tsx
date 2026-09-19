import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';

import { ToastProvider } from '@remnaray/ui';

import { adminLocale, adminMessages, adminTheme, adminThemeStyle } from '../../lib/admin';
import { getAdminLanguage } from '../../lib/admin-config';
import '../globals.css';

export const metadata: Metadata = {
  title: 'RemnaRay — administration',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
