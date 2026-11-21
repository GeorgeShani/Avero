import { defineTool } from '@grok/agent-sdk/tools';
import { z } from 'zod';
import { checkTests } from '../../src/check-tests.ts';

export default defineTool({
  description:
    'Say whether tests ran, from the shell commands of a recorded run and their exit codes. The verdict is "not run" when no command was a test run, and follows the latest test command otherwise. Use it instead of assuming that tests were run or that they passed.',
  effect: 'read',
  inputSchema: z.strictObject({
    commands: z
      .array(
        z.strictObject({
          command: z.string().min(1).max(2000),
          exitCode: z.number().int().nullable(),
        }),
      )
      .max(500),
  }),
  async execute({ commands }) {
    return checkTests(commands);
  },
});
