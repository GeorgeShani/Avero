'use client';

import { Display, Lcd, LcdDigits } from '@avero/ui';
import { useRef } from 'react';
import type { RecordLine } from './example';
import { useScrollProgress } from './hooks';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

const beats = [
  {
    title: 'Every tool call, captured.',
    body: 'Reads, edits, shell commands and their results, with arguments, in the order they happened.',
  },
  {
    title: 'Every token, counted.',
    body: 'Usage per turn and per run, so you can see where the time and the money went.',
  },
  {
    title: 'Every change, kept.',
    body: 'The diff, the files touched and the outcome, saved as plain files you can read, grep and share.',
  },
] as const;

/** Scroll-driven: the record writes itself as you scroll through the section. */
export function RecorderStory({ lines }: { lines: readonly RecordLine[] }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useScrollProgress(ref);
  const reduced = useReducedMotion();
  const total = lines.length;
  const shown = reduced ? total : Math.min(total, Math.floor(progress * (total + 2)));
  const beat = reduced ? 0 : Math.min(beats.length - 1, Math.floor(progress * beats.length));

  return (
    <section ref={ref} id="recorder" data-mk="story" aria-labelledby="recorder-title">
      <div data-mk="story-sticky">
        <div data-mk="story-copy">
          <p data-mk="kicker">01 · Recorder</p>
          <h2 id="recorder-title">One run in, a complete record out.</h2>
          <ol data-mk="beats">
            {beats.map((item, index) => (
              <li key={item.title} data-on={index === beat || reduced ? '' : undefined}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
          <p data-mk="aside">
            pnpm avero run wraps a Cursor SDK run and writes .avero/ in your repository. These lines
            are from a real recorded run, shortened.
          </p>
        </div>
        <div data-mk="story-visual">
          <Display label="A real run record · shortened" aspect="auto">
            <ol data-mk="jsonl" aria-label="Lines from a recorded run">
              {lines.slice(0, shown).map((line, index) => (
                <li
                  key={index}
                  data-type={line.type}
                  data-new={index === shown - 1 && !reduced ? '' : undefined}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <code>{line.text}</code>
                </li>
              ))}
              {shown === 0 && <li data-type="idle">scroll to record…</li>}
            </ol>
          </Display>
          <div data-mk="readouts">
            <Lcd tag="Events" size="sm">
              <LcdDigits value={String(shown).padStart(2, '0')} ghost="88" />
            </Lcd>
            <Lcd tag="Progress" size="sm">
              <LcdDigits
                value={`${Math.round((shown / Math.max(total, 1)) * 100)}%`.padStart(4, ' ')}
                ghost="888%"
              />
            </Lcd>
          </div>
        </div>
      </div>
    </section>
  );
}
