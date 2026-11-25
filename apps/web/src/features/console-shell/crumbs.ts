export type Crumb = { label: string; href?: string };

const pageNames: Record<string, string> = {
  overview: 'Overview',
  tasks: 'Tasks',
  runs: 'Runs',
  review: 'Review',
  evaluations: 'Evaluations',
  repositories: 'Repositories',
  agents: 'Agents',
  activity: 'Activity',
  settings: 'Settings',
  workspaces: 'Workspaces',
};

const longest = 48;

function shorten(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > longest ? `${flat.slice(0, longest).trimEnd()}…` : flat;
}

/**
 * The trail above a page. The first step is always a known page. Deeper steps are ids in the
 * address, so a page may register a readable name for its own path (a task's prompt, a workspace's
 * name); without one the id is shown.
 */
export function crumbs(pathname: string, labels: Readonly<Record<string, string>> = {}): Crumb[] {
  const [first, second, third] = pathname.split('/').filter(Boolean);
  if (!first) return [{ label: 'Overview' }];
  const root = { label: pageNames[first] ?? first, href: `/${first}` };
  if (!second) return [{ label: root.label }];

  const secondPath = `/${first}/${second}`;
  const secondLabel = shorten(labels[secondPath] ?? second);
  if (!third) return [root, { label: secondLabel }];
  return [
    root,
    { label: secondLabel, href: secondPath },
    { label: shorten(labels[pathname] ?? third) },
  ];
}
