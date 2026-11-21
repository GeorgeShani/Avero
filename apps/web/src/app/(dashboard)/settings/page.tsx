import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead, Panel } from '../../../components/console/primitives';
import { ThemeSetting } from '../../../features/console-shell/theme-setting';
import { loadRuns, viewerReadOnly } from '../../../server/runs';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 16px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <strong style={{ fontWeight: 500 }}>{label}</strong>
        {hint ? (
          <p data-dim style={{ fontSize: 13 }}>
            {hint}
          </p>
        ) : null}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default async function SettingsPage() {
  const { dir, runs } = await loadRuns();
  const readOnly = viewerReadOnly();
  return (
    <>
      <PageHead title="Settings">
        How the console looks, where it reads from, and what it lets you change.
      </PageHead>

      <div data-grid="two">
        <Panel title="Appearance" hint="Saved in this browser" flush>
          <Row label="Theme" hint="System follows your operating system.">
            <ThemeSetting />
          </Row>
        </Panel>

        <Panel title="Data" hint="Read from files on this machine" flush>
          <Row label="Runs folder" hint={`${runs.length} run(s) recorded`}>
            <code data-dim style={{ overflowWrap: 'anywhere' }}>
              {dir}
            </code>
          </Row>
          <Row
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
          </Row>
        </Panel>
      </div>

      <Panel title="Workspaces" hint="Accounts and workspace membership, signed in with Clerk">
        <div data-stack>
          <p data-dim>
            Workspaces are separate from the recorder: they hold sign-in and membership, not run
            records.
          </p>
          <div>
            <Link href="/workspaces" data-btn>
              Open workspaces
            </Link>
          </div>
        </div>
      </Panel>

      <Panel title="From the terminal" hint="Everything the console shows is also a command">
        <pre data-cmd>{`pnpm avero run "<task>" --max-tokens 200000 --max-seconds 300
pnpm avero verdict <run-id>
pnpm avero decide <run-id> approve --note "ran it, looks right"
pnpm avero bench run <suite> --repo <dir> --model composer-2.5 --rules AGENTS.md
pnpm avero export <run-id>`}</pre>
      </Panel>
    </>
  );
}
