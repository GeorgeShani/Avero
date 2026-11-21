import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/red-hat-mono';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { themeBootScript } from '../lib/theme-boot';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Avero', template: '%s · Avero' },
  description: 'Your engineering workflow, intelligently orchestrated.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // UI SDK keys its own palette on data-theme. It stays "light" because the marketing skin's dark
  // theme is the light skin inverted (data-skin-theme, set by the boot script). The console reads
  // the same data-skin-theme attribute for its own light and dark tokens.
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
