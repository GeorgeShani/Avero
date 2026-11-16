import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export function connectDatabase(url: string) {
  return drizzle(postgres(url, { max: 5, connect_timeout: 5, prepare: false }), { schema });
}

export type AveroDatabase = ReturnType<typeof connectDatabase>;
