import { decisions } from '@avero/contracts';
import { isRunId, readRun, writeDecision } from '@avero/run-store';

export type DecisionResult = { ok: true } | { ok: false; error: string };

const maxNote = 2000;

/**
 * Records a person's decision on a run. The viewer has no accounts, so anyone who can open it can
 * decide; set AVERO_READ_ONLY=1 on a viewer that is shared to turn deciding off.
 */
export async function recordDecision(
  input: { runId: string; decision: string; note: string },
  deps: { dir: string; readOnly: boolean; now?: () => Date },
): Promise<DecisionResult> {
  if (deps.readOnly) return { ok: false, error: 'This viewer is read-only.' };
  if (!isRunId(input.runId)) return { ok: false, error: 'That is not a valid run.' };
  const decision = decisions.find((candidate) => candidate === input.decision);
  if (!decision) return { ok: false, error: 'Choose approve, request changes or reject.' };
  const note = input.note.trim();
  if (note.length > maxNote)
    return { ok: false, error: `The note is longer than ${maxNote} characters.` };

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
