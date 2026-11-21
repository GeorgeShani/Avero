import { taskStatuses } from '@avero/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { githubInstallations } from './github.ts';
import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

export const repositoryKind = pgEnum('repository_kind', ['local', 'github']);
export const taskStatus = pgEnum('task_status', taskStatuses);

/**
 * Code the worker can work on. `local` is a folder on the worker's machine, registered by a
 * person and checked against the roots the worker allows; GitHub repositories arrive with the
 * GitHub App.
 */
export const repositories = pgTable(
  'repositories',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    kind: repositoryKind().notNull(),
    /** For `local`: the absolute folder. Never sent to a browser. */
    path: text(),
    /** For `github`: the installation that can reach it, and its `owner/name`. */
    installationPk: uuid('installation_pk').references(() => githubInstallations.id, {
      // Uninstalling the app keeps the repository and the history of its tasks; it just cannot be
      // reached any more.
      onDelete: 'set null',
    }),
    githubFullName: text('github_full_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('repositories_workspace_name_unique').on(table.workspaceId, table.name),
    unique('repositories_workspace_github_unique').on(table.workspaceId, table.githubFullName),
    check('repositories_name_length', sql`char_length(${table.name}) between 1 and 80`),
  ],
);

/** A named setup for tasks: a model and rules text (written to AGENTS.md in the working copy). */
export const agents = pgTable(
  'agents',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    model: text().notNull(),
    rules: text().notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('agents_workspace_name_unique').on(table.workspaceId, table.name),
    check('agents_name_length', sql`char_length(${table.name}) between 1 and 80`),
    check('agents_rules_length', sql`char_length(${table.rules}) <= 6000`),
  ],
);

/** A job for an agent: a prompt to run in a repository. */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    /** The agent definition it was launched with, if any. Deleting the agent keeps the task. */
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    prompt: text().notNull(),
    model: text().notNull(),
    status: taskStatus().notNull().default('queued'),
    review: boolean().notNull().default(false),
    /** How many times a worker has started it. A task a worker lost is started again. */
    attempt: integer().notNull().default(0),
    maxTokens: integer('max_tokens'),
    maxSeconds: integer('max_seconds'),
    /** The recorded run it produced (`runs.run_id`), once it has one. */
    runId: text('run_id'),
    error: text(),
    /** What started it, when it was not a person: a pull request, with what is needed to answer it. */
    source: jsonb(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** A running worker touches this every few seconds; a stale one means the worker is gone. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tasks_workspace_created_idx').on(table.workspaceId, table.createdAt),
    index('tasks_status_updated_idx').on(table.status, table.updatedAt),
    check('tasks_prompt_length', sql`char_length(${table.prompt}) between 1 and 8000`),
  ],
);

/** The recorded events of a task's run, in order, so a page can follow it live. */
export const taskEvents = pgTable(
  'task_events',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    seq: integer().notNull(),
    at: timestamp({ withTimezone: true }).notNull(),
    event: jsonb().notNull(),
  },
  (table) => [unique('task_events_task_seq_unique').on(table.taskId, table.seq)],
);

/**
 * Written in the same transaction as the task, so a task is never saved without being queued or
 * queued without being saved. A relay in the worker moves unpublished rows to the queue.
 */
export const taskOutbox = pgTable(
  'task_outbox',
  {
    id: uuid().defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [index('task_outbox_unpublished_idx').on(table.publishedAt, table.createdAt)],
);
