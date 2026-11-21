import { z } from 'zod';

/** The largest run push the API accepts, in characters of record text. */
export const maxRunPushLength = 25_000_000;

/**
 * What a client sends to put a recorded run in a workspace: the run record file as text, and the
 * verdict and decision files when the run has them. The record, verdict and decision are checked
 * against their own schemas by the server, so this only fixes the envelope.
 */
export const runPushSchema = z.strictObject({
  record: z.string().min(1).max(maxRunPushLength),
  verdict: z.unknown().optional(),
  decision: z.unknown().optional(),
});
export type RunPush = z.infer<typeof runPushSchema>;

export const runPushedSchema = z.strictObject({ runId: z.string(), created: z.boolean() });
export type RunPushed = z.infer<typeof runPushedSchema>;
