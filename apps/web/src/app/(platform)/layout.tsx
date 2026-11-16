import { ClerkProvider } from '@clerk/nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { clerkSettings } from '../../server/workspaces';

export const dynamic = 'force-dynamic';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const settings = clerkSettings();
  const content = (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-10">
      <Link href="/" className="font-semibold">
        Avero
      </Link>
      <div className="mt-8">{children}</div>
    </main>
  );
  if (!settings)
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Authentication setup required</h1>
        <p className="mt-2 text-muted-foreground">Configure Clerk to sign in to Avero.</p>
      </main>
    );

  return (
    <ClerkProvider
      publishableKey={settings.publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/workspaces"
      signUpFallbackRedirectUrl="/workspaces"
    >
      {content}
    </ClerkProvider>
  );
}
