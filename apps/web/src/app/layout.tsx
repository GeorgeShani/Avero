import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/red-hat-mono';
import { Hardware, Toasts } from '@avero/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Avero', template: '%s · Avero' },
  description: 'Your engineering workflow, intelligently orchestrated.',
};

// Mineral green, as OKLCH lightness, chroma and hue.
const mineral = { l: 0.5, c: 0.1, h: 163 };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Hardware data-site keyColor={mineral}>
          {children}
          <Toasts />
        </Hardware>
      </body>
    </html>
  );
}
