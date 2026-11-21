import type { RunSource } from '@avero/contracts';
import { checkDecision } from '@avero/security';

export type DecisionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a person's decision on a run. The viewer has no accounts, so anyone who can open it can
 * decide; set AVERO_READ_ONLY=1 on a viewer that is shared to turn deciding off.
 */
export async function recordDecision(
  input: { runId: string; decision: string; note: string },
  deps: { source: RunSource; readOnly: boolean; now?: () => Date },
): Promise<DecisionResult> {
  const checked = checkDecision(input, { readOnly: deps.readOnly });
  if (!checked.ok) return checked;
  const { decision, note } = checked;

  try {
    if (!(await deps.source.getRun(input.runId)))
      return { ok: false, error: 'There is no such run.' };
  } catch {
    return { ok: false, error: 'That run could not be read.' };
  }

  await deps.source.saveDecision({
    v: 1,
    runId: input.runId,
    decision,
    ...(note ? { note } : {}),
    decidedAt: (deps.now?.() ?? new Date()).toISOString(),
  });
  return { ok: true };
}
