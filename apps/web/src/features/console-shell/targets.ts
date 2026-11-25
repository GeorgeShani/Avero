import type { ThemeMode } from '../../lib/theme';
import type { HostedState } from './hosted';

/** What choosing an entry of the go-to palette does. */
export type TargetAction = { go: string } | { theme: ThemeMode } | { workspace: string };

export type Target = { id: string; label: string; hint: string; to: TargetAction };

const themeWords: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

const shorten = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length)}…` : text;

/**
 * Everything the palette can do, in the order it lists them with no search: pages first, then what
 * can be done from anywhere, then this machine's suites and recent runs. Actions that cannot work
 * right now (a task with no workspace, switching to the workspace already shown) are left out.
 */
export function buildTargets(input: {
  pages: { label: string; href: string }[];
  suiteIds: readonly string[];
  recent: readonly { id: string; task: string }[];
  hosted: HostedState;
  theme: ThemeMode;
}): Target[] {
  const { hosted } = input;
  const targets: Target[] = [
    ...input.pages.map((page) => ({
      id: `page:${page.href}`,
      label: page.label,
      hint: 'Page',
      to: { go: page.href },
    })),
    { id: 'page:/workspaces', label: 'Workspaces', hint: 'Page', to: { go: '/workspaces' } },
    {
      id: 'action:machine',
      label: 'Switch to this machine',
      hint: 'Action',
      to: { go: '/overview' },
    },
    {
      id: 'action:workspace',
      label: 'Switch to the team workspace',
      hint: 'Action',
      to: { go: '/tasks' },
    },
  ];

  if (hosted.status === 'signed-in' && hosted.workspaces.length > 0) {
    targets.push({
      id: 'action:launch',
      label: 'Launch a task',
      hint: 'Action',
      to: { go: '/tasks#launch' },
    });
    for (const workspace of hosted.workspaces) {
      if (workspace.id === hosted.selectedId) continue;
      targets.push({
        id: `workspace:${workspace.id}`,
        label: `Use workspace: ${workspace.name}`,
        hint: 'Action',
        to: { workspace: workspace.id },
      });
    }
  }

  for (const mode of ['system', 'light', 'dark'] as const) {
    if (mode === input.theme) continue;
    targets.push({
      id: `theme:${mode}`,
      label: `Theme: ${themeWords[mode]}`,
      hint: 'Action',
      to: { theme: mode },
    });
  }

  for (const id of input.suiteIds) {
    targets.push({
      id: `suite:${id}`,
      label: id,
      hint: 'Evaluation suite',
      to: { go: `/evaluations/${id}` },
    });
  }
  for (const run of input.recent) {
    targets.push({
      id: `run:${run.id}`,
      label: shorten(run.task, 70),
      hint: run.id,
      to: { go: `/runs/${run.id}` },
    });
  }
  return targets;
}
