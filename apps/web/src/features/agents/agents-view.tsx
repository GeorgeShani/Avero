'use client';

import type { Agent } from '@avero/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmButton } from '../../components/console/confirm-button';
import { CopyCommand } from '../../components/console/copy-command';
import { Note, Panel, Term } from '../../components/console/primitives';
import { useToast } from '../../components/console/toast';
import { stamp } from '../../lib/format';
import { call } from '../api-call';

/** The fields of an agent, as a form. Used to create one and to change one. */
function AgentFields({
  value,
  onChange,
}: {
  value: { name: string; model: string; rules: string };
  onChange: (next: { name: string; model: string; rules: string }) => void;
}) {
  return (
    <div data-stack>
      <input
        data-field
        aria-label="Name"
        placeholder="Name, for example careful"
        maxLength={80}
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
      />
      <input
        data-field
        aria-label="Model"
        placeholder="Model"
        value={value.model}
        onChange={(event) => onChange({ ...value, model: event.target.value })}
      />
      <textarea
        data-field
        aria-label="Rules"
        placeholder="Rules the agent follows, as you would write them in AGENTS.md"
        rows={6}
        maxLength={6000}
        value={value.rules}
        onChange={(event) => onChange({ ...value, rules: event.target.value })}
      />
    </div>
  );
}

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
  const [draft, setDraft] = useState({ name: '', model: defaultModel, rules: '' });
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    model: string;
    rules: string;
  }>();
  const [error, setError] = useState<string>();
  const toast = useToast();

  const sorted = (list: Agent[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  const create = async () => {
    setError(undefined);
    const result = await call<Agent>(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!result.ok) return setError(result.error);
    const added = result.data;
    setAgents((list) => sorted([...list, added]));
    setDraft({ name: '', model: defaultModel, rules: '' });
    toast(`Created “${added.name}”.`);
  };

  const save = async () => {
    if (!editing) return;
    setError(undefined);
    const { id, ...fields } = editing;
    const result = await call<Agent>(`${base}/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!result.ok) return setError(result.error);
    const updated = result.data;
    setAgents((list) => sorted(list.map((item) => (item.id === id ? updated : item))));
    setEditing(undefined);
    toast(`Saved “${updated.name}”. Tasks already launched keep the model they were given.`);
  };

  const remove = async (agent: Agent) => {
    setError(undefined);
    const result = await call<{ deleted: true }>(`${base}/${agent.id}`, { method: 'DELETE' });
    if (!result.ok) return setError(result.error);
    setAgents((list) => list.filter((item) => item.id !== agent.id));
    toast(`Deleted “${agent.name}”.`);
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
        hint={
          <>
            A task launched with an <Term k="agent">agent</Term> uses its model and follows its
            rules
          </>
        }
        flush
      >
        {agents.length === 0 ? (
          <p data-dim style={{ padding: 16 }}>
            No agents yet. Tasks run with the server&apos;s default model ({defaultModel}) and no
            extra rules. Create an agent below to change that.
          </p>
        ) : (
          <ul data-items>
            {agents.map((agent) => (
              <li key={agent.id} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                {editing?.id === agent.id ? (
                  <>
                    <div data-item-main>
                      <AgentFields
                        value={editing}
                        onChange={(next) => setEditing({ id: agent.id, ...next })}
                      />
                    </div>
                    <span style={{ display: 'flex', gap: 8, alignSelf: 'start' }}>
                      <button
                        type="button"
                        data-btn
                        data-primary
                        disabled={editing.name.trim() === '' || editing.model.trim() === ''}
                        onClick={() => void save()}
                      >
                        Save
                      </button>
                      <button type="button" data-btn onClick={() => setEditing(undefined)}>
                        Cancel
                      </button>
                    </span>
                  </>
                ) : (
                  <>
                    <div data-item-main>
                      <span style={{ fontWeight: 500 }}>{agent.name}</span>
                      <span data-item-meta>
                        {agent.model} ·{' '}
                        {agent.rules.trim()
                          ? `${agent.rules.length} characters of rules`
                          : 'no rules'}{' '}
                        · added {stamp(agent.createdAt)}
                      </span>
                      {agent.rules.trim() && (
                        <CopyCommand command={agent.rules} label={`Rules of ${agent.name}`} />
                      )}
                    </div>
                    {canManage && (
                      <span style={{ display: 'flex', gap: 8, alignSelf: 'start' }}>
                        <button
                          type="button"
                          data-btn
                          onClick={() => {
                            setEditing({
                              id: agent.id,
                              name: agent.name,
                              model: agent.model,
                              rules: agent.rules,
                            });
                          }}
                        >
                          Edit
                        </button>
                        <ConfirmButton
                          label="Delete"
                          title={`Delete “${agent.name}”?`}
                          confirmLabel="Delete agent"
                          onConfirm={() => remove(agent)}
                        >
                          Tasks already launched with it keep running and keep their record of the
                          model. New tasks can no longer choose it.
                        </ConfirmButton>
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="New agent"
        hint={
          <>
            Rules found by a <Term k="hillclimb">hillclimb</Term> on the{' '}
            <Link href="/evaluations">Evaluations</Link> page can be pasted here
          </>
        }
      >
        {!canManage ? (
          <p data-dim>Only owners and admins can create agents.</p>
        ) : (
          <div data-stack>
            <AgentFields value={draft} onChange={setDraft} />
            <div>
              <button
                type="button"
                data-btn
                data-primary
                disabled={draft.name.trim() === '' || draft.model.trim() === ''}
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
