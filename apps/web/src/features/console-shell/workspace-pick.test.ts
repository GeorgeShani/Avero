import { describe, expect, it } from 'vitest';
import { pickWorkspace } from './workspace-pick';

const mine = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('pickWorkspace', () => {
  it('uses the remembered workspace when the person belongs to it', () => {
    expect(pickWorkspace(mine, 'b')).toEqual({ id: 'b' });
  });

  it('falls back to the first workspace when nothing is remembered', () => {
    expect(pickWorkspace(mine, undefined)).toEqual({ id: 'a' });
  });

  it('ignores a remembered workspace the person cannot see', () => {
    expect(pickWorkspace(mine, 'someone-elses')).toEqual({ id: 'a' });
  });

  it('returns nothing when the person has no workspace', () => {
    expect(pickWorkspace([], 'a')).toBeUndefined();
  });
});
