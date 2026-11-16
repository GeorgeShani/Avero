import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent, JsonlLocalAgentStore } from '@cursor/sdk';
import { summarizeCursorEvent } from './stream-event.ts';
import type { CursorStreamEvent } from './stream-event.ts';

export class SmokeCheckError extends Error {}

export async function runCursorSmoke(model: string, onEvent: (event: CursorStreamEvent) => void) {
  const scratch = await mkdtemp(join(tmpdir(), 'avero-cursor-'));
  try {
    const workspace = join(scratch, 'workspace');
    await mkdir(workspace);
    const nonce = randomUUID();
    await writeFile(join(workspace, 'build-info.ts'), "export const buildId = '" + nonce + "';\n");

    await using agent = await Agent.create({
      model: { id: model },
      tools: ['read'],
      local: {
        cwd: workspace,
        settingSources: [],
        store: new JsonlLocalAgentStore(join(scratch, 'state')),
      },
    });
    const run = await agent.send(
      'Read build-info.ts using your read tool. Reply with just the buildId value, with no formatting.',
    );

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new SmokeCheckError('The Cursor run timed out after 90 seconds.'));
        void run.cancel().catch(() => {
          // Preserve the timeout error if the provider cannot cancel the run.
        });
      }, 90_000);
    });

    async function consumeRun() {
      let eventCount = 0;
      let readCompleted = false;
      for await (const event of run.stream()) {
        eventCount++;
        onEvent(summarizeCursorEvent(event));
        if (event.type === 'tool_call' && event.status === 'completed') readCompleted = true;
      }

      const result = await run.wait();
      if (result.status !== 'finished') {
        throw new SmokeCheckError('The Cursor run ended with status ' + result.status + '.');
      }
      if (!readCompleted || result.result?.trim() !== nonce) {
        throw new SmokeCheckError('The Cursor run did not return the value from the fixture.');
      }

      return { eventCount, requestId: result.requestId };
    }

    try {
      return await Promise.race([consumeRun(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
