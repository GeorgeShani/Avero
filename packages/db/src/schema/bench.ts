import { index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces.ts';

/** A bench suite: tasks mined from a repository's history. The suite itself is a validated JSON document. */
export const benchSuites = pgTable(
  'bench_suites',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text().notNull(),
    data: jsonb().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [unique('bench_suites_workspace_slug_unique').on(table.workspaceId, table.slug)],
);

/** One matrix run of a suite. */
export const benchResults = pgTable(
  'bench_results',
  {
    id: uuid().defaultRandom().primaryKey(),
    suitePk: uuid('suite_pk')
      .notNull()
      .references(() => benchSuites.id, { onDelete: 'cascade' }),
    resultId: text('result_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    data: jsonb().notNull(),
  },
  (table) => [
    unique('bench_results_suite_result_unique').on(table.suitePk, table.resultId),
    index('bench_results_started_idx').on(table.startedAt),
  ],
);

/** One hillclimb over a suite's rules. */
export const hillclimbs = pgTable(
  'hillclimbs',
  {
    id: uuid().defaultRandom().primaryKey(),
    suitePk: uuid('suite_pk')
      .notNull()
      .references(() => benchSuites.id, { onDelete: 'cascade' }),
    hillclimbId: text('hillclimb_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    data: jsonb().notNull(),
  },
  (table) => [unique('hillclimbs_suite_hillclimb_unique').on(table.suitePk, table.hillclimbId)],
);
