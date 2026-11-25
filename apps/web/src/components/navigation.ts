import type { IconName } from './console/primitives';

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Needs a signed-in workspace. Until there is one, the sidebar says what is missing. */
  workspace?: true;
};

export type NavGroup = { label: string; hint: string; items: NavItem[] };

/**
 * The console's sidebar. It is split by where the data lives: recordings on this machine need
 * nothing set up, while the team workspace needs sign-in and a database.
 */
export const navigation: NavGroup[] = [
  {
    label: 'This machine',
    hint: 'Recordings read from files on this computer',
    items: [
      { href: '/overview', label: 'Overview', icon: 'desk' },
      { href: '/runs', label: 'Runs', icon: 'runs' },
      { href: '/review', label: 'Review', icon: 'review' },
      { href: '/evaluations', label: 'Evaluations', icon: 'evaluations' },
    ],
  },
  {
    label: 'Team workspace',
    hint: 'Shared by a team, needs sign-in',
    items: [
      { href: '/tasks', label: 'Tasks', icon: 'tasks', workspace: true },
      { href: '/activity', label: 'Activity', icon: 'activity', workspace: true },
      { href: '/repositories', label: 'Repositories', icon: 'repositories', workspace: true },
      { href: '/agents', label: 'Agents', icon: 'agents', workspace: true },
    ],
  },
  {
    label: 'Console',
    hint: 'This console',
    items: [{ href: '/settings', label: 'Settings', icon: 'settings' }],
  },
];

export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
