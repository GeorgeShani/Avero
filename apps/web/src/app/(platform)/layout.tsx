import { Alert, Lockup, Navbar } from '@avero/ui';
import { ClerkProvider } from '@clerk/nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeSwitch } from '../../components/theme-switch';
import { clerkSettings } from '../../server/workspaces';

export const dynamic = 'force-dynamic';

function Frame({ children }: { children: ReactNode }) {
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
    </>
  );
}

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const settings = clerkSettings();
  if (!settings)
    return (
      <Frame>
        <Alert tone="warning" title="Authentication setup required">
          Configure Clerk to sign in to Avero.
        </Alert>
      </Frame>
    );

  return (
    <ClerkProvider
      publishableKey={settings.publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/workspaces"
      signUpFallbackRedirectUrl="/workspaces"
      appearance={{
        variables: {
          colorPrimary: '#1f7358',
          colorForeground: '#1b1b19',
          colorBackground: '#efefeb',
          colorInput: '#ffffff',
          borderRadius: '8px',
          fontFamily: 'Red Hat Mono Variable, ui-monospace, monospace',
        },
      }}
    >
      <Frame>{children}</Frame>
    </ClerkProvider>
  );
}
