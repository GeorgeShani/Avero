import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.ts';

// Real PostgreSQL: skipped unless AVERO_TEST_DATABASE_URL is set. The role must be allowed to create
// databases (the local and CI services use the superuser). Each run uses a fresh, empty database.
const url = process.env.AVERO_TEST_DATABASE_URL;

describe.skipIf(!url)('running migrations the way a deploy does', () => {
  const name = `avero_migrate_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let admin: ReturnType<typeof postgres>;
  let target: string;

  beforeAll(async () => {
    admin = postgres(url as string, { max: 1 });
    await admin.unsafe(`create database ${name}`);
    const parsed = new URL(url as string);
    parsed.pathname = `/${name}`;
    target = parsed.toString();
  });
  afterAll(async () => {
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.end();
  });

  it('builds the whole schema in an empty database, and does nothing the second time', async () => {
    await runMigrations(target);
    await runMigrations(target);

    const db = postgres(target, { max: 1 });
    try {
      const tables = (
        await db<{ table_name: string }[]>`
          select table_name from information_schema.tables where table_schema = 'public'`
      ).map((row) => row.table_name);
      for (const expected of [
        'users',
        'workspaces',
        'runs',
        'tasks',
        'task_outbox',
        'github_installations',
        'agents',
      ])
        expect(tables).toContain(expected);
      const [applied] = await db<{ count: string }[]>`
        select count(*) from drizzle.__drizzle_migrations`;
      expect(Number(applied?.count)).toBe(5);
    } finally {
      await db.end();
    }
  });

  it('fails, and says why, when the database cannot be reached', async () => {
    await expect(runMigrations('postgresql://nobody:x@127.0.0.1:1/none')).rejects.toThrow();
  });
});
