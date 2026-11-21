import { describe, expect, it } from 'vitest';
import { parseRunRecord, type RunEvent } from '../events/run-record.ts';
import {
  checkCounts,
  commandsRun,
  decisionSchema,
  groundVerdict,
  riskFloor,
  verdictSubmissionSchema,
  type VerdictSubmission,
} from './verdict.ts';

function record(options: {
  files?: { path: string; additions?: number; deletions?: number }[];
  shell?: { command: string; exitCode: number; stdout?: string } | null;
  status?: 'FINISHED' | 'CANCELLED' | 'ERROR';
}) {
  const events: RunEvent[] = [
    {
      type: 'run.started',
      seq: 0,
      t: 0,
      v: 1,
      runId: 'r1',
      task: 'Add retries',
      model: 'composer-2.5',
      runtime: 'local',
      startedAt: '2026-11-20T10:00:00.000Z',
      workspace: 'demo',
    },
  ];
  if (options.shell) {
    events.push(
      {
        type: 'tool',
        seq: 1,
        t: 10,
        callId: 's',
        name: 'shell',
        status: 'running',
        args: { command: options.shell.command },
      },
      {
        type: 'tool',
        seq: 2,
        t: 20,
        callId: 's',
        name: 'shell',
        status: 'completed',
        result: {
          status: 'success',
          value: {
            exitCode: options.shell.exitCode,
            stdout: options.shell.stdout ?? '',
            stderr: '',
          },
        },
      },
    );
  }
  const files = (options.files ?? []).map((file) => ({
    path: file.path,
    status: 'modified' as const,
    additions: file.additions ?? 5,
    deletions: file.deletions ?? 1,
  }));
  events.push({
    type: 'run.finished',
    seq: 9,
    t: 100,
    status: options.status ?? 'FINISHED',
    durationMs: 100,
    changes: {
      files,
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
    },
  });
  return parseRunRecord(events.map((event) => JSON.stringify(event)).join('\n'));
}

const submission = (overrides: Partial<VerdictSubmission> = {}): VerdictSubmission => ({
  summary: 'It retries.',
  checks: [
    {
      id: 'c1',
      claim: 'Retries on failure',
      verdict: 'pass',
      evidence: 'deliver.js loops 4 times',
    },
  ],
  outOfScope: [],
  tests: { ran: true, passed: true, evidence: 'npm test passed' },
  risk: { tier: 'low', reasons: [] },
  ...overrides,
});

describe('verdictSubmissionSchema', () => {
  it('accepts a complete submission', () => {
    expect(verdictSubmissionSchema.safeParse(submission()).success).toBe(true);
  });

  it('rejects no checks, an unknown verdict, an unknown tier, and extra fields', () => {
    expect(verdictSubmissionSchema.safeParse(submission({ checks: [] })).success).toBe(false);
    const badVerdict = submission({
      checks: [{ id: 'c1', claim: 'x', verdict: 'maybe' as never, evidence: 'y' }],
    });
    expect(verdictSubmissionSchema.safeParse(badVerdict).success).toBe(false);
    const badTier = submission({ risk: { tier: 'severe' as never, reasons: [] } });
    expect(verdictSubmissionSchema.safeParse(badTier).success).toBe(false);
    expect(verdictSubmissionSchema.safeParse({ ...submission(), extra: 1 }).success).toBe(false);
  });
});

describe('decisionSchema', () => {
  it('accepts the three decisions and trims the note', () => {
    const parsed = decisionSchema.parse({
      v: 1,
      runId: 'r1',
      decision: 'changes-requested',
      note: '  use a jitter  ',
      decidedAt: '2026-11-20T10:00:00.000Z',
    });
    expect(parsed.note).toBe('use a jitter');
    expect(decisionSchema.safeParse({ ...parsed, decision: 'merge' }).success).toBe(false);
  });
});

describe('checkCounts', () => {
  it('counts each verdict', () => {
    expect(
      checkCounts({
        checks: [
          { id: 'a', claim: 'a', verdict: 'pass', evidence: 'e' },
          { id: 'b', claim: 'b', verdict: 'fail', evidence: 'e' },
          { id: 'c', claim: 'c', verdict: 'unclear', evidence: 'e' },
          { id: 'd', claim: 'd', verdict: 'pass', evidence: 'e' },
        ],
      }),
    ).toEqual({ pass: 2, fail: 1, unclear: 1 });
  });
});

