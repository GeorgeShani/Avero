'use client';

import { Button, Meter, SlideSwitch, notify } from '@avero/ui';
import { useEffect, useState } from 'react';
import { useInView, useReducedMotion, useTween } from './hooks';
import { checks } from './run-data';

type Decision = 'approved' | 'sent-back' | null;

const symbols = { pass: '✓', fail: '✕', warn: '!' } as const;
const words = { pass: 'Pass', fail: 'Fails', warn: 'Check' } as const;

/** The reviewer runs its checks one at a time; you decide. */
export function VerdictDemo() {
  const reduced = useReducedMotion();
  const [wrap, seen] = useInView<HTMLDivElement>(0.3);
  const [reviewer, setReviewer] = useState<'Off' | 'On'>('Off');
  const [done, setDone] = useState(0);
  const [decision, setDecision] = useState<Decision>(null);

  const on = reviewer === 'On';
  const revealed = on ? (reduced ? checks.length : done) : 0;

  useEffect(() => {
    if (!on || reduced || done >= checks.length) return;
    const id = setTimeout(() => setDone((value) => value + 1), 650);
    return () => clearTimeout(id);
  }, [on, reduced, done]);

  const risk = useTween(
    on && revealed === checks.length ? 62 : on ? Math.round((revealed / checks.length) * 40) : 0,
  );
  const finished = on && revealed === checks.length;

  const toggle = (value: string) => {
    setReviewer(value as 'Off' | 'On');
    setDone(0);
    setDecision(null);
  };

  const decide = (next: Exclude<Decision, null>) => {
    setDecision(next);
    notify(next === 'approved' ? 'Approved (example)' : 'Sent back to the agent (example)', {
      description: 'Nothing was merged. This is a demo.',
      duration: 2200,
    });
  };

  return (
    <div ref={wrap} data-mk="verdict" data-seen={seen ? '' : undefined}>
      <article data-mk="paper" aria-label="What you asked for">
        <p data-mk="kicker">The task</p>
        <blockquote>
          Retry failed webhook deliveries with exponential backoff, at most 4 attempts.
        </blockquote>
        <dl data-mk="diffstat">
          <div>
            <dt>Files</dt>
            <dd>2</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>+20</dd>
          </div>
          <div>
            <dt>Removed</dt>
            <dd>−1</dd>
          </div>
          <div>
            <dt>Tests</dt>
            <dd>14 pass</dd>
          </div>
        </dl>
        <SlideSwitch
          label="Independent reviewer"
          options={['Off', 'On']}
          value={reviewer}
          onValueChange={toggle}
        />
        <p data-mk="aside">
          {on
            ? 'A second agent, not the author, compares the diff with the task.'
            : 'Switch the reviewer on to check the diff against the task.'}
        </p>
      </article>

      <article data-mk="card" data-decision={decision ?? undefined} aria-label="Verdict">
        <p data-mk="kicker">The verdict · example</p>
        <ul data-mk="checks" aria-live="polite">
          {checks.map((check, index) => {
            const shown = index < revealed;
            return (
              <li
                key={check.id}
                data-verdict={shown ? check.verdict : 'idle'}
                data-shown={shown ? '' : undefined}
              >
                <span data-mk="mark" aria-hidden="true">
                  {shown ? symbols[check.verdict] : '·'}
                </span>
                <span>
                  <strong>{check.label}</strong>
                  <em>{shown ? `${words[check.verdict]}: ${check.note}` : 'waiting…'}</em>
                </span>
              </li>
            );
          })}
        </ul>
        <Meter label="Risk" value={Math.round(risk)} />
        <div data-mk="decision">
          <Button disabled={!finished || decision !== null} onClick={() => decide('sent-back')}>
            Send back
          </Button>
          <Button
            tone="primary"
            data-agent-confirm="Approves the change although one check failed"
            disabled={!finished || decision !== null}
            onClick={() => decide('approved')}
          >
            Approve anyway
          </Button>
        </div>
        {decision && (
          <span data-mk="stamp" data-decision={decision} role="status">
            {decision === 'approved' ? 'Approved' : 'Sent back'}
          </span>
        )}
      </article>
    </div>
  );
}
