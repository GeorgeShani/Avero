import { Lockup, Navbar } from '@avero/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFrame } from '../../components/site-frame';
import { ThemeSwitch } from '../../components/theme-switch';
import './marketing.css';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <SiteFrame>
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
