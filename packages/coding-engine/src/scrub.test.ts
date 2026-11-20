import { describe, expect, it } from 'vitest';
import { scrubWorkspacePath } from './scrub.ts';

describe('scrubWorkspacePath', () => {
  it('replaces a Windows path as written and as it appears inside JSON', () => {
    const cwd = String.raw`C:\Users\sam\work\demo`;
    const line = JSON.stringify({ path: `${cwd}\\deliver.js`, text: `in ${cwd}` });
    const scrubbed = scrubWorkspacePath(line, cwd);
    expect(scrubbed).not.toContain('sam');
    expect(JSON.parse(scrubbed)).toEqual({
      path: '<workspace>\\deliver.js',
      text: 'in <workspace>',
    });
  });

  it('replaces a path written with forward slashes', () => {
    expect(
      scrubWorkspacePath('open C:/Users/sam/work/demo/a.ts', String.raw`C:\Users\sam\work\demo`),
    ).toBe('open <workspace>/a.ts');
  });

  it('leaves a line alone when it never mentions the workspace, or the path is just a root', () => {
    expect(scrubWorkspacePath('nothing here', '/home/sam/demo')).toBe('nothing here');
    expect(scrubWorkspacePath('a / b', '/')).toBe('a / b');
  });
});
