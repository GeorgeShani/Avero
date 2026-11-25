'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';

/** How a page gives the shell a readable name for its own address. Set by the shell. */
export const CrumbSetterContext = createContext<(path: string, label: string | undefined) => void>(
  () => undefined,
);

/**
 * Renders nothing. Put it on a page whose address ends in an id so the breadcrumb can show a
 * name (a task's prompt, a workspace's name) instead of the id. The name goes away with the page.
 */
export function Crumb({ label }: { label: string }) {
  const set = useContext(CrumbSetterContext);
  const pathname = usePathname();
  useEffect(() => {
    set(pathname, label);
    return () => set(pathname, undefined);
  }, [set, pathname, label]);
  return null;
}
