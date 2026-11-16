import { z } from 'zod';

export const repositorySlugSchema = z.string().regex(/^[a-z0-9-]+\/[a-z0-9_.-]+$/i);
