import { z } from 'zod';
import { runEventSchema } from '../events/run-record.ts';

export const taskStatuses = [
  'queued',
  'running',
  'cancelling',
  'finished',
  'failed',
  'cancelled',
] as const;
export const taskStatusSchema = z.enum(taskStatuses);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/**
 * Which status may follow which. The API and the worker both enforce this, so a task can never
 * jump from `finished` back to `running`, and a cancel always has somewhere legal to go.
 */
export const taskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  // Claimed by a worker, or cancelled before any worker picked it up.
  queued: ['running', 'cancelled'],
  // Ends, is asked to stop, or is put back in the queue after its worker disappeared.
  running: ['finished', 'failed', 'cancelling', 'queued'],
  // The worker stops it; if the run ended first, that result stands.
  cancelling: ['cancelled', 'finished', 'failed'],
  finished: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return taskTransitions[from].includes(to);
}

export function isTerminal(status: TaskStatus): boolean {
  return taskTransitions[status].length === 0;
}

const promptSchema = z.string().trim().min(1).max(8000);

export const taskCreateSchema = z.strictObject({
  repositoryId: z.uuid(),
  /** An agent definition of the workspace: its model and rules are used instead of the defaults. */
  agentId: z.uuid().optional(),
  prompt: promptSchema,
  model: z.string().trim().min(1).max(128).optional(),
  /** Have an independent reviewer agent write a verdict when the run ends. */
  review: z.boolean().optional(),
  limits: z
    .strictObject({
      maxTokens: z.number().int().positive().max(10_000_000).optional(),
      maxSeconds: z.number().int().positive().max(7200).optional(),
    })
    .optional(),
});
export type TaskCreate = z.infer<typeof taskCreateSchema>;

export const taskSchema = z.strictObject({
  id: z.uuid(),
  repositoryId: z.uuid(),
  agentId: z.uuid().nullable(),
  prompt: promptSchema,
  model: z.string(),
  status: taskStatusSchema,
  review: z.boolean(),
  attempt: z.number().int().nonnegative(),
  maxTokens: z.number().int().positive().nullable(),
  maxSeconds: z.number().int().positive().nullable(),
  /** The recorded run this task produced, once it has one. Open it under Runs. */
  runId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});
export type Task = z.infer<typeof taskSchema>;

/** One event of a task's run, in order. `seq` is the cursor a client resumes from. */
export const taskEventSchema = z.strictObject({
  seq: z.number().int().nonnegative(),
  at: z.iso.datetime(),
  event: runEventSchema,
});
export type TaskEvent = z.infer<typeof taskEventSchema>;

export const repositoryCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  /** A folder on the machine the worker runs on. It must be inside the roots the worker allows. */
  path: z.string().trim().min(1).max(1024),
});
export type RepositoryCreate = z.infer<typeof repositoryCreateSchema>;

/** A repository as the API shows it. The path stays on the server. */
export const repositorySchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  /** `local` is a folder on the worker's machine; `github` is a repository the GitHub App reaches. */
  kind: z.enum(['local', 'github']),
  createdAt: z.iso.datetime(),
});
export type Repository = z.infer<typeof repositorySchema>;

/** What started a task when it was not a person: a pull request that needs reviewing. */
export const taskSourceSchema = z.strictObject({
  kind: z.literal('pull_request'),
  /** `owner/name`. */
  repository: z.string(),
  number: z.number().int().positive(),
  headSha: z.string().regex(/^[0-9a-f]{40}$/),
  baseRef: z.string(),
  title: z.string(),
  body: z.string(),
  url: z.url(),
  installationId: z.number().int().positive(),
});
export type TaskSource = z.infer<typeof taskSourceSchema>;

const agentName = z.string().trim().min(1).max(80);

/**
 * A named setup for tasks: a model and a rules text (the contents of AGENTS.md). The rules a
 * hillclimb finds can be saved here and then used on every task that names this agent.
 */
export const agentCreateSchema = z.strictObject({
  name: agentName,
  model: z.string().trim().min(1).max(128),
  rules: z.string().max(6000).default(''),
});
export type AgentCreate = z.infer<typeof agentCreateSchema>;

export const agentSchema = z.strictObject({
  id: z.uuid(),
  name: agentName,
  model: z.string(),
  rules: z.string(),
  createdAt: z.iso.datetime(),
});
export type Agent = z.infer<typeof agentSchema>;
