import { describe, expect, it } from 'vitest';
import { checkTests } from './check-tests.ts';
import { parseDiff } from './diff.ts';
import { scanSecrets } from './scan-secrets.ts';
import { summarizeDiff } from './summarize-diff.ts';

/** Builds a one-file diff. Fake credentials are assembled here so no real-looking one sits in the source. */
function diff(path: string, added: string[], header = ''): string {
  return [
    `diff --git a/${path} b/${path}`,
    header,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,2 +10,${added.length + 1} @@`,
    ' context',
    ...added.map((line) => `+${line}`),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

describe('parseDiff', () => {
  it('counts lines per file and numbers the added lines in the new file', () => {
    const text = [
      diff('src/a.ts', ['one', 'two']),
      'diff --git a/src/b.ts b/src/b.ts',
      'deleted file mode 100644',
      '--- a/src/b.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-gone',
      '-gone too',
    ].join('\n');
    const { files } = parseDiff(text);
    expect(files.map((file) => [file.path, file.status, file.added, file.removed])).toEqual([
      ['src/a.ts', 'modified', 2, 0],
      ['src/b.ts', 'deleted', 0, 2],
    ]);
    expect(files[0]?.addedLines).toEqual([
      { line: 11, text: 'one' },
      { line: 12, text: 'two' },
    ]);
  });

  it('says when it cut a very long diff', () => {
    expect(parseDiff('x'.repeat(500_000)).truncated).toBe(true);
  });
});

describe('summarizeDiff', () => {
  it('flags what a reviewer should look at on purpose', () => {
    const text = [
      diff('package.json', ['"a": "1"']),
      diff('db/migrations/0005.sql', ['ALTER TABLE x;']),
      diff('.env.local', ['A=1']),
      diff('run.sh', ['echo'], 'old mode 100644\nnew mode 100755'),
      'diff --git a/src/a.test.ts b/src/a.test.ts',
      'deleted file mode 100644',
      '@@ -1 +0,0 @@',
      '-it()',
    ].join('\n');
    const summary = summarizeDiff(text);
    expect(summary.totals).toEqual({ files: 5, added: 4, removed: 1 });
    expect(summary.flags.map((flag) => flag.kind).sort()).toEqual([
      'database migration',
      'dependency or workflow',
      'environment file',
      'permissions',
      'test deleted',
    ]);
  });

  it('flags nothing for an ordinary source change, and not an env example', () => {
    expect(summarizeDiff(diff('src/a.ts', ['const a = 1;'])).flags).toEqual([]);
    expect(summarizeDiff(diff('.env.example', ['A='])).flags).toEqual([]);
  });
});

describe('scanSecrets', () => {
  const awsKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
  const ghToken = ['ghp', '_', 'a'.repeat(36)].join('');

  it('finds credentials in added lines, with where and a short preview only', () => {
    const result = scanSecrets(
      diff('src/config.ts', [
        `const key = '${awsKey}';`,
        `const t = "${ghToken}";`,
        'const ok = 1;',
      ]),
    );
    expect(result.findings.map((item) => [item.rule, item.line])).toEqual([
      ['aws-access-key', 11],
      ['github-token', 12],
    ]);
    const text = JSON.stringify(result);
    expect(text).not.toContain(awsKey);
    expect(text).not.toContain(ghToken);
  });

  it('finds a private key block and a secret assigned in code', () => {
    const result = scanSecrets(
      diff('k.ts', ['-----BEGIN ' + 'RSA PRIVATE KEY-----', 'password = "hunter2hunter2hunter2"']),
    );
    expect(result.findings.map((item) => item.rule)).toEqual(['private-key', 'assigned-secret']);
  });

  it('ignores removed lines, placeholders and env examples', () => {
    const removed = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1 +1 @@',
      `-const key = '${awsKey}';`,
    ].join('\n');
    expect(scanSecrets(removed).findings).toEqual([]);
    expect(scanSecrets(diff('a.ts', ['token = "your-token-goes-here-1234"'])).findings).toEqual([]);
    expect(scanSecrets(diff('.env.example', [`KEY=${awsKey}`])).findings).toEqual([]);
  });
});

describe('checkTests', () => {
  it('says "not run" when no command was a test, and never guesses', () => {
    expect(checkTests([{ command: 'ls -la', exitCode: 0 }])).toMatchObject({
      verdict: 'not run',
      runs: [],
    });
    expect(checkTests([])).toMatchObject({ verdict: 'not run' });
  });

  it('follows the latest test command', () => {
    const result = checkTests([
      { command: 'pnpm test', exitCode: 1 },
      { command: 'git status', exitCode: 0 },
      { command: 'pnpm exec vitest run', exitCode: 0 },
    ]);
    expect(result.verdict).toBe('passed');
    expect(result.failedRuns).toBe(1);
    expect(checkTests([{ command: 'cargo test', exitCode: 101 }]).verdict).toBe('failed');
  });

  it('is unclear when the exit code was not recorded', () => {
    expect(checkTests([{ command: 'npm run test', exitCode: null }]).verdict).toBe('unclear');
  });

  it('recognises common runners, including Nx', () => {
    for (const command of [
      'npx vitest',
      'pytest -q',
      'go test ./...',
      'pnpm exec nx run-many -t lint,test',
    ]) {
      expect(checkTests([{ command, exitCode: 0 }]).runs, command).toHaveLength(1);
    }
    expect(checkTests([{ command: 'cat test-notes.txt', exitCode: 0 }]).runs).toHaveLength(0);
  });
});
