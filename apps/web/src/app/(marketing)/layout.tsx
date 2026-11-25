import { Lockup, Navbar } from '@avero/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SmoothScroll } from '../../features/marketing/smooth-scroll';
import { SiteFrame } from '../../components/site-frame';
import { ThemeSwitch } from '../../components/theme-switch';
import './marketing.css';

/**
 * Without script nothing can mark a block as seen, so the entrance animations would leave it
 * hidden. This shows everything in its final place for anyone running without JavaScript.
 */
const withoutScript = `
[data-mk='reveal'],
[data-mk='reveal'] [data-mk='wi'],
[data-mk='reveal'][data-stagger] :is(li, [data-mk='phase']),
[data-mk='reveal'][data-head] > :not(h2) {
  opacity: 1 !important;
  translate: none !important;
  transition: none !important;
}
`;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <SiteFrame>
      <SmoothScroll />
      <noscript>
        <style>{withoutScript}</style>
      </noscript>
      <div data-mk="progress" aria-hidden="true" />
      <Navbar
        leading={
          <Link
            href="/"
            aria-label="Avero home"
            style={{ display: 'inline-flex', paddingInline: 6 }}
          >
            <Lockup />
          </Link>
        }
        label="Sections"
        items={[
          { href: '#recorder', label: 'Recorder' },
          { href: '#verdict', label: 'Verdict' },
          { href: '#bench', label: 'Bench' },
          { href: '#hosted', label: 'Hosted' },
          { href: '#agents', label: 'Agents' },
          { href: '#roadmap', label: 'Roadmap' },
        ]}
      >
        <ThemeSwitch />
        <Link data-kit="button" data-tone="primary" data-mk="nav-cta" href="/overview">
          Open console
        </Link>
      </Navbar>
      <main data-kit="sheet" id="main" data-mk="page">
        {children}
      </main>
      <footer data-mk="footer">
        <span>Avero · in development</span>
        <span>
          The replay, the verdict and the bench result are real recordings. The bench result is only
          four attempts: it shows the pipeline works, not which setup is better.
        </span>
      </footer>
    </SiteFrame>
  );
}
