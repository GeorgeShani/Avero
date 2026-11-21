import { workspaceRoles } from '@avero/contracts';
import { index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

export const workspaceRole = pgEnum('workspace_role', workspaceRoles);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid().defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: workspaceRole().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('workspace_members_workspace_user_unique').on(table.workspaceId, table.userId),
    index('workspace_members_user_idx').on(table.userId),
  ],
);
