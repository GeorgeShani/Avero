import { changeAssessmentInputSchema } from '@avero/contracts';
import { defineTool } from '@grok/agent-sdk/tools';
import { assessChange } from '../../src/assess-change.ts';

export default defineTool({
  description: 'Identify changed dependency manifests, lockfiles, and GitHub Actions workflows.',
  effect: 'read',
  inputSchema: changeAssessmentInputSchema,
  async execute({ paths }) {
    return assessChange(paths);
  },
});
