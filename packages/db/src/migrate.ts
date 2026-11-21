import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Where the SQL migrations are. From both `src/` and `dist/` this is `<package>/src/migrations`,
 * which is why the package ships that folder.
 */
export const migrationsFolder = fileURLToPath(new URL('../src/migrations', import.meta.url));

/**
 * Applies every pending migration, in order, in one session. Safe to run again and on every
 * deploy: migrations already applied are skipped. This is the production counterpart of
 * `drizzle-kit migrate`, which is a development tool and not shipped in the images.
 */
export async function runMigrations(url: string, folder: string = migrationsFolder): Promise<void> {
  const client = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => undefined });
  try {
    await migrate(drizzle(client), { migrationsFolder: folder });
  } finally {
    await client.end();
  }
}
