import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CopyCommand } from '../../../components/console/copy-command';
import { PageHead, Panel, SettingRow } from '../../../components/console/primitives';
import { ThemeSetting } from '../../../features/console-shell/theme-setting';
import { serverCapabilities } from '../../../server/capabilities';
import { loadHostedState } from '../../../server/console-context';
import { loadRuns, viewerReadOnly } from '../../../server/runs';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

function Ready({ ready, missing = 'Missing' }: { ready: boolean; missing?: string }) {
  return (
    <span data-tag data-tone={ready ? 'ok' : 'warn'}>
      <i aria-hidden="true">{ready ? '✓' : '○'}</i>
      {ready ? 'Ready' : missing}
    </span>
  );
}

function Env({ children }: { children: ReactNode }) {
  return <code data-mono>{children}</code>;
}

export default async function SettingsPage() {
  const [{ dir, runs }, hosted] = await Promise.all([loadRuns(), loadHostedState()]);
  const readOnly = viewerReadOnly();
  const caps = serverCapabilities();
  const workspaceName =
    hosted.status === 'signed-in'
      ? hosted.workspaces.find((item) => item.id === hosted.selectedId)?.name
      : undefined;

  return (
    <>
      <PageHead title="Settings">
        How the console looks, where it reads from, and what this server has set up.
      </PageHead>

      <div data-grid="two">
        <Panel title="Appearance" hint="Saved in this browser" flush>
          <SettingRow label="Theme" hint="System follows your operating system.">
            <ThemeSetting />
          </SettingRow>
        </Panel>

        <Panel title="This machine" hint="Recordings are files in a folder" flush>
          <SettingRow label="Runs folder" hint={`${runs.length} run(s) recorded`}>
            <code data-dim style={{ overflowWrap: 'anywhere' }}>
              {dir}
            </code>
          </SettingRow>
          <SettingRow
            label="Decisions"
            hint={
              readOnly
                ? 'Turned off with AVERO_READ_ONLY=1. Use avero decide on the machine that owns the runs.'
                : 'On. Set AVERO_READ_ONLY=1 to turn them off on a shared viewer.'
            }
          >
            <span data-tag data-tone={readOnly ? 'warn' : 'ok'}>
              {readOnly ? 'Read-only' : 'Can decide'}
            </span>
          </SettingRow>
        </Panel>
      </div>

      <Panel
        title="Team workspace"
        hint="Shared repositories, agents and tasks. Needs sign-in and a database."
        flush
      >
        <SettingRow
          label="Account"
          hint={
            hosted.status === 'unavailable'
              ? 'Sign-in is not set up on this server. See the server setup below.'
              : undefined
          }
        >
          {hosted.status === 'signed-in' ? (
            <span data-tag data-tone="ok">
              Signed in
            </span>
          ) : hosted.status === 'signed-out' ? (
            <Link href="/sign-in" data-btn data-primary>
              Sign in
            </Link>
          ) : (
            <span data-tag data-tone="warn">
              Not set up
            </span>
          )}
        </SettingRow>
        {hosted.status === 'signed-in' && (
          <SettingRow
            label="Current workspace"
            hint="The sidebar switches it. Create or rename workspaces on the Workspaces page."
          >
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <strong>{workspaceName ?? 'None yet'}</strong>
              <Link href="/workspaces" data-btn>
                Workspaces
              </Link>
            </span>
          </SettingRow>
        )}
      </Panel>

      <div id="setup">
        <Panel
          title="Server setup"
          hint="What this server has set up. It says yes or no and never shows a value."
          flush
        >
          <SettingRow
            label="Sign-in"
            hint={
              <>
                Clerk keys: <Env>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</Env> and{' '}
                <Env>CLERK_SECRET_KEY</Env>. Lets people sign in.
              </>
            }
          >
            <Ready ready={caps.signIn} />
          </SettingRow>
          <SettingRow
            label="Database"
            hint={
              <>
                <Env>DATABASE_URL</Env> for PostgreSQL, with the migrations applied. Stores
                workspaces, repositories, agents, tasks and runs.
              </>
            }
          >
            <Ready ready={caps.database} />
          </SettingRow>
          <SettingRow
            label="Task queue"
            hint={
              <>
                <Env>REDIS_URL</Env>. Tasks wait here until the worker takes them.
              </>
            }
          >
            <Ready ready={caps.queue} />
          </SettingRow>
          <SettingRow
            label="Worker"
            hint={
              <>
                The process that runs tasks. This page cannot see it. Start it with{' '}
                <Env>pnpm exec nx dev @avero/worker</Env>; a task stays queued until it runs.
              </>
            }
          >
            <span data-tag data-tone="quiet">
              Not checked
            </span>
          </SettingRow>
          <SettingRow
            label="Cursor key"
            hint={
              <>
                <Env>CURSOR_API_KEY</Env> in this server&apos;s environment, for tasks. The command
                line reads its own from your terminal.
              </>
            }
          >
            <Ready ready={caps.cursorKey} />
          </SettingRow>
          <SettingRow
            label="Repository folders"
            hint={
              <>
                <Env>AVERO_REPOSITORY_ROOTS</Env>: the folders the worker may use, so a repository
                can be added by path.
              </>
            }
          >
            <Ready ready={caps.repositoryFolders} />
          </SettingRow>
          <SettingRow
            label="GitHub App"
            hint="Optional. Lets Avero review pull requests and run tasks on GitHub repositories. Needs the App's id, slug, private key, webhook secret and state secret."
          >
            <Ready ready={caps.github} missing="Not set up" />
          </SettingRow>
        </Panel>
      </div>

      <Panel title="From the terminal" hint="Everything the console shows is also a command">
        <CopyCommand
          command={`pnpm avero run "<task>" --max-tokens 200000 --max-seconds 300
pnpm avero verdict <run-id>
pnpm avero decide <run-id> approve --note "ran it, looks right"
pnpm avero bench run <suite> --repo <dir> --model composer-2.5 --rules AGENTS.md
pnpm avero export <run-id>`}
        />
      </Panel>
    </>
  );
}
