import { z } from 'zod';

/**
 * Hillclimb improves a rules file (AGENTS.md or similar) one measured change at a time: freeze the
 * tasks, change one thing, rerun, and keep the change only if the numbers got better.
 */
export const hillclimbVersion = 1;

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);

export const hillclimbIterationSchema = z.strictObject({
  /** 0 is the starting rules. */
  n: z.number().int().nonnegative(),
  rules: z.string().max(20_000),
  /** Why the change was proposed. Empty for the starting rules. */
  rationale: z.string().max(2000),
  /** The bench result that measured these rules. Absent when the proposal was refused. */
  resultId: slug.optional(),
  resolved: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  tokensPerResolved: z.number().nonnegative().nullable(),
  kept: z.boolean(),
  /** What decided it, in words. */
  reason: z.string().max(600),
});
export type HillclimbIteration = z.infer<typeof hillclimbIterationSchema>;

export const hillclimbSchema = z.strictObject({
  v: z.literal(hillclimbVersion),
  id: slug,
  suiteId: slug,
  model: z.string().min(1).max(128),
  /** The file the rules are written to in each checkout. */
  rulesPath: z.string().min(1).max(1024),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  /** Tasks kept out of what the proposer sees, and used alone to decide. Empty means all tasks. */
  holdoutTaskIds: z.array(slug).max(100),
  iterations: z.array(hillclimbIterationSchema).min(1).max(50),
  /** The iteration whose rules are best so far. */
  bestIteration: z.number().int().nonnegative(),
});
export type Hillclimb = z.infer<typeof hillclimbSchema>;
