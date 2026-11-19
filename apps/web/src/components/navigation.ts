export const navigation = [
  { href: '/overview', label: 'Overview' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/repositories', label: 'Repositories' },
  { href: '/agents', label: 'Agents' },
  { href: '/evaluations', label: 'Evaluations' },
  { href: '/activity', label: 'Activity' },
  { href: '/settings', label: 'Settings' },
] as const;

export const commandTargets = [
  ...navigation.map((item) => ({ command: `Go to ${item.label}`, href: item.href })),
  { command: 'New task', href: '/tasks/new' },
  { command: 'Workspaces', href: '/workspaces' },
] as const;

export function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
