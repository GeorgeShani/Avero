import { defineEval, includes } from '@grok/agent-sdk/evals';

export default defineEval({
  tags: ['smoke'],
  async test(t) {
    await t.send('What review is needed for changes to package.json and README.md?');
    t.succeeded();
    t.calledTool('assess_change');
    t.noFailedActions();
    t.check(t.reply, includes('Dependency or workflow review required'));
    t.check(t.reply, includes('package.json'));
  },
});
