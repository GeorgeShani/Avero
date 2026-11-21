import type { ReviewState, RunStatus } from '@avero/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './console.css';

const icons = {
  desk: 'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z',
  runs: 'M4 6h16M4 12h16M4 18h10',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  review: 'M20 6 9 17l-5-5',
  evaluations: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  repositories: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  agents:
    'M12 8V4H8M5 8h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1M2 14h2M20 14h2M9 13v2M15 13v2',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6',
  workspaces:
    'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
  search: 'm21 21-4.3-4.3M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8',
  play: 'M6 4l14 8-14 8z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icons[name]} />
    </svg>
  );
}

export function PageHead({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div data-head>
      <div data-head-title>
        <h1>{title}</h1>
        {children ? <p>{children}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  title,
  hint,
  action,
  flush,
  children,
}: {
  title: string;
  hint?: ReactNode;
  action?: { href: string; label: string };
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section data-panel>
      <div data-panel-head>
        <div>
          <h2>{title}</h2>
          {hint ? <p>{hint}</p> : null}
        </div>
        {action ? <Link href={action.href}>{action.label} →</Link> : null}
      </div>
      <div data-panel-body data-flush={flush ? '' : undefined}>
        {children}
      </div>
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'warn';
}) {
  return (
    <div data-stat data-tone={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function Note({
  tone,
  title,
  children,
}: {
  tone?: 'warn' | 'bad';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div data-note data-tone={tone} role={tone ? 'alert' : undefined}>
      {title ? <strong>{title} </strong> : null}
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div data-empty>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** A run's state. A glyph and a word always carry it; the color only backs them up. */
const statusView: Record<
  RunStatus | 'RUNNING',
  { glyph: string; word: string; tone: 'ok' | 'bad' | 'warn' | 'quiet' }
> = {
  RUNNING: { glyph: '◔', word: 'Running', tone: 'warn' },
  FINISHED: { glyph: '✓', word: 'Finished', tone: 'ok' },
  ERROR: { glyph: '✕', word: 'Failed', tone: 'bad' },
  CANCELLED: { glyph: '■', word: 'Cancelled', tone: 'quiet' },
  EXPIRED: { glyph: '■', word: 'Expired', tone: 'quiet' },
};

export function StatusTag({ status }: { status: RunStatus | 'RUNNING' }) {
  const view = statusView[status];
  return (
    <span data-tag data-tone={view.tone}>
      <i aria-hidden="true">{view.glyph}</i>
      {view.word}
    </span>
  );
}

const riskView = {
  low: { glyph: '●', tone: 'ok' },
  medium: { glyph: '▲', tone: 'warn' },
  high: { glyph: '◆', tone: 'bad' },
} as const;

export function RiskTag({ tier }: { tier: 'low' | 'medium' | 'high' }) {
  const view = riskView[tier];
  return (
    <span data-tag data-tone={view.tone}>
      <i aria-hidden="true">{view.glyph}</i>
      {tier} risk
    </span>
  );
}

const decisionWords = {
  approved: 'Approved',
  'changes-requested': 'Changes requested',
  rejected: 'Rejected',
} as const;

/** The reviewer's risk and the person's decision, as tags. */
export function ReviewTags({ review }: { review: ReviewState }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
      {review.risk ? (
        <RiskTag tier={review.risk} />
      ) : (
        <span data-tag data-tone="quiet">
          not reviewed
        </span>
      )}
      {review.decision ? (
        <span data-tag data-tone={review.decision === 'approved' ? 'ok' : 'bad'}>
          {decisionWords[review.decision]}
        </span>
      ) : (
        <span data-tag data-tone="quiet">
          undecided
        </span>
      )}
    </span>
  );
}
