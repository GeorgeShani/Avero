'use client';

import { CommandPalette, Lockup, Navbar } from '@avero/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { commandTargets, isCurrent, navigation } from './navigation';

export function ConsoleNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <Navbar
      leading={
        <Link href="/" aria-label="Avero home" style={{ display: 'inline-flex', paddingInline: 6 }}>
          <Lockup />
        </Link>
      }
      label="Primary"
      items={navigation.map((item) => ({
        label: item.label,
        current: isCurrent(pathname, item.href),
        onSelect: () => router.push(item.href),
      }))}
    >
      <span data-sim title="Runs on this page are simulated. Nothing is executing.">
        simulation
      </span>
      <CommandPalette
        commands={commandTargets.map((target) => target.command)}
        onRun={(command) => {
          const target = commandTargets.find((candidate) => candidate.command === command);
          if (target) router.push(target.href);
        }}
      />
    </Navbar>
  );
}
