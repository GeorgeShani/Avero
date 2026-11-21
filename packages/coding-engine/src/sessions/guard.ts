import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * One command a guard refuses. `pattern` is a JavaScript regular expression (source, no slashes)
 * tested against the whole command line.
 */
export type DenyRule = { id: string; pattern: string; reason: string };

/**
 * What the guard refuses unless told otherwise: commands that reach outside the working folder,
 * publish or push work, escalate privileges, or fetch and run code. Installing dependencies is
 * allowed (a test run needs them) and is recorded by the audit instead.
 */
export const defaultDenyRules: readonly DenyRule[] = [
  {
    id: 'git-push',
    pattern: '\\bgit\\b[^;&|]*\\bpush\\b',
    reason: 'Pushing changes is a decision for a person.',
  },
  {
    id: 'git-remote',
    pattern: '\\bgit\\b[^;&|]*\\bremote\\s+(?:add|set-url|remove|rm)\\b',
    reason: 'Changing a git remote could send work somewhere else.',
  },
  {
    id: 'publish',
    pattern: '\\b(?:npm|pnpm|yarn)\\s+publish\\b',
    reason: 'Publishing a package is a decision for a person.',
  },
  { id: 'sudo', pattern: '(?:^|[;&|]\\s*)sudo\\b', reason: 'Privilege escalation is not allowed.' },
  {
    id: 'pipe-to-shell',
    pattern: '\\b(?:curl|wget|iwr|Invoke-WebRequest)\\b[^|]*\\|\\s*(?:sudo\\s+)?(?:ba|z)?sh\\b',
    reason: 'Downloading and running code in one step is not allowed.',
  },
  {
    id: 'rm-outside',
    pattern: '\\brm\\s+(?:-\\S+\\s+)*(?:/(?!tmp/)|~|\\.\\.|[A-Za-z]:[\\\\/])',
    reason: 'Deleting outside the working folder is not allowed.',
  },
  {
    id: 'rm-recursive-force-root',
    pattern: '\\brm\\s+-(?:[a-z]*r[a-z]*f|[a-z]*f[a-z]*r)[a-z]*\\s+(?:\\*|\\.|/)\\s*$',
    reason: 'Deleting everything is not allowed.',
  },
  {
    id: 'remote-shell',
    pattern: '\\b(?:ssh|scp|sftp|rsync)\\b',
    reason: 'Reaching other machines is not allowed.',
  },
  {
    id: 'github-cli',
    pattern: '(?:^|[;&|]\\s*)gh\\s+(?:pr|release|repo|api|auth|secret)\\b',
    reason: 'Acting on GitHub as someone is not allowed.',
  },
  {
    id: 'disk',
    pattern: '\\b(?:mkfs|dd\\s+if=|shutdown|reboot|format\\s+[A-Za-z]:)',
    reason: 'Touching disks or the machine is not allowed.',
  },
];

/** The script Cursor runs before every shell command. Plain Node, no dependencies. */
const guardScript = `import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(readFileSync(join(here, 'policy.json'), 'utf8'));
let input = '';
for await (const chunk of process.stdin) input += chunk;
let command = '';
try {
  command = String(JSON.parse(input).command ?? '');
} catch {
  // An input we cannot read is refused: the hook is set to fail closed.
  process.stdout.write(JSON.stringify({ permission: 'deny', user_message: 'Avero could not read the command.', agent_message: 'The command was refused because it could not be checked.' }));
  process.exit(0);
}
let verdict = { permission: 'allow' };
let rule = null;
for (const candidate of policy.rules) {
  if (new RegExp(candidate.pattern, 'i').test(command)) {
    rule = candidate;
    verdict = {
      permission: 'deny',
      user_message: 'Avero denied this command: ' + candidate.reason,
      agent_message: 'This command was denied by policy (' + candidate.id + '): ' + candidate.reason + ' Do not retry it or look for a way around it; carry on without it, or stop and say what you could not do.',
    };
    break;
  }
}
try {
  appendFileSync(policy.audit, JSON.stringify({ at: new Date().toISOString(), decision: verdict.permission, rule: rule ? rule.id : null, command: command.slice(0, 500) }) + '\\n');
} catch {
  // Not being able to write the audit must not turn into a decision either way.
}
process.stdout.write(JSON.stringify(verdict));
`;

/**
 * Puts a command guard in a working folder: a Cursor project hook that runs before every shell
 * command the agent tries and refuses the ones the rules name. It replaces whatever hooks the
 * folder had, so a repository cannot bring its own. It only takes effect when the run loads the
 * folder's project settings (`projectSettings: true` in `recordRun`); without that, Cursor does not
 * read `.cursor/hooks.json` and the guard does nothing.
 *
 * `auditFile` should be outside the folder, so the agent cannot edit it.
 */
export async function installShellGuard(
  dir: string,
  options: { auditFile: string; rules?: readonly DenyRule[] },
): Promise<void> {
  const hooks = join(dir, '.cursor', 'hooks');
  await mkdir(hooks, { recursive: true });
  await writeFile(
    join(dir, '.cursor', 'hooks.json'),
    `${JSON.stringify(
      {
        version: 1,
        hooks: {
          beforeShellExecution: [
            { command: 'node .cursor/hooks/avero-guard.mjs', failClosed: true },
          ],
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(hooks, 'avero-guard.mjs'), guardScript);
  await writeFile(
    join(hooks, 'policy.json'),
    `${JSON.stringify({ audit: options.auditFile, rules: options.rules ?? defaultDenyRules }, null, 2)}\n`,
  );
}

export type GuardAuditEntry = {
  at: string;
  decision: 'allow' | 'deny';
  rule: string | null;
  command: string;
};

/** What the guard decided, in order. Empty when it never ran. */
export async function readGuardAudit(auditFile: string): Promise<GuardAuditEntry[]> {
  const text = await readFile(auditFile, 'utf8').catch(() => '');
  const entries: GuardAuditEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as GuardAuditEntry;
      if (parsed.decision === 'allow' || parsed.decision === 'deny') entries.push(parsed);
    } catch {
      // A torn line is skipped; the rest still counts.
    }
  }
  return entries;
}
