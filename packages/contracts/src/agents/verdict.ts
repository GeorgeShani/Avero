import { z } from 'zod';
import {
  tokenUsageSchema,
  toolSpans,
  type RunRecord,
  type RunSummary,
} from '../events/run-record.ts';

/**
 * A verdict is an independent reviewer agent's answer to "does this diff do what the task asked,
 * and can you show it?". It is saved next to the run record, never inside it, and a person makes
 * the decision. The reviewer is a model: Avero checks what it can against the record, and says
 * where it did.
 */
export const verdictVersion = 1;

export const checkVerdicts = ['pass', 'fail', 'unclear'] as const;
export const riskTiers = ['low', 'medium', 'high'] as const;
export type RiskTier = (typeof riskTiers)[number];

export const verdictCheckSchema = z.strictObject({
  id: z.string().min(1).max(32),
  /** What the task asked for, or what the author claimed, in one line. */
  claim: z.string().min(1).max(300),
  verdict: z.enum(checkVerdicts),
  /** What in the diff, the commands or the results shows it. Say so when there is none. */
  evidence: z.string().min(1).max(600),
  files: z.array(z.string().min(1).max(1024)).max(10).optional(),
});
export type VerdictCheck = z.infer<typeof verdictCheckSchema>;

/** What the reviewer submits. Avero adds the rest. */
export const verdictSubmissionSchema = z.strictObject({
  summary: z.string().min(1).max(1200),
  checks: z.array(verdictCheckSchema).min(1).max(12),
  /** Changed files the task did not ask for. */
  outOfScope: z
    .array(
      z.strictObject({ path: z.string().min(1).max(1024), reason: z.string().min(1).max(300) }),
    )
    .max(20),
  tests: z.strictObject({
    ran: z.boolean(),
    passed: z.boolean().optional(),
    evidence: z.string().min(1).max(400),
  }),
  risk: z.strictObject({
    tier: z.enum(riskTiers),
    reasons: z.array(z.string().min(1).max(200)).max(6),
  }),
});
export type VerdictSubmission = z.infer<typeof verdictSubmissionSchema>;

export const verdictSchema = verdictSubmissionSchema.extend({
  v: z.literal(verdictVersion),
  runId: z.string().min(1).max(128),
  reviewer: z.strictObject({
    model: z.string().min(1).max(128),
    reviewedAt: z.iso.datetime(),
    usage: tokenUsageSchema.optional(),
  }),
  /** What Avero corrected after checking the submission against the record. */
  adjustments: z.array(z.string().min(1).max(300)).max(20),
});
export type Verdict = z.infer<typeof verdictSchema>;

export const decisions = ['approved', 'changes-requested', 'rejected'] as const;
export const decisionSchema = z.strictObject({
  v: z.literal(1),
  runId: z.string().min(1).max(128),
  decision: z.enum(decisions),
  note: z.string().trim().max(2000).optional(),
  decidedAt: z.iso.datetime(),
});
export type Decision = z.infer<typeof decisionSchema>;

export function checkCounts(verdict: Pick<Verdict, 'checks'>) {
  return {
    pass: verdict.checks.filter((check) => check.verdict === 'pass').length,
    fail: verdict.checks.filter((check) => check.verdict === 'fail').length,
    unclear: verdict.checks.filter((check) => check.verdict === 'unclear').length,
  };
}

const sensitivePatterns: { test: RegExp; reason: string }[] = [
  {
    test: /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|pnpm-workspace\.yaml)$/,
    reason: 'a dependency file',
  },
  { test: /(^|\/)\.github\/workflows\//, reason: 'a CI workflow' },
  { test: /(^|\/)\.env(\.|$)/, reason: 'an environment file' },
  { test: /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml)$/, reason: 'a container file' },
  { test: /(^|\/)(migrations?|drizzle)\//, reason: 'a database migration' },
];

const tierRank: Record<RiskTier, number> = { low: 0, medium: 1, high: 2 };

export const largeChangeLines = 500;

