import { decisions, type Decision } from '@avero/contracts';

export const maxDecisionNote = 2000;

export type DecisionCheck =
  { ok: true; decision: Decision['decision']; note: string } | { ok: false; error: string };

/**
 * Checks what a person submitted as a decision on a run, before anything is written. The viewer has
 * no accounts, so anyone who can open it can decide; a shared viewer turns deciding off with
 * `readOnly`. Whether the run exists is the caller's to check, because that needs storage.
 */
export function checkDecision(
  input: { decision: string; note: string },
  options: { readOnly: boolean },
): DecisionCheck {
  if (options.readOnly) return { ok: false, error: 'This viewer is read-only.' };
  const decision = decisions.find((candidate) => candidate === input.decision);
  if (!decision) return { ok: false, error: 'Choose approve, request changes or reject.' };
  const note = input.note.trim();
  if (note.length > maxDecisionNote) {
    return { ok: false, error: `The note is longer than ${maxDecisionNote} characters.` };
  }
  return { ok: true, decision, note };
}
