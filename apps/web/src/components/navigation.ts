import type { IconName } from './console/primitives';

export type NavItem = { href: string; label: string; icon: IconName };

/** The console's sidebar, in two groups. */
export const navigation: { label: string; items: NavItem[] }[] = [
  {
    label: 'Work',
    items: [
      { href: '/overview', label: 'Desk', icon: 'desk' },
      { href: '/tasks', label: 'Tasks', icon: 'tasks' },
      { href: '/runs', label: 'Runs', icon: 'runs' },
      { href: '/review', label: 'Review', icon: 'review' },
      { href: '/evaluations', label: 'Evaluations', icon: 'evaluations' },
      { href: '/activity', label: 'Activity', icon: 'activity' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/repositories', label: 'Repositories', icon: 'repositories' },
      { href: '/agents', label: 'Agents', icon: 'agents' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
      { href: '/workspaces', label: 'Workspaces', icon: 'workspaces' },
    ],
  },
];

export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
