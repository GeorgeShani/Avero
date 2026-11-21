#!/usr/bin/env node
import process from 'node:process';
import { runMigrations } from './migrate.ts';

// `node dist/migrate-cli.js`: applies pending migrations to DATABASE_URL, then exits. A failed
// migration exits non-zero so a deploy stops before the new version starts.
const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('DATABASE_URL is not set.\n');
  process.exit(1);
}
try {
  await runMigrations(url);
  process.stdout.write('Migrations are up to date.\n');
} catch (error) {
  // Only the message: the connection string, with its password, is never printed.
  process.stderr.write(`Migration failed: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exit(1);
}
