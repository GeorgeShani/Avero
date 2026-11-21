export type NavItem = {
  href: string;
  label: string;
  icon: 'desk' | 'runs' | 'review' | 'bench' | 'settings' | 'workspaces';
};

/** The console's sidebar, in two groups. */
export const navigation: { label: string; items: NavItem[] }[] = [
  {
    label: 'Work',
    items: [
      { href: '/overview', label: 'Desk', icon: 'desk' },
      { href: '/runs', label: 'Runs', icon: 'runs' },
      { href: '/review', label: 'Review', icon: 'review' },
      { href: '/bench', label: 'Bench', icon: 'bench' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/settings', label: 'Settings', icon: 'settings' },
      { href: '/workspaces', label: 'Workspaces', icon: 'workspaces' },
    ],
  },
];

export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
