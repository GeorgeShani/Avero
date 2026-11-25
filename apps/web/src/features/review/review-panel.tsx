'use client';

import { checkCounts, type Decision, type Verdict } from '@avero/contracts';
import { useState, useTransition, type ReactNode } from 'react';
import { CopyCommand } from '../../components/console/copy-command';
import { Note, RiskTag, Term } from '../../components/console/primitives';
import { stamp } from '../../lib/format';
import type { DecisionResult } from '../../server/decisions';

const marks = { pass: '✓', fail: '✕', unclear: '?' } as const;
const words = { pass: 'Pass', fail: 'Fails', unclear: 'Unclear' } as const;

const decisionWords: Record<Decision['decision'], string> = {
  approved: 'Approved',
  'changes-requested': 'Changes requested',
  rejected: 'Rejected',
};

function VerdictBody({ verdict }: { verdict: Verdict }) {
  const counts = checkCounts(verdict);
  return (
    <>
      <div data-review-summary>
        <RiskTag tier={verdict.risk.tier} />
        <span data-mono>
          {counts.pass} pass · {counts.fail} fail · {counts.unclear} unclear
        </span>
      </div>
      <p>{verdict.summary}</p>

      <ul data-checks aria-label="Checks against the task">
        {verdict.checks.map((check) => (
          <li key={check.id} data-verdict={check.verdict}>
            <span data-mark aria-hidden="true">
              {marks[check.verdict]}
            </span>
            <span>
              <strong>{check.claim}</strong>
              <em>
                {words[check.verdict]}: {check.evidence}
              </em>
            </span>
          </li>
        ))}
      </ul>

      <div data-facts>
        <section>
          <h3>Tests</h3>
          <p>
            {verdict.tests.ran
              ? verdict.tests.passed
                ? 'Ran and passed. '
                : 'Ran. '
              : 'Not run. '}
            {verdict.tests.evidence}
          </p>
        </section>
        <section>
          <h3>Outside the task</h3>
          {verdict.outOfScope.length === 0 ? (
            <p>Nothing outside what the task asked for.</p>
          ) : (
            <ul>
              {verdict.outOfScope.map((entry) => (
                <li key={entry.path}>
                  <code>{entry.path}</code> {entry.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>Why this risk</h3>
          {verdict.risk.reasons.length === 0 ? (
            <p>No reasons given.</p>
          ) : (
            <ul>
              {verdict.risk.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {verdict.adjustments.length > 0 && (
        <details data-adjust>
          <summary>Avero corrected the reviewer on {verdict.adjustments.length} point(s)</summary>
          <ul>
            {verdict.adjustments.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** The reviewer's verdict beside the replay, and the person's decision on it. */
export function ReviewPanel({
  runId,
  verdict,
  decision,
  readOnly,
  readOnlyReason = 'This viewer is read-only, so decisions are turned off.',
  decide,
  noVerdict,
}: {
  runId: string;
  verdict?: Verdict;
  decision?: Decision;
  readOnly: boolean;
  /** Why decisions are off, shown under the buttons. */
  readOnlyReason?: string;
  /** Records the decision where this run lives: a folder on this machine, or a workspace. */
  decide: (runId: string, decision: string, note: string) => Promise<DecisionResult>;
  /** What to show when there is no review yet. */
  noVerdict?: ReactNode;
}) {
  const [note, setNote] = useState(decision?.note ?? '');
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const failing = verdict ? checkCounts(verdict).fail > 0 : false;

  const choose = (choice: Decision['decision']) => {
    setError(undefined);
    startTransition(async () => {
      const result = await decide(runId, choice, note);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <section data-panel data-review>
      <div data-panel-head>
        <div>
          <h2>
            <Term k="review">Review</Term>
          </h2>
          <p>
            {verdict
              ? `By ${verdict.reviewer.model}, an AI reviewer · ${stamp(verdict.reviewer.reviewedAt)} UTC`
              : 'No review written yet'}
          </p>
        </div>
      </div>
      <div data-panel-body>
        {verdict ? (
          <VerdictBody verdict={verdict} />
        ) : (
          (noVerdict ?? (
            <div data-empty style={{ padding: 0 }}>
              <p>
                An independent agent reads the task, the diff and the commands, and checks them
                against each other.
              </p>
              <CopyCommand command={`pnpm avero verdict ${runId}`} />
            </div>
          ))
        )}
        {verdict ? (
          <p data-faint style={{ fontSize: 12, marginTop: 12 }}>
            The reviewer is a model and can be wrong. Avero checked it against the record. You
            decide.
          </p>
        ) : null}

        <fieldset data-decide disabled={readOnly || pending}>
          <legend>Your decision</legend>
          {decision && (
            <p role="status">
              <span data-tag data-tone={decision.decision === 'approved' ? 'ok' : 'bad'}>
                {decisionWords[decision.decision]}
              </span>{' '}
              <span data-dim data-mono style={{ fontSize: 12 }}>
                {stamp(decision.decidedAt)} UTC
              </span>
              {decision.note ? <span data-dim> · “{decision.note}”</span> : null}
            </p>
          )}
          <textarea
            data-field
            aria-label="Note (optional)"
            placeholder="Note (optional)"
            value={note}
            maxLength={2000}
            rows={2}
            onChange={(event) => setNote(event.target.value)}
          />
          <div data-decide-buttons>
            <button type="button" data-btn data-danger onClick={() => choose('rejected')}>
              Reject
            </button>
            <button type="button" data-btn onClick={() => choose('changes-requested')}>
              Request changes
            </button>
            <button type="button" data-btn data-primary onClick={() => choose('approved')}>
              {failing ? 'Approve anyway' : 'Approve'}
            </button>
          </div>
          {readOnly && (
            <p data-dim style={{ fontSize: 12 }}>
              {readOnlyReason}
            </p>
          )}
        </fieldset>
        {error && (
          <div style={{ marginTop: 12 }}>
            <Note tone="bad" title="The decision was not saved.">
              {error}
            </Note>
          </div>
        )}
      </div>
    </section>
  );
}