/** Where the record shows the work to be riskier than the reviewer said, and why. */
export function riskFloor(
  record: RunRecord,
  verdict: VerdictSubmission,
): { tier: RiskTier; reasons: string[] } {
  let tier: RiskTier = 'low';
  const reasons: string[] = [];
  const raise = (to: RiskTier, reason: string) => {
    if (tierRank[to] > tierRank[tier]) tier = to;
    reasons.push(reason);
  };

  const changes = record.finished?.changes;
  for (const file of changes?.files ?? []) {
    const hit = sensitivePatterns.find((pattern) => pattern.test.test(file.path));
    if (hit) raise('medium', `Changes ${file.path}, ${hit.reason}.`);
  }
  if (changes && changes.additions + changes.deletions > largeChangeLines) {
    raise('medium', `Large change: ${changes.additions + changes.deletions} lines.`);
  }
  if (verdict.checks.some((check) => check.verdict === 'fail')) {
    raise('medium', 'A check failed.');
  }
  if (verdict.outOfScope.length > 0) {
    raise('medium', 'Files outside the task were changed.');
  }
  if (record.finished && record.finished.status !== 'FINISHED') {
    raise(
      'high',
      `The run ended ${record.finished.status.toLowerCase()}, so its work may be partial.`,
    );
  }
  return { tier, reasons };
}

export type CommandEvidence = { command: string; exitCode: number | null; output: string };

/** The shell commands a run executed, with exit codes and the end of their output. */
export function commandsRun(record: RunRecord, outputChars = 600): CommandEvidence[] {
  return toolSpans(record)
    .filter((span) => span.kind === 'shell' && span.status !== 'running')
    .map((span) => {
      const args = (span.args ?? {}) as Record<string, unknown>;
      const value = ((span.result ?? {}) as { value?: Record<string, unknown> }).value ?? {};
      const stdout = typeof value.stdout === 'string' ? value.stdout : '';
      const stderr = typeof value.stderr === 'string' ? value.stderr : '';
      const output = `${stdout}${stderr ? `\n${stderr}` : ''}`.trim();
      return {
        command: String(args.command ?? args.cmd ?? ''),
        exitCode: typeof value.exitCode === 'number' ? value.exitCode : null,
        output: output.length > outputChars ? `…${output.slice(-outputChars)}` : output,
      };
    });
}

/**
 * Checks a submission against the record and corrects what the record contradicts: files that were
 * not changed, a claim that tests ran when no command did, and a risk tier below what the record
 * supports. Every correction is listed in `adjustments`, so a person can see what was changed.
 */
export function groundVerdict(
  record: RunRecord,
  submission: VerdictSubmission,
): { submission: VerdictSubmission; adjustments: string[] } {
  const adjustments: string[] = [];
  const changed = new Set((record.finished?.changes?.files ?? []).map((file) => file.path));
  const hasChanges = record.finished?.changes !== undefined;

  const checks = submission.checks.map((check) => {
    if (!check.files || !hasChanges) return check;
    const kept = check.files.filter((path) => changed.has(path));
    const dropped = check.files.filter((path) => !changed.has(path));
    if (dropped.length > 0) {
      adjustments.push(
        `Check ${check.id} named files that were not changed: ${dropped.join(', ')}. Removed.`,
      );
    }
    const next: VerdictCheck = { ...check };
    delete next.files;
    if (kept.length > 0) next.files = kept;
    return next;
  });

  const outOfScope = hasChanges
    ? submission.outOfScope.filter((entry) => {
        if (changed.has(entry.path)) return true;
        adjustments.push(`Out-of-scope file ${entry.path} was not changed. Removed.`);
        return false;
      })
    : submission.outOfScope;

  let tests = submission.tests;
  const commands = commandsRun(record);
  if (tests.ran && commands.length === 0) {
    adjustments.push(
      'The reviewer said tests ran, but the run executed no shell command. Marked as not run.',
    );
    tests = { ran: false, evidence: 'The record shows no shell command, so no tests were run.' };
  }

  const grounded: VerdictSubmission = { ...submission, checks, outOfScope, tests };
  const floor = riskFloor(record, grounded);
  let risk = grounded.risk;
  if (tierRank[floor.tier] > tierRank[risk.tier]) {
    adjustments.push(`Risk raised from ${risk.tier} to ${floor.tier}: ${floor.reasons.join(' ')}`);
    risk = {
      tier: floor.tier,
      reasons: [...floor.reasons, ...risk.reasons].slice(0, 6),
    };
  }
  return { submission: { ...grounded, risk }, adjustments };
}

/** Where a run stands in review, for lists. */
export type ReviewState = {
  /** Risk tier from the verdict, when a verdict exists. */
  risk?: RiskTier;
  failedChecks?: number;
  decision?: Decision['decision'];
};

/** A run's summary with its review state, as lists show it. */
export type RunListItem = RunSummary & { review: ReviewState };
