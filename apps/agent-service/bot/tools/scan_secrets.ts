import { defineTool } from '@grok/agent-sdk/tools';
import { z } from 'zod';
import { scanSecrets } from '../../src/scan-secrets.ts';

export default defineTool({
  description:
    'Look for credentials (private keys, cloud and GitHub tokens, secrets assigned in code) in the lines a diff adds. Returns where each was found and the first characters only, never the value. A clean result means none of the known shapes were found, not that the change has no secrets.',
  effect: 'read',
  inputSchema: z.strictObject({ diff: z.string().min(1).max(2_000_000) }),
  async execute({ diff }) {
    return scanSecrets(diff);
  },
});
