import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { clerkSettings } from '../server/workspaces';

/**
 * Clerk's provider, but only when the server has Clerk configured. Without it the children render
 * as they are, and nothing asks for a sign-in the server cannot provide.
 */
export function ClerkBoundary({ children }: { children: ReactNode }) {
  const settings = clerkSettings();
  if (!settings) return <>{children}</>;
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
      {children}
    </ClerkProvider>
  );
}
