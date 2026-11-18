'use client';

import {
  Alert,
  BarGraph,
  Button,
  Card,
  Feed,
  ItemList,
  Meter,
  onSoundChange,
  setSoundEnabled,
  soundEnabled,
  Switch,
} from '@avero/ui';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { useSim } from '../lib/sim/provider';
import { eventTime } from '../lib/sim/store';

export function RepositoriesView() {
  const { state } = useSim();
  const repos = ['sample/web', 'sample/worker', 'sample/db', 'sample/github'].map((name) => ({
    name,
    tasks: state.tasks.filter((task) => task.repo === name).length,
    connection: name === 'sample/db' ? 'Needs reauthorization' : 'Connected',
  }));
  const [chosen, setChosen] = useState(repos[0]!.name);
  return (
    <div data-stack>
      <Alert tone="warning" title="GitHub is not connected yet">
        The GitHub App arrives with Milestone 4. These repositories are simulated.
      </Alert>
      <Card title="Repositories">
        <ItemList
          label="Repositories"
          rows={repos}
          rowKey={(row) => row.name}
          value={chosen}
          onValueChange={setChosen}
          columns={[
            {
              key: 'name',
              label: 'Repository',
              width: 'minmax(0, 1fr)',
              render: (row) => row.name,
            },
            {
              key: 'connection',
              label: 'Connection',
              width: '170px',
              render: (row) => row.connection,
            },
            {
              key: 'tasks',
              label: 'Tasks',
              width: '48px',
              align: 'end',
              render: (row) => row.tasks,
            },
          ]}
        />
      </Card>
    </div>
  );
}

const agentList = [
  {
    name: 'Engineering Coordinator',
    role: 'Coordinates engineering workflows',
    tools: 'assess_change, create_task',
  },
  {
    name: 'Pull Request Reviewer',
    role: 'Analyzes changes and reports findings',
    tools: 'assess_change',
  },
  { name: 'Security Reviewer', role: 'Investigates insecure patterns', tools: 'assess_change' },
];

export function AgentsView() {
  const [chosen, setChosen] = useState(agentList[0]!.name);
  const agent = agentList.find((item) => item.name === chosen) ?? agentList[0]!;
  return (
    <div data-columns>
      <Card title="Agent definitions" description="Only the assess_change tool exists today.">
        <ItemList
          label="Agents"
          rows={agentList}
          rowKey={(row) => row.name}
          value={chosen}
          onValueChange={setChosen}
          columns={[
            { key: 'name', label: 'Agent', width: 'minmax(0, 1fr)', render: (row) => row.name },
            { key: 'tools', label: 'Tools', width: 'minmax(0, 1fr)', render: (row) => row.tools },
          ]}
        />
      </Card>
      <Card title={agent.name} description={agent.role}>
        <dl data-defs>
          <dt>Tools</dt>
          <dd>{agent.tools}</dd>
          <dt>Version</dt>
          <dd>0.1.0</dd>
          <dt>Status</dt>
          <dd>defined, not deployed</dd>
        </dl>
      </Card>
    </div>
  );
}

export function EvaluationsView() {
  const [scores, setScores] = useState([0.8, 0.83, 0.78, 0.9, 0.86, 0.83]);
  return (
    <div data-stack>
      <Alert tone="warning" title="No evaluation has run against a live model">
        Suites exist in the agent service but have never run live. Re-run below to see how results
        will read; the numbers are simulated.
      </Alert>
      <Card
        title="review suite"
        description="12 cases, simulated"
        action={
          <Button
            onClick={() =>
              setScores((values) =>
                values.map((value) =>
                  Math.min(1, Math.max(0.4, value + (Math.random() - 0.5) * 0.2)),
                ),
              )
            }
          >
            Re-run
          </Button>
        }
      >
        <div data-stack>
          <BarGraph label="Score across the last 6 runs" values={scores} />
          <Meter label="Latest score" value={Math.round((scores.at(-1) ?? 0) * 100)} />
        </div>
      </Card>
    </div>
  );
}

export function ActivityView() {
  const { state } = useSim();
  const items = state.tasks
    .flatMap((task) => task.events.map((event) => ({ task, event })))
    .sort((a, b) => b.event.tick - a.event.tick)
    .slice(0, 12)
    .map(({ task, event }) => ({
      who: task.agent,
      what: `${event.text} (${task.id})`,
      when: eventTime(event),
    }));
  return (
    <Card title="Recent events" description="Simulated run events, newest first">
      <Feed items={items} />
    </Card>
  );
}

export function SettingsView() {
  const sound = useSyncExternalStore(
    (notify) => onSoundChange(notify),
    soundEnabled,
    () => false,
  );
  return (
    <div data-columns>
      <Card title="Interface" description="Saved in this browser.">
        <div data-stack>
          <Switch
            label="Key sounds"
            defaultChecked={sound}
            key={String(sound)}
            onCheckedChange={(on) => setSoundEnabled(on)}
          />
        </div>
      </Card>
      <Card title="Workspaces" description="Real data">
        <Link data-kit="button" data-tone="primary" href="/workspaces">
          Open workspaces
        </Link>
      </Card>
    </div>
  );
}
