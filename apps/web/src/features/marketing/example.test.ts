import { toolSpans } from '@avero/contracts';
import { describe, expect, it } from 'vitest';
import { exampleRecord, recordLinesFrom } from './example';

describe('exampleRecord', () => {
  it('is a finished real run with a patch and no local paths in it', () => {
    expect(exampleRecord.finished?.status).toBe('FINISHED');
    expect(exampleRecord.finished?.changes?.patch).toContain('diff --git');
    expect(JSON.stringify(exampleRecord)).not.toMatch(/C:\\\\Users|\/Users\/|\/home\//);
  });

  it('includes at least one shell call, which the Agents demo jumps to', () => {
    expect(toolSpans(exampleRecord).some((span) => span.kind === 'shell')).toBe(true);
  });
});

describe('recordLinesFrom', () => {
  const lines = recordLinesFrom(exampleRecord, 12);

  it('keeps to the limit and ends on the closing event', () => {
    expect(lines.length).toBeLessThanOrEqual(12);
    expect(lines.at(-1)?.text).toContain('"type":"run.finished"');
  });

  it('leaves out thinking, the sequence number and long text', () => {
    for (const line of lines) {
      expect(line.text).not.toContain('"seq"');
      expect(line.text).not.toContain('"type":"thinking"');
      expect(line.text.length).toBeLessThan(1200);
    }
  });

  it('starts with the run header, and labels shell and edit calls for colouring', () => {
    expect(lines[0]?.text).toContain('"type":"run.started"');
    const all = recordLinesFrom(exampleRecord, 100);
    expect(all.some((line) => line.type === 'test')).toBe(true);
    expect(all.some((line) => line.type === 'edit')).toBe(true);
  });
});
