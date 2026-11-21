'use client';

import { checkCounts } from '@avero/contracts';
import { Button, Meter, Segmented, SlideSwitch, notify } from '@avero/ui';
import { useEffect, useState } from 'react';
import { reviewedGood, reviewedRisky } from './example-review';
import { useInView, useReducedMotion, useTween } from './hooks';

type Decision = 'approved' | 'rejected' | null;
type Which = 'Correct run' | 'Cancelled run';

const runs: Record<Which, typeof reviewedGood> = {
  'Correct run': reviewedGood,
  'Cancelled run': reviewedRisky,
};

const symbols = { pass: '✓', fail: '✕', unclear: '!' } as const;
const words = { pass: 'Pass', fail: 'Fails', unclear: 'Unclear' } as const;
const tone = { pass: 'pass', fail: 'fail', unclear: 'warn' } as const;
const riskLevel = { low: 15, medium: 55, high: 92 } as const;

/** A real reviewer's verdict on a real recorded run. It checks one claim at a time; you decide. */
export function VerdictDemo() {
  const reduced = useReducedMotion();
  const [wrap, seen] = useInView<HTMLDivElement>(0.3);
  const [which, setWhich] = useState<Which>('Correct run');
  const [reviewer, setReviewer] = useState<'Off' | 'On'>('Off');
  const [done, setDone] = useState(0);
  const [decision, setDecision] = useState<Decision>(null);

  const run = runs[which];
  const { verdict } = run;
  const total = verdict.checks.length;
  const counts = checkCounts(verdict);
  const on = reviewer === 'On';
  const revealed = on ? (reduced ? total : done) : 0;
  const finished = on && revealed === total;
  const failing = counts.fail > 0;

  useEffect(() => {
    if (!on || reduced || done >= total) return;
    const id = setTimeout(() => setDone((value) => value + 1), 600);
    return () => clearTimeout(id);
  }, [on, reduced, done, total]);

  const risk = useTween(finished ? riskLevel[verdict.risk.tier] : on ? 8 : 0);

  const reset = () => {
    setDone(0);
    setDecision(null);
  };

  const decide = (next: Exclude<Decision, null>) => {
    setDecision(next);
    notify(next === 'approved' ? 'Approved (demo)' : 'Rejected (demo)', {
      description:
        'Nothing was saved. In the console this writes a decision file beside the run record.',
      duration: 2600,
    });
  };

  return (
    <div ref={wrap} data-mk="verdict" data-seen={seen ? '' : undefined}>
      <article data-mk="paper" aria-label="What you asked for">
        <p data-mk="kicker">The task · a real recorded run</p>
        <blockquote>{run.task}</blockquote>
        <dl data-mk="diffstat">
          <div>
            <dt>Files</dt>
            <dd>{run.filesChanged}</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>+{run.additions}</dd>
          </div>
          <div>
            <dt>Removed</dt>
            <dd>−{run.deletions}</dd>
          </div>
          <div>
            <dt>Tests</dt>
            <dd>{verdict.tests.ran ? (verdict.tests.passed ? 'passed' : 'ran') : 'not run'}</dd>
          </div>
        </dl>
        <Segmented
          label="Run"
          options={['Correct run', 'Cancelled run']}
          defaultValue={which}
          onValueChange={(value) => {
            setWhich(value as Which);
            setReviewer('Off');
            reset();
          }}
        />
        <SlideSwitch
          label="Independent reviewer"
          options={['Off', 'On']}
          value={reviewer}
          onValueChange={(value) => {
            setReviewer(value as 'Off' | 'On');
            reset();
          }}
        />
        <p data-mk="aside">
          {on
            ? `A second agent (${verdict.reviewer.model}), not the author, compared the diff with the task. This is its real answer.`
            : which === 'Cancelled run'
              ? 'This run was cut off at a time cap. Switch the reviewer on to see what it finds.'
              : 'Switch the reviewer on to check the diff against the task.'}
        </p>
      </article>

      <article data-mk="card" data-decision={decision ?? undefined} aria-label="Verdict">
        <p data-mk="kicker">The verdict · real</p>
        <ul data-mk="checks" aria-live="polite">
          {verdict.checks.map((check, index) => {
            const shown = index < revealed;
            return (
              <li
                key={check.id}
                data-verdict={shown ? tone[check.verdict] : 'idle'}
                data-shown={shown ? '' : undefined}
              >
                <span data-mk="mark" aria-hidden="true">
                  {shown ? symbols[check.verdict] : '·'}
                </span>
                <span>
                  <strong>{check.claim}</strong>
                  <em>{shown ? `${words[check.verdict]}: ${check.evidence}` : 'waiting…'}</em>
                </span>
              </li>
            );
          })}
        </ul>
        <Meter label={finished ? `Risk: ${verdict.risk.tier}` : 'Risk'} value={Math.round(risk)} />
        {finished && verdict.adjustments.length > 0 && (
          <p data-mk="aside" role="status">
            Avero corrected the reviewer: {verdict.adjustments.join(' ')}
          </p>
        )}
        <div data-mk="decision">
          <Button disabled={!finished || decision !== null} onClick={() => decide('rejected')}>
            Reject
          </Button>
          <Button
            tone="primary"
            data-agent-confirm={
              failing ? 'Approves the change although a check failed' : 'Approves the change'
            }
            disabled={!finished || decision !== null}
            onClick={() => decide('approved')}
          >
            {failing ? 'Approve anyway' : 'Approve'}
          </Button>
        </div>
        {decision && (
          <span data-mk="stamp" data-decision={decision} role="status">
            {decision === 'approved' ? 'Approved' : 'Rejected'}
          </span>
        )}
      </article>
    </div>
  );
}
