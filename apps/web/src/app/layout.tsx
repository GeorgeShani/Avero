import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/red-hat-mono';
import { Hardware, Toasts } from '@avero/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { themeBootScript } from '../lib/theme-boot';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Avero', template: '%s · Avero' },
  description: 'Your engineering workflow, intelligently orchestrated.',
};

// Mineral green, as OKLCH lightness, chroma and hue.
const mineral = { l: 0.5, c: 0.1, h: 163 };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // UI SDK keys its own palette on data-theme. It stays "light" because the dark theme is the
  // light skin inverted (data-skin-theme, set by the boot script).
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <Hardware data-site keyColor={mineral}>
          {children}
          <Toasts />
        </Hardware>
      </body>
    </html>
  );
}
