'use client';

import type { RunRecord } from '@avero/contracts';
import { Button, Display, Lcd, LcdDigits, Slider, SlideSwitch } from '@avero/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildFeed, buildLanes, formatClock, runLength, tokensAt } from '../runs/replay-model';
import './replay-scope.css';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export const replaySpeeds = ['1x', '4x', '16x'] as const;
type Speed = (typeof replaySpeeds)[number];

function seconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** A replayable recorded run: it plays itself, and you can drag the playhead anywhere. */
export function ReplayScope({
  record,
  label = 'Replay · recorded run',
}: {
  record: RunRecord;
  label?: string;
}) {
  const reduced = useReducedMotion();
  const length = useMemo(() => runLength(record), [record]);
  const lanes = useMemo(() => buildLanes(record), [record]);
  const feed = useMemo(() => buildFeed(record), [record]);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [touched, setTouched] = useState(false);
  const [speed, setSpeed] = useState<Speed>('4x');
  const speedRef = useRef(4);
  const feedRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    speedRef.current = Number(speed.replace('x', ''));
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

  const toolCalls = lanes.reduce(
    (sum, lane) =>
      sum + (lane.kind === 'thinking' ? 0 : lane.bars.filter((bar) => bar.start <= shown).length),
    0,
  );

  return (
    <div data-rp="scope" style={{ ['--t-pct' as string]: shown / length }}>
      <Display label={label} aspect="auto">
        <div data-rp="screen">
          <div
            data-rp="wf"
            role="img"
            aria-label={`Timeline of the run at ${formatClock(shown)}: ${lanes
              .map((lane) => `${lane.bars.length} ${lane.label}`)
              .join(', ')}`}
          >
            {lanes.map((lane) => (
              <div key={lane.kind} data-rp="lane" data-kind={lane.kind}>
                <span data-rp="lane-label">{lane.label}</span>
                <span data-rp="track">
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
            <span data-rp="playhead" aria-hidden="true" />
          </div>

          <ol
            ref={feedRef}
            data-rp="feed"
            data-lenis-prevent=""
            aria-label="What the agent did so far"
          >
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
                {row.took !== undefined && <em>{seconds(row.took)}</em>}
                {row.detail && <p>{row.detail}</p>}
              </li>
            ))}
          </ol>
        </div>
      </Display>

      <div data-rp="controls">
        <div data-rp="readouts">
          <Lcd tag="Time" size="sm">
            <LcdDigits value={formatClock(shown)} ghost="88:88.8" />
          </Lcd>
          <Lcd tag="Tokens" size="sm">
            <LcdDigits value={String(tokensAt(record, shown)).padStart(6, '0')} ghost="888888" />
          </Lcd>
          <Lcd tag="Calls" size="sm">
            <LcdDigits value={String(toolCalls).padStart(3, '0')} ghost="888" />
          </Lcd>
        </div>
        <div data-rp="transport">
          <Button
            tone="primary"
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            onClick={() => {
              if (!playing && time >= length) setTime(0);
              setTouched(true);
              setPlaying((value) => !value);
            }}
          >
            {playing && !reduced ? 'Pause' : 'Play'}
          </Button>
          <Slider
            label="Playhead"
            min={0}
            max={length}
            step={Math.max(1, Math.round(length / 1000))}
            value={shown}
            onValueChange={seek}
          />
          <SlideSwitch
            label="Speed"
            options={[...replaySpeeds]}
            value={speed}
            onValueChange={(value) => setSpeed(value as Speed)}
          />
        </div>
      </div>
    </div>
  );
}
