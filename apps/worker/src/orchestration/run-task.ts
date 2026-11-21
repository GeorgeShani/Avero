import { join } from 'node:path';
import {
  installAgentRules,
  installShellGuard,
  readGuardAudit,
  recordRun,
  reviewRun,
  type CreateAgent,
} from '@avero/coding-engine';
import { parseRunRecord, runEventSchema, type RunEvent } from '@avero/contracts';
import {
  appendTaskEvents,
  clearTaskEvents,
  finishTask,
  heartbeat,
  repositoryAccess,
  saveRun,
  type AveroDatabase,
  type ClaimedTask,
} from '@avero/db';
import { pullRequestComment } from '@avero/github';
import { recordGuardDenied, scrubSecrets, writeLog } from '@avero/observability';
import { CheckoutRefused, withCheckout, type GithubAccess } from './checkout.ts';
import { lifecyclePolicy, outcomeFor, type TaskOutcome } from '../lifecycle/policy.ts';

export type RunTaskDeps = {
  db: AveroDatabase;
  /** Folders a task may run in. A repository outside them is refused. */
  roots: readonly string[];
  /** How to reach GitHub, when this worker is set up for it. */
  github?: GithubAccess | undefined;
  apiKey?: string | undefined;
  sandbox: boolean;
  /**
   * Refuse risky shell commands (pushing, remote shells, fetch-and-run, deleting outside the
   * folder) with a Cursor hook written into each working copy. On by default; it replaces any
   * hooks the repository has, and makes the run load the working copy's project settings.
   */
  guard?: boolean;
  /** The Cursor SDK by default. Tests pass a fake agent. */
  createAgent?: CreateAgent;
  heartbeatMs?: number;
};

function failureMessage(error: unknown): string {
  // Only the message: a stack can carry paths and nothing a person can act on. The message is
  // stored and shown to people, and a failing command can echo a credential, so it is scrubbed.
  return error instanceof Error && error.message
    ? scrubSecrets(error.message.slice(0, 500))
    : 'The task failed.';
}

/**
 * Runs one claimed task to its end and records how it went: finds the repository's folder, checks
 * it is somewhere the worker may work, runs the agent in a throwaway git worktree (the repository
 * itself is never touched), streams its events to the task log, saves the run, optionally has it
 * reviewed, and settles the task. It follows stop requests while the agent works, and never throws:
 * whatever goes wrong ends the task as failed with a reason.
 */
export async function runTask(task: ClaimedTask, deps: RunTaskDeps): Promise<TaskOutcome> {
  const { db } = deps;
  const settle = async (outcome: TaskOutcome, runId?: string): Promise<TaskOutcome> => {
    await finishTask(db, task.id, {
      status: outcome.status,
      ...(runId ? { runId } : {}),
      ...(outcome.error ? { error: outcome.error } : {}),
    });
    writeLog('info', 'task.settled', { taskId: task.id, status: outcome.status });
    return outcome;
  };

  try {
    const access = await repositoryAccess(db, task.repositoryId);
    if (!access) {
      return await settle({
        status: 'failed',
        error: 'The repository cannot be reached: it is missing, detached or its app was removed.',
      });
    }

    await clearTaskEvents(db, task.id);

    const lines: string[] = [];
    const pending: { seq: number; at: string; event: RunEvent }[] = [];
    const controller = new AbortController();
    let flushing: Promise<void> = Promise.resolve();
    const flush = () => {
      const batch = pending.splice(0, pending.length);
      flushing = flushing.then(() => appendTaskEvents(db, task.id, batch)).catch(() => undefined);
      return flushing;
    };
    const tick = async () => {
      await flush();
      const { cancelRequested } = await heartbeat(db, task.id).catch(() => ({
        cancelRequested: false,
      }));
      if (cancelRequested) controller.abort();
    };
    const timer = setInterval(() => void tick(), deps.heartbeatMs ?? lifecyclePolicy.heartbeatMs);

    let recorded;
    let githubToken: string | undefined;
    try {
      recorded = await withCheckout(access, task, deps, async (dir, token) => {
        githubToken = token;
        // The audit sits beside the working copy, not in it, so the agent cannot edit it.
        const auditFile = join(dir, '..', 'avero-guard-audit.jsonl');
        if (deps.guard ?? true) await installShellGuard(dir, { auditFile });
        const hasRules = await installAgentRules(dir, task.rules);
        const result = await recordRun({
          // The guard and the agent's rules are both read from the working copy's project settings.
          projectSettings: (deps.guard ?? true) || hasRules,
          task: task.prompt,
          cwd: dir,
          model: task.model,
          ...(deps.apiKey ? { apiKey: deps.apiKey } : {}),
          sandbox: deps.sandbox,
          signal: controller.signal,
          ...(task.maxTokens || task.maxSeconds
            ? {
                limits: {
                  ...(task.maxTokens ? { maxTokens: task.maxTokens } : {}),
                  ...(task.maxSeconds ? { maxSeconds: task.maxSeconds } : {}),
                },
              }
            : {}),
          ...(deps.createAgent ? { createAgent: deps.createAgent } : {}),
          sink: (line) => {
            lines.push(line);
            const parsed = runEventSchema.safeParse(JSON.parse(line));
            if (parsed.success) {
              pending.push({
                seq: parsed.data.seq,
                at: new Date().toISOString(),
                event: parsed.data,
              });
            }
          },
        });
        const audit = await readGuardAudit(auditFile);
        const denied = audit.filter((entry) => entry.decision === 'deny').length;
        recordGuardDenied(denied);
        if (audit.length > 0) {
          writeLog('info', 'task.commands_checked', {
            taskId: task.id,
            checked: audit.length,
            denied,
          });
        }
        return result;
      });
    } finally {
      clearInterval(timer);
      await flush();
    }

    const text = `${lines.join('\n')}\n`;
    const record = parseRunRecord(text);
    const stopRequested = controller.signal.aborted;
    const outcome = outcomeFor(
      {
        status: recorded.status,
        ...(record.finished?.error ? { error: scrubSecrets(record.finished.error) } : {}),
      },
      stopRequested,
    );

    await saveRun(db, task.workspaceId, { record: text });

    let verdict;
    if (task.review && recorded.status === 'FINISHED') {
      try {
        verdict = await reviewRun({
          record,
          model: task.model,
          ...(deps.apiKey ? { apiKey: deps.apiKey } : {}),
          ...(deps.createAgent ? { createAgent: deps.createAgent } : {}),
        });
        await saveRun(db, task.workspaceId, { record: text, verdict });
      } catch {
        // A review that could not be written does not undo a run that worked.
        writeLog('error', 'task.review_failed', { taskId: task.id });
      }
    }

    // A pull request gets the answer where its author will see it. Failing to post it does not
    // change what the task did.
    if (task.source && deps.github && githubToken) {
      try {
        await deps.github.comment(
          githubToken,
          task.source.repository,
          task.source.number,
          pullRequestComment({
            ...(verdict ? { verdict } : {}),
            ...(!verdict && record.finished?.result ? { summary: record.finished.result } : {}),
          }),
        );
        writeLog('info', 'task.commented', { taskId: task.id });
      } catch {
        writeLog('error', 'task.comment_failed', { taskId: task.id });
      }
    }
    return await settle(outcome, recorded.runId);
  } catch (error) {
    writeLog('error', 'task.failed', { taskId: task.id });
    return settle({
      status: 'failed',
      error: error instanceof CheckoutRefused ? error.message : failureMessage(error),
    });
  }
}
