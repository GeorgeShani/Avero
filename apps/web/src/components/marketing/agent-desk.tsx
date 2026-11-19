'use client';

import {
  Button,
  Display,
  describeEntry,
  elementOf,
  notify,
  type AgentComponent,
  type HistoryEntry,
} from '@avero/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { browserAgentsSupported, connectBrowserAgents, getBridge } from './agent-bridge';
import { tasks, type Task } from './agent-tasks';
import { useReducedMotion } from './hooks';

type Line = { id: number; kind: 'read' | 'note' | 'call' | 'ok' | 'stop'; text: string };

const marks: Record<Line['kind'], string> = { read: '◇', note: '#', call: '›', ok: '✓', stop: '✕' };

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function valueText(component: AgentComponent): string {
  const value = component.value ?? component.checked ?? component.pressed ?? component.open;
  return value === undefined || value === null ? '' : String(value);
}

const noSubscription = () => () => undefined;

/** A scripted agent that operates this page through the agent bridge: no clicks, no screenshots. */
export function AgentDesk() {
  const reduced = useReducedMotion();
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [rows, setRows] = useState<AgentComponent[]>([]);
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([]);
  const browserAgents = useSyncExternalStore(noSubscription, browserAgentsSupported, () => false);
  const deskRef = useRef<HTMLDivElement>(null);
  const tapeRef = useRef<HTMLOListElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    const readPage = () =>
      setRows(bridge.agent.snapshot().filter((item) => item.label && item.actions.length > 0));
    const first = setTimeout(readPage, 60);
    const timer = setInterval(readPage, 1500);
    const stopChanges = bridge.agent.subscribe(readPage);
    const stopHistory = bridge.history.subscribe(() => setEntries([...bridge.history.entries()]));
    const disconnect = connectBrowserAgents();
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      stopChanges();
      stopHistory();
      disconnect();
    };
  }, []);

  useEffect(() => {
    const tape = tapeRef.current;
    if (tape) tape.scrollTop = tape.scrollHeight;
  }, [lines]);

  const push = (kind: Line['kind'], text: string) =>
    setLines((current) => [...current.slice(-80), { id: nextId.current++, kind, text }]);

  const behavior = reduced ? 'auto' : 'smooth';

  /** Bring the control the agent is about to use into view, and light it up for a moment. */
  const reveal = async (focus: string) => {
    const bridge = getBridge();
    const target = bridge?.agent
      .snapshot()
      .find((item) => item.label?.toLowerCase().includes(focus.toLowerCase()));
    if (!target) return;
    try {
      const element = elementOf(target.ref);
      element.scrollIntoView({ behavior, block: 'center' });
      await pause(reduced ? 0 : 800);
      element.setAttribute('data-agent-focus', '');
      setTimeout(() => element.removeAttribute('data-agent-focus'), 1800);
    } catch {
      // The control is not on the page right now; the action will say so.
    }
  };

  const run = async (task: Task) => {
    const bridge = getBridge();
    if (!bridge || running) return;
    setRunning(task.id);
    try {
      push('read', `snapshot() → ${bridge.agent.snapshot().length} components`);
      let focused = '';
      for (const stage of task.stages) {
        push('note', stage.say);
        if (stage.focus !== focused) await reveal(stage.focus);
        focused = stage.focus;
        push('call', `act(${JSON.stringify({ steps: stage.steps })})`);
        const result = await bridge.agent.act({ steps: stage.steps });
        if (!result.ok) {
          const message = result.error?.message ?? 'The step was refused.';
          push('stop', message);
          notify('The agent stopped: this one needs a person', {
            description: 'It can read the button but not press it.',
            duration: 2600,
          });
          break;
        }
        // Keep the controls the step asked for; a playing replay also moves the playhead on its own.
        const asked = stage.steps.map((step) => step.ref.toLowerCase());
        const changes = result.steps
          .flatMap((step) => step.changes ?? [])
          .filter((change) => change.label && asked.includes(change.label.toLowerCase()));
        push(
          'ok',
          changes.length
            ? changes
                .map((c) => `${c.label ?? c.component} → ${JSON.stringify(c.value)}`)
                .join(', ')
            : 'done',
        );
        await pause(reduced ? 120 : (stage.wait ?? 500));
      }
    } finally {
      deskRef.current?.scrollIntoView({ behavior, block: 'center' });
      setRunning(null);
    }
  };

  const undo = async () => {
    const bridge = getBridge();
    if (!bridge || running) return;
    setRunning('undo');
    try {
      push('call', 'history.undoSource("agent")');
      const left = await bridge.history.undoSource('agent');
      push(
        left.length ? 'stop' : 'ok',
        left.length ? `${left.length} could not be put back` : 'Every agent change was put back.',
      );
    } finally {
      setRunning(null);
    }
  };

  const agentEntries = entries.filter((entry) => entry.source === 'agent');
  const canUndo = agentEntries.some((entry) => !entry.reverted);

  return (
    <div ref={deskRef} data-mk="desk" data-agent-hidden="">
      <div data-mk="desk-main">
        <Display label="Autopilot · scripted agent, no model" aspect="auto">
          <ol ref={tapeRef} data-mk="tape" aria-label="What the agent is doing" aria-live="polite">
            {lines.length === 0 && (
              <li data-kind="idle">
                <span aria-hidden="true">◇</span>
                <code>
                  Pick a task. The agent reads the page, then calls actions on its real controls.
                </code>
              </li>
            )}
            {lines.map((line) => (
              <li key={line.id} data-kind={line.kind}>
                <span aria-hidden="true">{marks[line.kind]}</span>
                <code>{line.text}</code>
              </li>
            ))}
          </ol>
        </Display>
        <div data-mk="tasks">
          {tasks.map((task) => (
            <Button
              key={task.id}
              tone="primary"
              disabled={running !== null}
              onClick={() => void run(task)}
            >
              {task.label}
            </Button>
          ))}
          <Button disabled={running !== null || !canUndo} onClick={() => void undo()}>
            Undo the agent
          </Button>
        </div>
      </div>

      <div data-mk="desk-side">
        <section data-mk="panel" aria-labelledby="seen-title">
          <h3 id="seen-title">
            <span>What an agent can read</span>
            <strong>{rows.length} controls</strong>
          </h3>
          <ul data-mk="seen">
            {rows.slice(0, 40).map((item) => (
              <li key={item.ref}>
                <span>{item.label}</span>
                <em>{item.component}</em>
                <code>{valueText(item)}</code>
              </li>
            ))}
          </ul>
        </section>

        <section data-mk="panel" aria-labelledby="ledger-title">
          <h3 id="ledger-title">
            <span>Changes made by agents</span>
            <strong>{agentEntries.length}</strong>
          </h3>
          <ol data-mk="ledger">
            {agentEntries.length === 0 && <li data-empty="">None yet.</li>}
            {agentEntries.slice(-4).map((entry) => (
              <li key={entry.id} data-reverted={entry.reverted ? '' : undefined}>
                {describeEntry(entry)}
              </li>
            ))}
          </ol>
        </section>

        <section data-mk="panel" data-tone="guard" aria-labelledby="guard-title">
          <h3 id="guard-title">
            <span>Needs a person</span>
          </h3>
          <p>
            Approving a failed change is marked as a human decision. An agent can see the button and
            why it is locked, but it cannot press it.{' '}
            {browserAgents
              ? 'This browser has an agent hook, so its own agent gets the same tools and the same rule.'
              : 'Browsers with an agent hook (WebMCP) get the same tools and the same rule.'}
          </p>
        </section>
      </div>
    </div>
  );
}
