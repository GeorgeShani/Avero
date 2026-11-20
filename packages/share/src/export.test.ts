import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportRun } from './export.ts';
import { sampleDecision, sampleRecord, sampleVerdict } from './test-fixtures.ts';

const secret = `crsr_${'0123abcd'.repeat(8)}`;
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'avero-export-'));
  const record = sampleRecord({
    task: `Deploy with ${secret}`,
    result: 'OPENAI_API_KEY=abcdef0123456789',
  });
  await writeFile(
    join(dir, 'run-sample.jsonl'),
    `${[record.started, ...record.events].map((event) => JSON.stringify(event)).join('\n')}\n`,
  );
  await writeFile(
    join(dir, 'run-sample.verdict.json'),
    JSON.stringify(sampleVerdict({ summary: `Leaked ${secret}` })),
  );
  await writeFile(
    join(dir, 'run-sample.decision.json'),
    JSON.stringify(sampleDecision({ note: 'AKIAIOSFODNN7EXAMPLE was exposed' })),
  );
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('exportRun', () => {
  it('reads the record, verdict and decision, redacts all three and renders one page', async () => {
    const { html, redactions } = await exportRun({ dir, runId: 'run-sample' });
    expect(html).toContain('id="avero-data"');
    expect(html).not.toContain(secret);
    expect(html).not.toContain('abcdef0123456789');
    expect(html).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(html).toContain('[REDACTED:cursor-key]');
    expect(html).toContain('"decision":"approved"');
    expect(redactions).toBe(4);
  });

  it('writes the file when asked, creating the folder, and leaves the record on disk unchanged', async () => {
    const outFile = join(dir, 'out', 'share', 'run.html');
    const before = await readFile(join(dir, 'run-sample.jsonl'), 'utf8');
    const result = await exportRun({ dir, runId: 'run-sample', outFile });
    expect(result.outFile).toBe(outFile);
    expect(await readFile(outFile, 'utf8')).toBe(result.html);
    expect(await readFile(join(dir, 'run-sample.jsonl'), 'utf8')).toBe(before);
    expect(before).toContain(secret);
  });

  it('removes extra secrets the caller names', async () => {
    const { html } = await exportRun({ dir, runId: 'run-sample', secrets: ['webhook-retry'] });
    expect(html).not.toContain('webhook-retry');
  });

  it('works without a verdict or a decision', async () => {
    await rm(join(dir, 'run-sample.verdict.json'));
    await rm(join(dir, 'run-sample.decision.json'));
    const { html } = await exportRun({ dir, runId: 'run-sample' });
    expect(html).toContain('"verdict":null');
    expect(html).toContain('"decision":null');
  });

  it('rejects an id that could leave the folder, and a run that does not exist', async () => {
    await expect(exportRun({ dir, runId: '../x' })).rejects.toThrow(/valid run id/);
    await expect(exportRun({ dir, runId: 'run-missing' })).rejects.toThrow(/ENOENT/);
  });
});
