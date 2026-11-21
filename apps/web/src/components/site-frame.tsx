import { Hardware, Toasts } from '@avero/ui';
import type { ReactNode } from 'react';
import { NavOffset } from './nav-offset';

// Mineral green, as OKLCH lightness, chroma and hue.
const mineral = { l: 0.5, c: 0.1, h: 163 };

/** The molded-hardware skin the marketing page and the account pages are drawn in. The console
 * has its own frame and does not use it. */
export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <Hardware data-site keyColor={mineral}>
      <NavOffset />
      {children}
      <Toasts />
    </Hardware>
  );
}
