import { workspaceRoles } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { canEditWorkspace, redactSecrets, workspaceEditors } from './index.ts';

describe('canEditWorkspace', () => {
  it('lets only owners and admins edit', () => {
    const allowed = workspaceRoles.filter((role) => canEditWorkspace(role));
    expect(allowed).toEqual(['owner', 'admin']);
    expect(workspaceEditors).toEqual(['owner', 'admin']);
  });

  it.each(['member', 'viewer'] as const)('denies the %s role', (role) => {
    expect(canEditWorkspace(role)).toBe(false);
  });
});

describe('redactSecrets', () => {
  it('replaces every occurrence of each secret', () => {
    expect(redactSecrets('a=tok1 b=tok2 c=tok1', ['tok1', 'tok2'])).toBe(
      'a=[redacted] b=[redacted] c=[redacted]',
    );
  });

  it('redacts the longest secret first when one contains another', () => {
    expect(redactSecrets('key sk_live_abc', ['sk_live', 'sk_live_abc'])).toBe('key [redacted]');
  });

  it('treats secret values literally, not as patterns', () => {
    expect(redactSecrets('pw=a.b*c and axbbc', ['a.b*c'])).toBe('pw=[redacted] and axbbc');
  });

  it('ignores empty secrets and returns the text unchanged when none apply', () => {
    expect(redactSecrets('nothing to hide', ['', ''])).toBe('nothing to hide');
    expect(redactSecrets('nothing to hide', [])).toBe('nothing to hide');
  });
});
