import { z } from 'zod';

/** What the `assess_change` agent tool accepts: the paths a change touched. */
export const changeAssessmentInputSchema = z.strictObject({
  paths: z.array(z.string().min(1).max(1024)).min(1).max(100),
});
