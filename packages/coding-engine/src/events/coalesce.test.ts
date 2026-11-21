import { describe, expect, it } from 'vitest';
import { createCoalescer } from './coalesce.ts';

function collect() {
  const out: Record<string, unknown>[] = [];
  return { out, coalescer: createCoalescer((event) => out.push(event)) };
}

describe('createCoalescer', () => {
  it('joins consecutive assistant pieces into one event', () => {
    const { out, coalescer } = collect();
    for (const text of ['Hel', 'lo ', 'there']) coalescer.push({ type: 'assistant', text });
    coalescer.flush();
    expect(out).toEqual([{ type: 'assistant', text: 'Hello there' }]);
  });

  it('writes pending text before the event that interrupts it, keeping order', () => {
    const { out, coalescer } = collect();
    coalescer.push({ type: 'assistant', text: 'Reading' });
    coalescer.push({ type: 'tool', callId: 'a', name: 'read', status: 'running' });
    coalescer.push({ type: 'assistant', text: 'Done' });
    coalescer.flush();
    expect(out.map((event) => event.type)).toEqual(['assistant', 'tool', 'assistant']);
  });

  it('adds up thinking time and cuts very long thinking', () => {
    const { out, coalescer } = collect();
    coalescer.push({ type: 'thinking', text: 'a'.repeat(3000), durationMs: 100 });
    coalescer.push({ type: 'thinking', text: 'b'.repeat(3000), durationMs: 250 });
    coalescer.flush();
    const [event] = out as [{ text: string; durationMs: number }];
    expect(event.text).toHaveLength(4000);
    expect(event.durationMs).toBe(350);
  });

  it('drops assistant text that is empty but keeps thinking time with no text', () => {
    const { out, coalescer } = collect();
    coalescer.push({ type: 'assistant', text: '' });
    coalescer.push({ type: 'thinking', durationMs: 40 });
    coalescer.flush();
    expect(out).toEqual([{ type: 'thinking', durationMs: 40 }]);
  });

  it('passes other events through untouched', () => {
    const { out, coalescer } = collect();
    coalescer.push({ type: 'status', status: 'RUNNING' });
    expect(out).toEqual([{ type: 'status', status: 'RUNNING' }]);
  });
});
