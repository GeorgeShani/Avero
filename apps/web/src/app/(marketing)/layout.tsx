import { Lockup, Navbar } from '@avero/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeSwitch } from '../../components/theme-switch';
import './marketing.css';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
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
          Open demo
        </Link>
      </Navbar>
      <main data-kit="sheet" id="main" data-mk="page">
        {children}
      </main>
      <footer data-mk="footer">
        <span>Avero · in development</span>
        <span>Every demo on this page runs on example data, not on real agent runs.</span>
      </footer>
    </>
  );
}
