import type { Hillclimb } from '@avero/contracts';
import { Panel } from '../../components/console/primitives';
import { stamp, tokens } from '../../lib/format';

export function HillclimbView({ climb }: { climb: Hillclimb }) {
  const best = climb.iterations[climb.bestIteration];
  return (
    <div data-stack>
      <Panel
        title="Hillclimb"
        hint={`${climb.model}, rules in ${climb.rulesPath}, started ${stamp(climb.startedAt)}. One change at a time, kept only if the numbers improved.${climb.holdoutTaskIds.length > 0 ? ` ${climb.holdoutTaskIds.length} task(s) held back to judge.` : ''}`}
      >
        <ol data-steps>
          {climb.iterations.map((iteration) => (
            <li
              key={iteration.n}
              data-kept={iteration.kept}
              data-best={iteration.n === climb.bestIteration}
            >
              <p>
                <strong>{iteration.n === 0 ? 'Starting rules' : `Change ${iteration.n}`}</strong>{' '}
                <span data-tag data-tone={iteration.kept ? 'ok' : 'quiet'}>
                  {iteration.kept ? 'kept' : 'dropped'}
                </span>
                {iteration.n === climb.bestIteration ? (
                  <>
                    {' '}
                    <span data-tag data-tone="ok">
                      best so far
                    </span>
                  </>
                ) : null}
              </p>
              <p data-dim data-mono style={{ fontSize: 12 }}>
                {iteration.resolved}/{iteration.attempts} resolved ·{' '}
                {tokens(iteration.tokensPerResolved)} tokens per resolved task
              </p>
              {iteration.rationale && <p>Why: {iteration.rationale}</p>}
              <p data-dim>{iteration.reason}</p>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel
        title="Best rules"
        hint="Copy these into your repository only if the gain holds up on a rerun."
      >
        <pre data-rules data-mono>
          {best?.rules || '(none)'}
        </pre>
      </Panel>
    </div>
  );
}
