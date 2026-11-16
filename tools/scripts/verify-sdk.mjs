import assert from 'node:assert/strict';
import { runNx } from './run-command.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--live')) {
  throw new Error('Usage: pnpm verify:sdk [--live]');
}

runNx(['build', '@avero/coding-engine']);
runNx(['run', '@avero/agent-service:agent:validate']);
runNx(['run', '@avero/agent-service:agent:eval:list']);

const { default: tool } = await import('../../apps/agent-service/bot/tools/assess_change.ts');
const input = tool.inputSchema.parse({ paths: ['package.json', 'README.md'] });
assert.deepEqual(await tool.execute(input), {
  verdict: 'Dependency or workflow review required',
  reviewPaths: ['package.json'],
});
assert.equal(tool.inputSchema.safeParse({ paths: [] }).success, false);
console.log('SDK builds, agent project validation, eval discovery, and custom tool checks passed.');

if (args.includes('--live')) {
  runNx(['run', '@avero/coding-engine:cursor:auth']);
  runNx(['run', '@avero/agent-service:agent:auth']);
  runNx(['run', '@avero/coding-engine:cursor:smoke']);
  runNx(['run', '@avero/agent-service:agent:smoke']);
  runNx(['run', '@avero/agent-service:agent:eval']);
  console.log('Both authenticated SDK smoke runs and the live evaluation passed.');
}
