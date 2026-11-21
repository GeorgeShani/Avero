import { describe, expect, it } from 'vitest';
import { checkDecision, maxDecisionNote } from './decision.ts';

describe('checkDecision', () => {
  it('accepts each decision and trims the note', () => {
    for (const decision of ['approved', 'changes-requested', 'rejected']) {
      expect(checkDecision({ decision, note: '  fine  ' }, { readOnly: false })).toEqual({
        ok: true,
        decision,
        note: 'fine',
      });
    }
  });

  it('refuses everything on a read-only viewer, before looking at the input', () => {
    expect(checkDecision({ decision: 'nonsense', note: '' }, { readOnly: true })).toEqual({
      ok: false,
      error: 'This viewer is read-only.',
    });
  });

  it('refuses a decision it does not know', () => {
    const result = checkDecision({ decision: 'maybe', note: '' }, { readOnly: false });
    expect(result.ok).toBe(false);
  });

  it('refuses a note that is too long, and allows one at the limit', () => {
    const long = 'x'.repeat(maxDecisionNote + 1);
    expect(checkDecision({ decision: 'approved', note: long }, { readOnly: false }).ok).toBe(false);
    const edge = 'x'.repeat(maxDecisionNote);
    expect(checkDecision({ decision: 'approved', note: edge }, { readOnly: false }).ok).toBe(true);
  });
});
