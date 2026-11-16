import { serviceHealth } from '@avero/contracts';
import { buttonVariants, StatusBadge } from '@avero/ui';
import Link from 'next/link';

export default function Home() {
  const health = serviceHealth('web');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-12 sm:px-10 sm:py-20">
      <header className="border-b border-white/10 pb-8">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Avero</h1>
        <p className="mt-3 text-lg text-zinc-400">Engineering workspace</p>
        <Link href="/workspaces" className={buttonVariants({ className: 'mt-6' })}>
          Open workspaces
        </Link>
      </header>
      <section aria-labelledby="status-heading" className="mt-10">
        <h2 id="status-heading" className="text-lg font-semibold">
          Service status
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <a
            href="/api/healthz"
            className="rounded-sm font-medium underline decoration-zinc-500 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
          >
            Web health endpoint
          </a>
          <StatusBadge>{health.status.toUpperCase()}</StatusBadge>
        </div>
      </section>
    </main>
  );
}
