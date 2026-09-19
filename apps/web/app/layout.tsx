import type { Metadata } from 'next';

import { cssVariables, themeSchema } from '@remnaray/theme-schema';
import manta from '../../../themes/manta/theme.json';

import './globals.css';

const theme = themeSchema.parse(manta);
const variables = cssVariables(theme);

function themeStyle(): string {
  const root = Object.entries(variables)
    .filter(([name]) => !name.startsWith('--color-dark-'))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  const dark = Object.entries(variables)
    .filter(([name]) => name.startsWith('--color-dark-'))
    .map(([name, value]) => `--color-${name.slice('--color-dark-'.length)}:${value}`)
    .join(';');
  return `:root{${root}}[data-theme="dark"]{${dark}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}`;
}

export const metadata: Metadata = {
  title: 'RemnaRay',
  description: 'Telegram-first subscription shop for Remnawave panels',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
