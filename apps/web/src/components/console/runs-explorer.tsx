'use client';

import type { RunListItem } from '@avero/contracts';
import { useMemo, useState } from 'react';
import { Empty } from './primitives';
import { RunsTable } from './runs-table';

type Show = 'all' | 'undecided' | 'failed';

const choices: { id: Show; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'undecided', label: 'To decide' },
  { id: 'failed', label: 'Failed' },
];

/** The runs list with a search box and two filters, all on the client: it holds a few hundred
 * rows at most, read from files. */
export function RunsExplorer({ runs }: { runs: RunListItem[] }) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('all');

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return runs.filter((run) => {
      if (show === 'undecided' && !(run.status === 'FINISHED' && !run.review.decision))
        return false;
      if (show === 'failed' && (run.status === 'FINISHED' || run.status === 'RUNNING'))
        return false;
      const haystack = `${run.task} ${run.model} ${run.runId}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [runs, query, show]);

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
          <span>Clear the filter to see all {runs.length} runs.</span>
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
