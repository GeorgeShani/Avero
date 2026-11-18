import type { ReactNode } from 'react';
import { ConsoleNavbar } from '../../components/console-navbar';
import { SimProvider } from '../../lib/sim/provider';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <SimProvider>
      <ConsoleNavbar />
      <main data-kit="sheet" id="main">
        <div data-page>{children}</div>
      </main>
    </SimProvider>
  );
}
