'use client';

import type { RunRecord } from '@avero/contracts';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { buildFeed, buildLanes, formatClock, runLength, tokensAt } from '../runs/replay';
import { Icon, seconds } from './primitives';

const speeds = [1, 4, 16] as const;
const reducedQuery = '(prefers-reduced-motion: reduce)';

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(reducedQuery);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/** A recorded run that plays itself. Drag the playhead anywhere, or click a line to jump to it. */
export function Replay({ record }: { record: RunRecord }) {
  const reduced = useReducedMotion();
  const length = useMemo(() => runLength(record), [record]);
  const lanes = useMemo(() => buildLanes(record), [record]);
  const feed = useMemo(() => buildFeed(record), [record]);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [touched, setTouched] = useState(false);
  const [speed, setSpeed] = useState<(typeof speeds)[number]>(4);
  const speedRef = useRef<number>(4);
  const feedRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!playing || reduced) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setTime((value) => {
        const next = value + dt * speedRef.current;
        if (next >= length) {
          setPlaying(false);
          return length;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced, length]);

  // With reduced motion the replay starts at the end, so everything is on screen.
  const shown = reduced && !touched ? length : time;
  const visible = feed.filter((row) => row.t <= shown);

  useEffect(() => {
    const list = feedRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [visible.length]);

  const seek = (ms: number) => {
    setTouched(true);
    setPlaying(false);
    setTime(Math.min(length, Math.max(0, ms)));
  };

  const calls = lanes.reduce(
    (sum, lane) =>
      sum + (lane.kind === 'thinking' ? 0 : lane.bars.filter((bar) => bar.start <= shown).length),
    0,
  );

  return (
    <section data-panel>
      <div data-panel-head>
        <div>
          <h2>Replay</h2>
          <p>Recorded run, played back</p>
        </div>
        <div data-seg role="group" aria-label="Speed">
          {speeds.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>

      <div
        data-lanes
        style={{ ['--t-pct' as string]: length > 0 ? shown / length : 0 }}
        role="img"
        aria-label={`Timeline at ${formatClock(shown)}: ${lanes
          .map((lane) => `${lane.bars.length} ${lane.label}`)
          .join(', ')}`}
      >
        {lanes.map((lane) => (
          <div key={lane.kind} data-lane data-kind={lane.kind}>
            <span>{lane.label}</span>
            <span data-track>
              {lane.bars.map((bar) => (
                <i
                  key={bar.id}
                  title={bar.label}
                  data-state={bar.end <= shown ? 'done' : bar.start <= shown ? 'live' : 'later'}
                  data-failed={bar.failed ? '' : undefined}
                  style={{
                    left: `${(bar.start / length) * 100}%`,
                    width: `${Math.max(((bar.end - bar.start) / length) * 100, 0.5)}%`,
                  }}
                />
              ))}
            </span>
          </div>
        ))}
        <span data-playhead aria-hidden="true" />
      </div>

      <div data-transport>
        <button
          type="button"
          data-btn
          data-primary
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          onClick={() => {
            if (!playing && time >= length) setTime(0);
            setTouched(true);
            setPlaying((value) => !value);
          }}
        >
          <Icon name={playing && !reduced ? 'pause' : 'play'} size={14} />
          {playing && !reduced ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          aria-label="Playhead"
          min={0}
          max={length}
          step={Math.max(1, Math.round(length / 1000))}
          value={shown}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span data-mono data-dim>
          {formatClock(shown)} / {formatClock(length)}
        </span>
      </div>

      <div data-readouts>
        <span>
          Tokens<strong>{tokensAt(record, shown).toLocaleString('en-US')}</strong>
        </span>
        <span>
          Tool calls<strong>{calls}</strong>
        </span>
      </div>

      <ol ref={feedRef} data-feed aria-label="What the agent did so far">
        {visible.length === 0 && <li data-kind="idle">Press play, or drag the playhead.</li>}
        {visible.map((row) => (
          <li key={row.id} data-kind={row.kind} data-failed={row.failed ? '' : undefined}>
            <button
              type="button"
              onClick={() => seek(row.t)}
              aria-label={`Jump to ${formatClock(row.t)}`}
            >
              {formatClock(row.t)}
            </button>
            <strong>{row.title}</strong>
            {row.took !== undefined ? <em>{seconds(row.took)}</em> : <span />}
            {row.detail && <p>{row.detail}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
