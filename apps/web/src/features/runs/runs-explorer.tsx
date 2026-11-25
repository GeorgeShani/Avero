'use client';

import type { RunListItem } from '@avero/contracts';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Empty } from '../../components/console/primitives';
import { RunsTable } from './runs-table';

type Show = 'all' | 'undecided' | 'failed' | 'stopped';

const choices: { id: Show; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'undecided', label: 'To decide' },
  { id: 'failed', label: 'Failed' },
  { id: 'stopped', label: 'Stopped' },
];

const isShow = (value: string | null): value is Show =>
  choices.some((choice) => choice.id === value);

/** Whether a run belongs under a filter. "Stopped" is a person or a limit ending it, not a failure. */
export function matchesShow(run: RunListItem, show: Show): boolean {
  switch (show) {
    case 'all':
      return true;
    case 'undecided':
      return run.status === 'FINISHED' && !run.review.decision;
    case 'failed':
      return run.status === 'ERROR';
    case 'stopped':
      return run.status === 'CANCELLED' || run.status === 'EXPIRED';
  }
}

/**
 * The runs list with a search box and filters, all on the client: it holds a few hundred rows at
 * most, read from files. The filter lives in the address, so a filtered list can be shared or
 * come back after opening a run.
 */
export function RunsExplorer({ runs }: { runs: RunListItem[] }) {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [show, setShow] = useState<Show>(
    isShow(params.get('show')) ? (params.get('show') as Show) : 'all',
  );

  useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set('q', query);
    if (show !== 'all') next.set('show', show);
    const search = next.toString();
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
  }, [query, show]);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return runs.filter((run) => {
      if (!matchesShow(run, show)) return false;
      const haystack = `${run.task} ${run.model} ${run.runId}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [runs, query, show]);

  const filtered = query.trim() !== '' || show !== 'all';

  return (
    <section data-panel>
      <div data-panel-head>
        <div data-seg role="group" aria-label="Show">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={show === choice.id}
              onClick={() => setShow(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <input
          data-field
          type="search"
          value={query}
          placeholder="Filter by task, model or id"
          aria-label="Filter runs"
          onChange={(event) => setQuery(event.target.value)}
          style={{ width: 'min(320px, 50%)' }}
        />
      </div>
      {shown.length === 0 ? (
        <Empty title="No runs match.">
          <span>
            {filtered
              ? `Nothing among all ${runs.length} runs fits this filter.`
              : 'There are no runs.'}
          </span>
          {filtered && (
            <button
              type="button"
              data-btn
              onClick={() => {
                setQuery('');
                setShow('all');
              }}
            >
              Clear the filter
            </button>
          )}
        </Empty>
      ) : (
        <RunsTable runs={shown} />
      )}
      <p role="status" data-sr>
        {shown.length} of {runs.length} runs shown
      </p>
    </section>
  );
}
