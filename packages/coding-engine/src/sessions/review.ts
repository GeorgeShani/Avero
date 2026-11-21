import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SDKCustomTool } from '@cursor/sdk';
import { z } from 'zod';
import {
  commandsRun,
  groundVerdict,
  verdictSchema,
  verdictSubmissionSchema,
  verdictVersion,
  type RunRecord,
  type TokenUsage,
  type Verdict,
  type VerdictSubmission,
} from '@avero/contracts';
import type { CreateAgent } from '../adapters/agent-port.ts';
import { createCursorAgent } from '../cursor/create-cursor-agent.ts';

const maxPatchChars = 60_000;
const maxClaimChars = 3_000;

export class ReviewError extends Error {}

/** What the reviewer is told. It is not the author, has no access to the author's reasoning, and
 * must answer through the submit_verdict tool so its answer is structured and checked. */
export const reviewerInstructions = `You are an independent code reviewer. You did not write this change and you have not seen the author's reasoning. A coding agent was given a task and made changes; you decide whether the changes do what the task asked, and whether that can be shown.

You are given: the task, the author's own final message (its claims, which you must not simply trust), the list of changed files, the diff, and the shell commands that were run with their exit codes and output.

Rules:
- Judge only from that evidence. If the evidence does not show something, the verdict is "unclear", not "pass".
- Write one check for each distinct thing the task asked for, plus checks for any claim by the author that matters. Keep each claim to one line and cite the file or command that shows it.
- "fail" means the evidence shows the change does not do it (for example the task asks for exponential backoff and the delay is a fixed value).
- List in outOfScope every changed file the task did not ask for, and say why. Do not list files the task needed.
- tests.ran is true only if a shell command in the evidence ran tests. tests.passed follows its exit code and output.
- Risk: "low" for a small, contained change with evidence; "medium" when something failed, is unclear, touches dependencies, configuration, or more than the task asked; "high" for changes to authentication, secrets, data deletion, or work that did not finish. Give short reasons.
- Do not edit any file. Do not run commands. Call submit_verdict exactly once with your answer, then reply "done".`;

/** The evidence the reviewer sees: built from the record, with long parts cut and said to be cut. */
export function buildDigest(record: RunRecord): string {
  const { started, finished } = record;
  const changes = finished?.changes;
  const commands = commandsRun(record);
  const parts: string[] = [];

  parts.push(`## Task\n${started.task}`);
  const claim = finished?.result?.trim();
  parts.push(
    `## The author's final message (its own claims)\n${
      claim
        ? claim.length > maxClaimChars
          ? `${claim.slice(0, maxClaimChars)}…`
          : claim
        : '(none recorded)'
    }`,
  );
  parts.push(
    `## Outcome\nThe run ended ${finished?.status ?? 'without finishing'}.${finished?.error ? ` Error: ${finished.error}` : ''}`,
  );

  if (!changes) {
    parts.push('## Changed files\nChanges were not recorded (the folder is not a git repository).');
  } else if (changes.files.length === 0) {
    parts.push('## Changed files\nNo files were changed.');
  } else {
    parts.push(
      `## Changed files (${changes.files.length}, +${changes.additions} −${changes.deletions})\n${changes.files
        .map(
          (file) =>
            `- ${file.status} ${file.path} (+${file.additions ?? '?'} −${file.deletions ?? '?'})`,
        )
        .join('\n')}`,
    );
    const patch = changes.patch ?? '';
    const cut = patch.length > maxPatchChars || changes.patchTruncated;
    parts.push(
      `## Diff${cut ? ' (cut: later parts are missing, so treat what is not shown as unclear)' : ''}\n\`\`\`diff\n${patch.slice(0, maxPatchChars)}\n\`\`\``,
    );
  }

  parts.push(
    commands.length === 0
      ? '## Commands run\nNo shell command was run.'
      : `## Commands run\n${commands
          .map(
            (entry, index) =>
              `${index + 1}. \`${entry.command}\` → exit code ${entry.exitCode ?? 'unknown'}${entry.output ? `\n   output (end):\n${entry.output.replace(/^/gm, '   ')}` : ''}`,
          )
          .join('\n')}`,
  );
  return parts.join('\n\n');
}

function issuesText(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'verdict'}: ${issue.message}`)
    .join('; ');
}

export type ReviewOptions = {
  record: RunRecord;
  model: string;
  apiKey?: string;
  /** Lets the reviewer read the repository too. Without it, the reviewer sees only the evidence. */
  cwd?: string;
  signal?: AbortSignal;
  createAgent?: CreateAgent;
  now?: () => Date;
};

/** Asks an independent agent to review a recorded run and returns its checked verdict. */
export async function reviewRun(options: ReviewOptions): Promise<Verdict> {
  const { record } = options;
  const create = options.createAgent ?? createCursorAgent;
  let submitted: VerdictSubmission | undefined;

  const submitVerdict: SDKCustomTool = {
    description:
      'Submit your review of the change. Call it once with your complete answer. If it reports a problem, fix that and call it again.',
    inputSchema: z.toJSONSchema(verdictSubmissionSchema) as SDKCustomTool['inputSchema'],
    execute: (args) => {
      const parsed = verdictSubmissionSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [
            {
              type: 'text',
              text: `The verdict was not accepted: ${issuesText(parsed.error)}. Fix it and call submit_verdict again.`,
            },
          ],
          isError: true,
        };
      }
      submitted = parsed.data;
      return 'Verdict recorded. Reply "done".';
    },
  };

  const workDir = options.cwd ?? (await mkdtemp(join(tmpdir(), 'avero-review-')));
  const scratch = options.cwd ? undefined : workDir;
  try {
    await using agent = await create({
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      model: { id: options.model },
      // Read tools only: the reviewer can look at the repository but not change it or run anything.
      tools: options.cwd ? ['read', 'grep', 'glob', 'mcp'] : ['mcp'],
      local: {
        cwd: workDir,
        settingSources: [],
        sandboxOptions: { enabled: false },
        customTools: { submit_verdict: submitVerdict },
      },
    });

    let usage: TokenUsage | undefined;
    const ask = async (prompt: string) => {
      const run = await agent.send(prompt);
      options.signal?.addEventListener('abort', () => void run.cancel().catch(() => undefined), {
        once: true,
      });
      for await (const message of run.stream()) void message;
      const result = await run.wait();
      if (result.status === 'error') {
        throw new ReviewError(
          `The reviewer run failed: ${result.error?.message ?? 'unknown error'}`,
        );
      }
      if (result.status === 'cancelled') throw new ReviewError('The review was cancelled.');
      usage = result.usage ?? usage;
    };

    // The instructions go in the message, not a system prompt: custom system prompts are not
    // enabled on every Cursor account, and the review must work on all of them.
    await ask(
      `${reviewerInstructions}\n\n---\n\n${buildDigest(record)}\n\nReview this change now, then call submit_verdict.`,
    );
    if (!submitted) {
      await ask('You did not call submit_verdict. Call it now with your complete review.');
    }
    if (!submitted) throw new ReviewError('The reviewer finished without submitting a verdict.');

    const grounded = groundVerdict(record, submitted);
    const now = options.now?.() ?? new Date();
    return verdictSchema.parse({
      ...grounded.submission,
      v: verdictVersion,
      runId: record.started.runId,
      reviewer: {
        model: options.model,
        reviewedAt: now.toISOString(),
        ...(usage ? { usage } : {}),
      },
      adjustments: grounded.adjustments,
    });
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }
}
