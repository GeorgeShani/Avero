import type { Hillclimb } from '@avero/contracts';
import { Card } from '@avero/ui';
import './bench.css';
import { tokens, when } from './format';

export function HillclimbView({ climb }: { climb: Hillclimb }) {
  const best = climb.iterations[climb.bestIteration];
  return (
    <div data-stack>
      <Card
        title="Hillclimb"
        description={`${climb.model}, rules in ${climb.rulesPath}, started ${when(climb.startedAt)}. One change at a time, kept only if the numbers improved.${climb.holdoutTaskIds.length > 0 ? ` ${climb.holdoutTaskIds.length} task(s) held back to judge.` : ''}`}
      >
        <ol data-bn="steps">
          {climb.iterations.map((iteration) => (
            <li
              key={iteration.n}
              data-kept={iteration.kept}
              data-best={iteration.n === climb.bestIteration}
            >
              <p data-bn="step-title">
                <strong>{iteration.n === 0 ? 'Starting rules' : `Change ${iteration.n}`}</strong>
                {' · '}
                {iteration.kept ? 'kept' : 'dropped'}
                {iteration.n === climb.bestIteration ? ' · best so far' : ''}
              </p>
              <p data-bn="dim">
                {iteration.resolved}/{iteration.attempts} resolved ·{' '}
                {tokens(iteration.tokensPerResolved)} tokens per resolved task
              </p>
              {iteration.rationale && <p>Why: {iteration.rationale}</p>}
              <p data-bn="dim">{iteration.reason}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Card
        title="Best rules"
        description="Copy these into your repository only if the gain holds up on a rerun."
      >
        <pre data-bn="rules">{best?.rules || '(none)'}</pre>
      </Card>
    </div>
  );
}
