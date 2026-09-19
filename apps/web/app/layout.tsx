import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'RemnaRay',
  description: 'Telegram-first subscription shop for Remnawave panels',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
