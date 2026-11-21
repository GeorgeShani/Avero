import { decisions, riskTiers, runStatuses } from '@avero/contracts';
import {
  doublePrecision,
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
import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

export const runStatus = pgEnum('run_status', [...runStatuses, 'RUNNING']);
export const riskTier = pgEnum('risk_tier', riskTiers);
export const decisionKind = pgEnum('decision_kind', decisions);

/**
 * A recorded agent run pushed to a workspace. The summary columns are what lists and totals read
 * without parsing anything; `record` is the whole JSONL run record, validated on the way in.
 */
export const runs = pgTable(
  'runs',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** The id the recorder gave the run (`run-mwp9tbas`); unique within a workspace. */
    runId: text('run_id').notNull(),
    task: text().notNull(),
    model: text().notNull(),
    status: runStatus().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    totalTokens: doublePrecision('total_tokens').notNull(),
    costCents: doublePrecision('cost_cents'),
    toolCalls: integer('tool_calls').notNull(),
    filesChanged: integer('files_changed').notNull(),
    additions: integer().notNull(),
    deletions: integer().notNull(),
    record: text('record_jsonl').notNull(),
    pushedBy: uuid('pushed_by').references(() => users.id),
    pushedAt: timestamp('pushed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('runs_workspace_run_unique').on(table.workspaceId, table.runId),
    index('runs_workspace_started_idx').on(table.workspaceId, table.startedAt),
  ],
);

/** The independent reviewer's verdict on a run. One per run; a new review replaces it. */
export const verdicts = pgTable('verdicts', {
  runPk: uuid('run_pk')
    .primaryKey()
    .references(() => runs.id, { onDelete: 'cascade' }),
  risk: riskTier().notNull(),
  failedChecks: integer('failed_checks').notNull(),
  data: jsonb().notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),
});

/** A person's decision on a run. One per run; a later decision replaces it. */
export const runDecisions = pgTable('run_decisions', {
  runPk: uuid('run_pk')
    .primaryKey()
    .references(() => runs.id, { onDelete: 'cascade' }),
  decision: decisionKind().notNull(),
  note: text(),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull(),
  decidedBy: uuid('decided_by').references(() => users.id),
});
