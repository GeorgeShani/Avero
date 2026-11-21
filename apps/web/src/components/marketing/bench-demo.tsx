'use client';

import { Lcd, LcdDigits, Segmented } from '@avero/ui';
import { useState } from 'react';
import { cheapestSetup, setups } from './bench-data';
import { useTween } from './hooks';

const marks = { resolved: '✓', unresolved: '✕', error: '!' } as const;
const words = { resolved: 'resolved', unresolved: 'not resolved', error: 'could not be judged' };

/** A real bench result: two tasks from a demo repository's history, two setups, one repeat. */
export function BenchDemo() {
  const [chosen, setChosen] = useState(setups[0]?.label ?? '');
  const row = setups.find((setup) => setup.label === chosen) ?? setups[0];
  const best = cheapestSetup();
  const maxTokens = Math.max(...setups.map((setup) => setup.tokensPerResolved ?? 0), 1);
  const tokens = useTween((row?.tokensPerResolved ?? 0) / 1000);
  if (!row) return null;

  return (
    <div data-mk="bench">
      <div data-mk="bench-controls">
        <Segmented
          label="Setup"
          options={setups.map((setup) => setup.label)}
          defaultValue={chosen}
          onValueChange={setChosen}
        />
        <div data-mk="readouts" data-stack>
          <Lcd tag="Resolved" size="sm">
            <LcdDigits value={`${row.resolved}/${row.attempts}`} ghost="8/8" />
          </Lcd>
          <Lcd tag="k tokens per resolved" size="sm">
            <LcdDigits value={tokens.toFixed(1).padStart(5, ' ')} ghost="888.8" />
          </Lcd>
        </div>
        <ul data-mk="chips" aria-label={`Outcome of each task with ${row.label.toLowerCase()}`}>
          {row.tasks.map((task) => (
            <li key={task.title}>
              <span aria-hidden="true">{marks[task.outcome]}</span> {task.title}
              <span className="sr-only"> {words[task.outcome]}</span>
            </li>
          ))}
        </ul>
      </div>

      <figure data-mk="chart">
        <div
          data-mk="bars"
          role="img"
          aria-label="Tokens spent per resolved task, by setup, failed attempts included"
        >
          {setups.map((setup) => (
            <div
              key={setup.id}
              data-mk="bar-col"
              data-on={setup.label === row.label ? '' : undefined}
              data-best={best?.id === setup.id ? '' : undefined}
            >
              <span data-mk="bar-value">
                {setup.tokensPerResolved === null
                  ? 'n/a'
                  : `${(setup.tokensPerResolved / 1000).toFixed(1)}k`}
              </span>
              <i style={{ ['--v' as string]: (setup.tokensPerResolved ?? 0) / maxTokens }} />
              <span data-mk="bar-label">{setup.label}</span>
            </div>
          ))}
        </div>
        <figcaption>
          Real result, recorded on a Cursor Pro account: 2 tasks from a small demo repository, 2
          setups, 1 repeat, so 4 attempts. It shows the pipeline works. It does not show which setup
          is better: the two are within 2% of each other, and a few attempts cannot tell them apart.
          Cost in dollars is not shown because Cursor does not report it for this account.
        </figcaption>
      </figure>
    </div>
  );
}
