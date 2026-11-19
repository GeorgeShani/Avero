'use client';

import { Lcd, LcdDigits, ModeDial, Segmented } from '@avero/ui';
import { useState } from 'react';
import { useTween } from './hooks';
import {
  benchData,
  cheapestEffort,
  efforts,
  perResolved,
  type Effort,
  type Rules,
} from './run-data';

/** Pick a setup; the chart, the pass rate and the cost per resolved task follow. */
export function BenchDemo() {
  const [effort, setEffort] = useState<Effort>('medium');
  const [rules, setRules] = useState<Rules>('Baseline');

  const maxValue = Math.max(
    ...efforts.flatMap((e) => (['Baseline', 'Tuned'] as const).map((r) => perResolved(r, e))),
  );
  const pass = useTween(benchData[rules][effort].pass);
  const cost = useTween(perResolved(rules, effort));
  const best = cheapestEffort(rules);

  return (
    <div data-mk="bench">
      <div data-mk="bench-controls">
        <ModeDial
          label="Effort"
          options={efforts.map((value) => ({ value, label: value }))}
          value={effort}
          onValueChange={(value) => setEffort(value as Effort)}
        />
        <Segmented
          label="Rules"
          options={['Baseline', 'Tuned']}
          defaultValue="Baseline"
          onValueChange={(value) => setRules(value as Rules)}
        />
        <div data-mk="readouts" data-stack>
          <Lcd tag="Resolved" size="sm">
            <LcdDigits value={`${Math.round(pass)}%`.padStart(4, ' ')} ghost="888%" />
          </Lcd>
          <Lcd tag="$ per task" size="sm">
            <LcdDigits value={cost.toFixed(2)} ghost="8.88" />
          </Lcd>
        </div>
      </div>

      <figure data-mk="chart">
        <div
          data-mk="bars"
          role="img"
          aria-label={`Cost per resolved task for ${rules} rules by effort`}
        >
          {efforts.map((value) => {
            const v = perResolved(rules, value);
            return (
              <div
                key={value}
                data-mk="bar-col"
                data-on={value === effort ? '' : undefined}
                data-best={value === best ? '' : undefined}
              >
                <span data-mk="bar-value">${v.toFixed(2)}</span>
                <i style={{ ['--v' as string]: v / maxValue }} />
                <span data-mk="bar-label">{value}</span>
              </div>
            );
          })}
        </div>
        <figcaption>
          Cost per resolved task by effort. Lowest here: <strong>{best}</strong>. Example data:
          Bench is not built yet.
        </figcaption>
      </figure>
    </div>
  );
}
