'use client';

import type { Agent } from '@avero/contracts';
import { useState } from 'react';
import { Note, Panel } from '../../components/console/primitives';
import { stamp } from '../../lib/format';
import { call } from '../api-call';

/**
 * Agent definitions: a model and the rules text a task is run with. Pick one when launching a
 * task. The rules are written into the task's throwaway working copy as an always-applied Cursor
 * rule, beside the repository's own rules, never over them.
 */
export function AgentsView({
  workspaceId,
  initial,
  canManage,
  defaultModel,
}: {
  workspaceId: string;
  initial: Agent[];
  canManage: boolean;
  defaultModel: string;
}) {
  const base = `/api/v1/workspaces/${workspaceId}/agents`;
  const [agents, setAgents] = useState(initial);
  const [name, setName] = useState('');
  const [model, setModel] = useState(defaultModel);
  const [rules, setRules] = useState('');
  const [error, setError] = useState<string>();

  const create = async () => {
    setError(undefined);
    const result = await call<Agent>(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, model, rules }),
    });
    if (!result.ok) return setError(result.error);
    const added = result.data;
    setAgents((list) => [...list, added].sort((a, b) => a.name.localeCompare(b.name)));
    setName('');
    setRules('');
  };

  const remove = async (agent: Agent) => {
    setError(undefined);
    const result = await call<{ deleted: true }>(`${base}/${agent.id}`, { method: 'DELETE' });
    if (!result.ok) return setError(result.error);
    setAgents((list) => list.filter((item) => item.id !== agent.id));
  };

  return (
    <div data-stack>
      {error && (
        <Note tone="bad" title="That did not work.">
          {error}
        </Note>
      )}

      <Panel
        title="Agents"
        hint="A task launched with an agent uses its model and follows its rules"
        flush
      >
        {agents.length === 0 ? (
          <p data-dim style={{ padding: 16 }}>
            No agents yet. Tasks run with the server&apos;s default model and no extra rules.
          </p>
        ) : (
          <ul data-items>
            {agents.map((agent) => (
              <li key={agent.id} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <div data-item-main>
                  <span style={{ fontWeight: 500 }}>{agent.name}</span>
                  <span data-item-meta>
                    {agent.model} ·{' '}
                    {agent.rules.trim() ? `${agent.rules.length} characters of rules` : 'no rules'}{' '}
                    · added {stamp(agent.createdAt)}
                  </span>
                  {agent.rules.trim() && (
                    <pre data-cmd style={{ maxHeight: 160, overflow: 'auto' }}>
                      {agent.rules}
                    </pre>
                  )}
                </div>
                {canManage && (
                  <button type="button" data-btn data-danger onClick={() => void remove(agent)}>
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="New agent"
        hint="Rules found by a hillclimb on the Evaluations page can be pasted here"
      >
        {!canManage ? (
          <p data-dim>Only owners and admins can create agents.</p>
        ) : (
          <div data-stack>
            <input
              data-field
              aria-label="Name"
              placeholder="Name, for example careful"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              data-field
              aria-label="Model"
              placeholder="Model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
            <textarea
              data-field
              aria-label="Rules"
              placeholder="Rules the agent follows, as you would write them in AGENTS.md"
              rows={6}
              maxLength={6000}
              value={rules}
              onChange={(event) => setRules(event.target.value)}
            />
            <div>
              <button
                type="button"
                data-btn
                data-primary
                disabled={name.trim() === '' || model.trim() === ''}
                onClick={() => void create()}
              >
                Create agent
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
