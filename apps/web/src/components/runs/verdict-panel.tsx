'use client';

import { checkCounts, type Decision, type Verdict } from '@avero/contracts';
import { Alert, Button, Card, Textarea } from '@avero/ui';
import { useState, useTransition } from 'react';
import { decideRun } from '../../app/(console)/runs/[id]/actions';
import './runs.css';
import './verdict.css';

const marks = { pass: '✓', fail: '✕', unclear: '?' } as const;
const words = { pass: 'Pass', fail: 'Fails', unclear: 'Unclear' } as const;
const tierMarks = { low: '●', medium: '▲', high: '◆' } as const;

const decisionWords: Record<Decision['decision'], string> = {
  approved: 'Approved',
  'changes-requested': 'Changes requested',
  rejected: 'Rejected',
};

function when(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function VerdictBody({ verdict }: { verdict: Verdict }) {
  const counts = checkCounts(verdict);
  return (
    <div data-vd="body">
      <div data-vd="head">
        <span data-vd="tier" data-tier={verdict.risk.tier}>
          <span aria-hidden="true">{tierMarks[verdict.risk.tier]}</span> {verdict.risk.tier} risk
        </span>
        <span data-vd="counts">
          {counts.pass} pass · {counts.fail} fail · {counts.unclear} unclear
        </span>
        <span data-vd="when">reviewed {when(verdict.reviewer.reviewedAt)}</span>
      </div>

      <p data-vd="summary">{verdict.summary}</p>

      <ul data-vd="checks" aria-label="Checks against the task">
        {verdict.checks.map((check) => (
          <li key={check.id} data-verdict={check.verdict}>
            <span data-vd="mark" aria-hidden="true">
              {marks[check.verdict]}
            </span>
            <span>
              <strong>{check.claim}</strong>
              <em>
                {words[check.verdict]}: {check.evidence}
              </em>
              {check.files && check.files.length > 0 && (
                <span data-vd="files">
                  {check.files.map((file) => (
                    <code key={file}>{file}</code>
                  ))}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div data-vd="facts">
        <section aria-labelledby="vd-tests">
          <h4 id="vd-tests">Tests</h4>
          <p>
            {verdict.tests.ran
              ? verdict.tests.passed
                ? 'Ran and passed. '
                : 'Ran. '
              : 'Not run. '}
            {verdict.tests.evidence}
          </p>
        </section>
        <section aria-labelledby="vd-scope">
          <h4 id="vd-scope">Outside the task</h4>
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
        <section aria-labelledby="vd-risk">
          <h4 id="vd-risk">Why this risk</h4>
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
        <details data-vd="adjustments">
          <summary>Avero corrected the reviewer on {verdict.adjustments.length} point(s)</summary>
          <ul>
            {verdict.adjustments.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** The reviewer's verdict, and the person's decision on it. */
export function VerdictPanel({
  runId,
  verdict,
  decision,
  readOnly,
}: {
  runId: string;
  verdict?: Verdict;
  decision?: Decision;
  readOnly: boolean;
}) {
  const [note, setNote] = useState(decision?.note ?? '');
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const failing = verdict ? checkCounts(verdict).fail > 0 : false;

  const choose = (choice: Decision['decision']) => {
    setError(undefined);
    startTransition(async () => {
      const result = await decideRun(runId, choice, note);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <Card
      title="Verdict"
      description={
        verdict
          ? `Written by ${verdict.reviewer.model}, an AI reviewer. Avero checked it against the record. You decide.`
          : 'No review has been written for this run yet.'
      }
    >
      <div data-stack>
        {verdict ? (
          <VerdictBody verdict={verdict} />
        ) : (
          <div data-vd="empty">
            <p>
              An independent agent reads the task, the diff and the commands, and checks them
              against each other.
            </p>
            <pre data-rp="command">{`pnpm avero verdict ${runId}`}</pre>
          </div>
        )}

        <fieldset data-vd="decide" disabled={readOnly || pending}>
          <legend>Your decision</legend>
          {decision && (
            <p data-vd="decided" data-decision={decision.decision} role="status">
              <strong>{decisionWords[decision.decision]}</strong> · {when(decision.decidedAt)}
              {decision.note ? ` · “${decision.note}”` : ''}
            </p>
          )}
          <Textarea
            label="Note (optional)"
            value={note}
            onValueChange={(value: string) => setNote(value)}
            maxLength={2000}
            rows={2}
          />
          <div data-vd="buttons">
            <Button onClick={() => choose('rejected')}>Reject</Button>
            <Button onClick={() => choose('changes-requested')}>Request changes</Button>
            <Button tone="primary" onClick={() => choose('approved')}>
              {failing ? 'Approve anyway' : 'Approve'}
            </Button>
          </div>
          {readOnly && <p data-vd="dim">This viewer is read-only, so decisions are turned off.</p>}
        </fieldset>
        {error && (
          <Alert tone="danger" title="The decision was not saved">
            {error}
          </Alert>
        )}
      </div>
    </Card>
  );
}
