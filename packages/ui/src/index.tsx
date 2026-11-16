export function StatusBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 font-mono text-xs text-emerald-200">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" />
      {children}
    </span>
  );
}
