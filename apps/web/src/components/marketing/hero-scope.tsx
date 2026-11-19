'use client';

import { Button, Display, Lcd, LcdDigits, Slider, SlideSwitch } from '@avero/ui';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './hooks';
import { clock, costAt, runDuration, spans, tokensAt } from './run-data';

const speeds = ['1x', '2x', '4x'] as const;
type Speed = (typeof speeds)[number];

/** A replayable example run: it plays itself, and you can drag the playhead anywhere. */
export function HeroScope() {
  const reduced = useReducedMotion();
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [touched, setTouched] = useState(false);
  const [speed, setSpeed] = useState<Speed>('1x');
  const speedRef = useRef(1);
  useEffect(() => {
    speedRef.current = Number(speed.replace('x', ''));
  }, [speed]);

  useEffect(() => {
    if (!playing || reduced) return;
    let frame = 0;
    let last = performance.now();
    let hold = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (hold > 0) {
        hold -= dt;
        if (hold <= 0) setTime(0);
      } else {
        setTime((value) => {
          const next = value + dt * speedRef.current;
          if (next >= runDuration) {
            hold = 2.2;
            return runDuration;
          }
          return next;
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);

  const shown = reduced && !touched ? runDuration : time;
  const active = spans.find((span) => shown >= span.start && shown < span.end) ?? spans.at(-1)!;
  const lines = spans.filter((span) => shown >= span.start);

  const scrub = (value: number) => {
    setTouched(true);
    setPlaying(false);
    setTime(value);
  };

  return (
    <div data-mk="scope" style={{ ['--t-pct' as string]: shown / runDuration }}>
      <Display label="Example run · illustrative data" aspect="auto">
        <div data-mk="scope-screen">
          <div data-mk="scope-head">
            <span data-mk="lamp" data-live={playing && !reduced ? '' : undefined} />
            <strong>run-4821</strong>
            <span>composer-2.5</span>
            <span data-mk="scope-state">{active.label}</span>
          </div>

          <div
            data-mk="wf"
            role="img"
            aria-label={`Waterfall of the example run at ${clock(shown)} seconds`}
          >
            {spans.map((span) => {
              const p = Math.min(1, Math.max(0, (shown - span.start) / (span.end - span.start)));
              return (
                <div
                  key={span.id}
                  data-mk="wf-row"
                  data-kind={span.kind}
                  data-active={span.id === active.id ? '' : undefined}
                >
                  <span data-mk="wf-label">{span.label}</span>
                  <span data-mk="wf-track">
                    <i
                      data-mk="wf-bar"
                      style={{
                        left: `${(span.start / runDuration) * 100}%`,
                        width: `${((span.end - span.start) / runDuration) * 100}%`,
                        ['--p' as string]: p,
                      }}
                    />
                  </span>
                </div>
              );
            })}
            <span data-mk="playhead" aria-hidden="true" />
          </div>

          <ol data-mk="events" aria-label="Events so far">
            {lines.slice(-3).map((span) => (
              <li key={span.id}>
                <span>{clock(span.start)}</span>
                <strong>{span.label}</strong>
                <span>{span.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      </Display>

      <div data-mk="scope-controls">
        <div data-mk="readouts">
          <Lcd tag="Time" size="sm">
            <LcdDigits value={clock(shown)} ghost="88:88.8" />
          </Lcd>
          <Lcd tag="Tokens" size="sm">
            <LcdDigits value={String(tokensAt(shown)).padStart(5, '0')} ghost="88888" />
          </Lcd>
          <Lcd tag="Cost" size="sm">
            <LcdDigits value={costAt(shown).toFixed(2)} ghost="8.88" />
          </Lcd>
        </div>
        <div data-mk="transport">
          <Button
            tone="primary"
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            onClick={() => {
              if (!playing && time >= runDuration) setTime(0);
              setTouched(true);
              setPlaying((value) => !value);
            }}
          >
            {playing && !reduced ? 'Pause' : 'Play'}
          </Button>
          <Slider
            label="Playhead"
            min={0}
            max={runDuration}
            step={0.1}
            value={shown}
            onValueChange={scrub}
          />
          <SlideSwitch
            label="Speed"
            options={[...speeds]}
            value={speed}
            onValueChange={(value) => setSpeed(value as Speed)}
          />
        </div>
      </div>
    </div>
  );
}
