'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Note, PageHead } from '../../components/console/primitives';

/**
 * A page that failed. It replaces only the page: the sidebar stays, so the person can go
 * somewhere else or try again. Nothing is changed by a page failing to load.
 */
export default function ConsoleError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // In production the message of a server error is hidden; the digest matches the server's log.
  const digest =
    error instanceof Error && 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : undefined;

  return (
    <>
      <PageHead title="This page could not be shown">
        Something went wrong while reading it. Nothing was changed.
      </PageHead>
      {digest && (
        <Note tone="bad" title="Reference:">
          <code>{digest}</code>. Whoever runs this server can find it in the logs.
        </Note>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" data-btn data-primary onClick={() => retry()}>
          Try again
        </button>
        <Link href="/overview" data-btn>
          Back to Overview
        </Link>
      </div>
    </>
  );
}
