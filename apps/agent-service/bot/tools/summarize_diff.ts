import { defineTool } from '@grok/agent-sdk/tools';
import { z } from 'zod';
import { summarizeDiff } from '../../src/summarize-diff.ts';

export default defineTool({
  description:
    'Summarize a unified diff (`git diff` output): files changed, lines added and removed, and what deserves a person’s eyes on purpose (environment files, migrations, dependency or workflow files, deleted tests, permission changes, binary files). Use it before judging the scope of a change.',
  effect: 'read',
  inputSchema: z.strictObject({ diff: z.string().min(1).max(2_000_000) }),
  async execute({ diff }) {
    return summarizeDiff(diff);
  },
});