describe('commandsRun', () => {
  it('lists shell commands with exit code and the end of their output', () => {
    const r = record({
      shell: { command: 'npm test', exitCode: 1, stdout: `${'x'.repeat(2000)}\nfail 1` },
    });
    const [first] = commandsRun(r, 100);
    expect(first?.command).toBe('npm test');
    expect(first?.exitCode).toBe(1);
    expect(first?.output.length).toBeLessThanOrEqual(102);
    expect(first?.output.endsWith('fail 1')).toBe(true);
  });

  it('is empty when no command ran', () => {
    expect(commandsRun(record({}))).toEqual([]);
  });
});

describe('riskFloor', () => {
  it('is low for a plain source change that finished', () => {
    expect(riskFloor(record({ files: [{ path: 'src/a.ts' }] }), submission()).tier).toBe('low');
  });

  it('is at least medium for dependency, workflow, env and migration files', () => {
    for (const path of [
      'package.json',
      'pnpm-lock.yaml',
      '.github/workflows/ci.yml',
      '.env.local',
      'db/migrations/001.sql',
      'Dockerfile',
    ]) {
      expect(riskFloor(record({ files: [{ path }] }), submission()).tier).toBe('medium');
    }
  });

  it('is at least medium for a very large change, a failed check, or files outside the task', () => {
    expect(
      riskFloor(record({ files: [{ path: 'a.ts', additions: 600 }] }), submission()).tier,
    ).toBe('medium');
    const failing = submission({
      checks: [{ id: 'c', claim: 'x', verdict: 'fail', evidence: 'y' }],
    });
    expect(riskFloor(record({ files: [{ path: 'a.ts' }] }), failing).tier).toBe('medium');
    const stray = submission({ outOfScope: [{ path: 'a.ts', reason: 'not asked' }] });
    expect(riskFloor(record({ files: [{ path: 'a.ts' }] }), stray).tier).toBe('medium');
  });

  it('is high when the run did not finish', () => {
    expect(riskFloor(record({ status: 'CANCELLED' }), submission()).tier).toBe('high');
  });
});

describe('groundVerdict', () => {
  const r = record({
    files: [{ path: 'deliver.js' }, { path: 'deliver.test.js' }],
    shell: { command: 'npm test', exitCode: 0 },
  });

  it('keeps a submission that agrees with the record, unchanged', () => {
    const input = submission({
      checks: [{ id: 'c1', claim: 'x', verdict: 'pass', evidence: 'y', files: ['deliver.js'] }],
    });
    const { submission: out, adjustments } = groundVerdict(r, input);
    expect(adjustments).toEqual([]);
    expect(out).toEqual(input);
  });

  it('removes files that were never changed, and says so', () => {
    const input = submission({
      checks: [
        { id: 'c1', claim: 'x', verdict: 'pass', evidence: 'y', files: ['deliver.js', 'ghost.js'] },
      ],
      outOfScope: [{ path: 'ghost.js', reason: 'stray' }],
    });
    const { submission: out, adjustments } = groundVerdict(r, input);
    expect(out.checks[0]?.files).toEqual(['deliver.js']);
    expect(out.outOfScope).toEqual([]);
    expect(adjustments.join(' ')).toContain('ghost.js');
  });

  it('marks tests as not run when the record shows no command', () => {
    const none = record({ files: [{ path: 'a.ts' }] });
    const { submission: out, adjustments } = groundVerdict(none, submission());
    expect(out.tests.ran).toBe(false);
    expect(adjustments.some((line) => line.includes('no shell command'))).toBe(true);
  });

  it('raises the risk tier to what the record supports and lists the reason', () => {
    const risky = record({
      files: [{ path: 'package.json' }],
      shell: { command: 'npm test', exitCode: 0 },
    });
    const { submission: out, adjustments } = groundVerdict(risky, submission());
    expect(out.risk.tier).toBe('medium');
    expect(out.risk.reasons.join(' ')).toContain('package.json');
    expect(adjustments[0]).toContain('Risk raised from low to medium');
  });

  it('never lowers a tier the reviewer set higher', () => {
    const { submission: out } = groundVerdict(
      r,
      submission({ risk: { tier: 'high', reasons: ['touches auth'] } }),
    );
    expect(out.risk.tier).toBe('high');
  });
});
