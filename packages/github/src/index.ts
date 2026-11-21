import { z } from 'zod';

export const repositorySlugSchema = z.string().regex(/^[a-z0-9-]+\/[a-z0-9_.-]+$/i);

export * from './client/index.ts';
export * from './installations/index.ts';
export * from './pull-requests/index.ts';
export * from './webhooks/index.ts';
