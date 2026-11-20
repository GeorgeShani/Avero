import type { ReactNode } from 'react';
import { ConsoleNavbar } from '../../components/console-navbar';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ConsoleNavbar />
      <main data-kit="sheet" id="main">
        <div data-page>{children}</div>
      </main>
    </>
  );
}
