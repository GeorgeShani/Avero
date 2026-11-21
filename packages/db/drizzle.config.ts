import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

if (existsSync('../../.env')) loadEnvFile('../../.env');
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  ...(databaseUrl
    ? { dbCredentials: { url: z.url({ protocol: /^postgres(?:ql)?$/ }).parse(databaseUrl) } }
    : {}),
});
