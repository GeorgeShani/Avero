import { checkDecision } from '@avero/security';
import { isRunId, readRun, writeDecision } from '@avero/run-store';

export type DecisionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a person's decision on a run. The viewer has no accounts, so anyone who can open it can
 * decide; set AVERO_READ_ONLY=1 on a viewer that is shared to turn deciding off.
 */
export async function recordDecision(
  input: { runId: string; decision: string; note: string },
  deps: { dir: string; readOnly: boolean; now?: () => Date },
): Promise<DecisionResult> {
  const checked = checkDecision(input, { readOnly: deps.readOnly });
  if (!checked.ok) return checked;
  if (!isRunId(input.runId)) return { ok: false, error: 'That is not a valid run.' };
  const { decision, note } = checked;

  try {
    await readRun(deps.dir, input.runId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, error: 'There is no such run.' };
    }
    return { ok: false, error: 'That run could not be read.' };
  }

  await writeDecision(deps.dir, {
    v: 1,
    runId: input.runId,
    decision,
    ...(note ? { note } : {}),
    decidedAt: (deps.now?.() ?? new Date()).toISOString(),
  });
  return { ok: true };
}
