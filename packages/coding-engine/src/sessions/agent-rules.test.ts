import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agentRulesFile, installAgentRules } from './agent-rules.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-rules-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('installAgentRules', () => {
  it('writes the rules as an always-applied Cursor rule', async () => {
    expect(await installAgentRules(dir, '  Run the tests before you finish.\n')).toBe(true);
    const text = await readFile(join(dir, agentRulesFile), 'utf8');
    expect(text).toMatch(
      /^---\n[\s\S]*alwaysApply: true\n---\n\nRun the tests before you finish\.\n$/,
    );
  });

  it('writes nothing for empty rules', async () => {
    expect(await installAgentRules(dir, '   \n')).toBe(false);
    await expect(readFile(join(dir, agentRulesFile), 'utf8')).rejects.toThrow();
  });
});
