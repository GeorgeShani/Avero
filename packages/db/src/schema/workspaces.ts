import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

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
