import { z } from 'zod';

export const postgresUrlSchema = z.url({ protocol: /^postgres(?:ql)?$/ });
