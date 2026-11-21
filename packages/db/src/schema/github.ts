import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces.ts';

/**
 * A GitHub App installation attached to one workspace. An installation belongs to exactly one
 * workspace, so a delivery for it can only ever act inside that workspace.
 */
export const githubInstallations = pgTable(
  'github_installations',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** GitHub's own installation id. Unique across all workspaces. */
    installationId: bigint('installation_id', { mode: 'number' }).notNull().unique(),
    account: text(),
    /** `active` or `suspended`. A suspended installation takes no new tasks. */
    status: text().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('github_installations_workspace_idx').on(table.workspaceId)],
);

/**
 * Every webhook delivery that was accepted, by GitHub's delivery id. GitHub redelivers on
 * timeouts and on request, so the second arrival of the same id is recognised and ignored.
 */
export const webhookDeliveries = pgTable('webhook_deliveries', {
  deliveryId: text('delivery_id').primaryKey(),
  event: text().notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
});
