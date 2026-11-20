export const navigation = [
  { href: '/overview', label: 'Overview' },
  { href: '/runs', label: 'Runs' },
  { href: '/bench', label: 'Bench' },
  { href: '/settings', label: 'Settings' },
] as const;

export const commandTargets = [
  ...navigation.map((item) => ({ command: `Go to ${item.label}`, href: item.href })),
  { command: 'Workspaces', href: '/workspaces' },
] as const;

export function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
