export type CommandRun = { command: string; exitCode: number | null };

const testCommand = new RegExp(
  [
    String.raw`\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b`,
    String.raw`\b(?:vitest|jest|pytest|mocha|phpunit|playwright\s+test)\b`,
    String.raw`\bgo\s+test\b`,
    String.raw`\bcargo\s+test\b`,
    String.raw`\bdotnet\s+test\b`,
    String.raw`\bmvn\s+(?:\S+\s+)*test\b`,
    String.raw`\bgradlew?\s+(?:\S+\s+)*test\b`,
    String.raw`\bnx\s+(?:run-many\s+|affected\s+)?(?:-t|--targets?)[= ]\s*(?:\S*,)?test\b`,
  ].join('|'),
);

export type TestVerdict = 'not run' | 'passed' | 'failed' | 'unclear';

/**
 * Whether tests ran in a recorded session, from its shell commands and their exit codes. The
 * verdict follows the latest test command, so a failure that was fixed and run again reads as
 * passed. A command with no recorded exit code is `unclear`, never assumed to have passed.
 */
export function checkTests(commands: readonly CommandRun[]) {
  const runs = commands
    .filter((item) => testCommand.test(item.command))
    .map((item) => ({
      command: item.command.slice(0, 300),
      exitCode: item.exitCode,
      outcome:
        item.exitCode === null
          ? ('unclear' as const)
          : item.exitCode === 0
            ? ('passed' as const)
            : ('failed' as const),
    }));
  const last = runs.at(-1);
  const verdict: TestVerdict = last ? last.outcome : 'not run';
  return {
    verdict,
    runs,
    failedRuns: runs.filter((item) => item.outcome === 'failed').length,
  };
}
