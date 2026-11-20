'use server';

import { revalidatePath } from 'next/cache';
import { recordDecision, type DecisionResult } from '../../../../server/decisions';
import { viewerReadOnly } from '../../../../server/runs';
import { resolveRunsDir } from '../../../../server/runs-dir';

export async function decideRun(
  runId: string,
  decision: string,
  note: string,
): Promise<DecisionResult> {
  const result = await recordDecision(
    { runId, decision, note },
    { dir: resolveRunsDir(), readOnly: viewerReadOnly() },
  );
  if (result.ok) {
    revalidatePath(`/runs/${runId}`);
    revalidatePath('/runs');
    revalidatePath('/overview');
  }
  return result;
}
