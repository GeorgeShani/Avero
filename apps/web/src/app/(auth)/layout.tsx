import { Alert, Lockup, Navbar } from '@avero/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClerkBoundary } from '../../components/clerk-boundary';
import { SiteFrame } from '../../components/site-frame';
import { ThemeSwitch } from '../../components/theme-switch';
import { clerkSettings } from '../../server/workspaces';

export const dynamic = 'force-dynamic';

function Frame({ children }: { children: ReactNode }) {
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
        label="Account"
        items={[
          { href: '/overview', label: 'Console' },
          { href: '/workspaces', label: 'Workspaces' },
        ]}
      >
        <ThemeSwitch />
      </Navbar>
      <main data-kit="sheet" id="main">
        <div data-page style={{ maxWidth: 640 }}>
          {children}
        </div>
      </main>
    </SiteFrame>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  if (!clerkSettings())
    return (
      <Frame>
        <Alert tone="warning" title="Authentication setup required">
          Configure Clerk to sign in to Avero.
        </Alert>
      </Frame>
    );

  return (
    <ClerkBoundary>
      <Frame>{children}</Frame>
    </ClerkBoundary>
  );
}
