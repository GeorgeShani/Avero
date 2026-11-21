import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Where the rules of an agent definition are written in a working copy. */
export const agentRulesFile = '.cursor/rules/avero-agent.mdc';

/**
 * Gives the agent the rules of the definition a task was launched with, as an always-applied Cursor
 * rule in the throwaway working copy. It is a separate file, so the repository's own AGENTS.md and
 * rules stay as they are, and it is not counted as one of the agent's changes. Only loaded when the
 * run reads project settings. Empty rules write nothing.
 */
export async function installAgentRules(dir: string, rules: string): Promise<boolean> {
  const text = rules.trim();
  if (!text) return false;
  const file = join(dir, agentRulesFile);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    `---\ndescription: Rules from the Avero agent definition this task was launched with\nalwaysApply: true\n---\n\n${text}\n`,
  );
  return true;
}
