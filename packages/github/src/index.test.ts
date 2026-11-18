import { describe, expect, it } from 'vitest';
import { repositorySlugSchema } from './index.ts';

describe('repositorySlugSchema', () => {
  it.each(['vercel/next.js', 'GeorgeShani/avero', 'my-org/repo_name-2', 'a/b'])(
    'accepts %s',
    (slug) => {
      expect(repositorySlugSchema.safeParse(slug).success).toBe(true);
    },
  );

  it.each([
    '',
    'no-slash',
    'a/b/c',
    '/repo',
    'owner/',
    'owner/repo name',
    'ow ner/repo',
    'o_wner/repo',
  ])('rejects %j', (slug) => {
    expect(repositorySlugSchema.safeParse(slug).success).toBe(false);
  });
});
