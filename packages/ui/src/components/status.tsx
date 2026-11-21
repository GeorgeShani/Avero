export const taskStatuses = [
  'queued',
  'preparing',
  'running',
  'awaiting-approval',
  'completed',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const statusMeta: Record<TaskStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  preparing: { label: 'Preparing', tone: 'info' },
  running: { label: 'Running', tone: 'info' },
  'awaiting-approval': { label: 'Awaiting approval', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** One distinct shape per state, so status is never carried by color alone. */
function Shape({ state }: { state: TaskStatus }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true } as const;
  switch (state) {
    case 'queued':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'preparing':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6 2a4 4 0 0 1 0 8Z" fill="currentColor" />
        </svg>
      );
    case 'running':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.4" fill="currentColor" />
        </svg>
      );
    case 'awaiting-approval':
      return (
        <svg {...common}>
          <path d="M6 1 11 6 6 11 1 6Z" fill="currentColor" />
        </svg>
      );
    case 'completed':
      return (
        <svg {...common}>
          <path d="M2 6.4 5 9.2 10.2 3" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'failed':
      return (
        <svg {...common}>
          <path
            d="M2.4 2.4 9.6 9.6M9.6 2.4 2.4 9.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case 'cancelled':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.2 8.8 8.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
  }
}

export function StatusSymbol({ state }: { state: TaskStatus }) {
  return (
    <span data-state={state} style={{ display: 'inline-grid', placeItems: 'center' }}>
      <Shape state={state} />
    </span>
  );
}

/** Symbol, label and tone for a task state. The label and a distinct shape are always rendered. */
export function TaskStatusBadge({ state }: { state: TaskStatus }) {
  const { label, tone } = statusMeta[state];
  return (
    <span data-kit="badge" data-tone={tone} data-state={state}>
      <StatusSymbol state={state} />
      {label}
    </span>
  );
}

export function statusLabel(state: TaskStatus): string {
  return statusMeta[state].label;
}
