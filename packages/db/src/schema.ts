import { workspaceRoles } from '@avero/contracts';
import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const workspaceRole = pgEnum('workspace_role', workspaceRoles);

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('workspaces_owner_idx').on(table.ownerId),
    check('workspaces_name_length', sql`char_length(${table.name}) between 1 and 80`),
    check('workspaces_slug_length', sql`char_length(${table.slug}) between 1 and 63`),
  ],
);

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
