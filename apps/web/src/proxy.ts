import { readClerkEnvironment } from '@avero/config';
import { clerkMiddleware } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const settings = readClerkEnvironment(process.env);
  return settings ? clerkMiddleware(settings)(request, event) : NextResponse.next();
}

export const config = {
  matcher: [
    // The console's pages ask who is signed in (for the sidebar), so Clerk must see them too.
    '/overview/:path*',
    '/runs/:path*',
    '/review/:path*',
    '/evaluations/:path*',
    '/settings/:path*',
    '/workspaces/:path*',
    '/tasks/:path*',
    '/repositories/:path*',
    '/agents/:path*',
    '/activity/:path*',
    '/api/v1/github/install',
    '/api/v1/github/callback',
    '/sign-in/:path*',
    '/sign-up/:path*',
    '/api/v1/workspaces/:path*',
    '/__clerk/:path*',
  ],
};
