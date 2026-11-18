'use client';

import {
  Alert,
  Button,
  Card,
  ModeDial,
  notify,
  Select,
  SlideSwitch,
  Stepper,
  Switch,
  Textarea,
  TextField,
} from '@avero/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSim } from '../lib/sim/provider';
import type { Effort } from '../lib/sim/store';

const repositories = [
  { value: 'sample/web', label: 'sample/web' },
  { value: 'sample/worker', label: 'sample/worker' },
  { value: 'sample/db', label: 'sample/db' },
  { value: 'sample/github', label: 'sample/github' },
];

const agents = [
  { value: 'Engineering Coordinator', label: 'Coordinator' },
  { value: 'Pull Request Reviewer', label: 'PR reviewer' },
  { value: 'Testing Agent', label: 'Testing' },
  { value: 'Documentation Agent', label: 'Docs' },
];

const efforts: Effort[] = ['low', 'medium', 'high', 'max'];

export function TaskComposer() {
  const router = useRouter();
  const { launch } = useSim();
  const [title, setTitle] = useState('');
  const [repo, setRepo] = useState(repositories[0]!.value);
  const [agent, setAgent] = useState(agents[0]!.value);
  const [mode, setMode] = useState<'Cloud' | 'Local'>('Cloud');
  const [effort, setEffort] = useState<Effort>('medium');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    if (title.trim().length < 3) {
      setProblem('Describe the task in at least three characters.');
      return;
    }
    setProblem(null);
    const id = launch({ title: title.trim(), repo, agent, mode, effort });
    notify('Simulated task launched', { description: title.trim(), duration: 2500 });
    router.push(`/tasks/${id}`);
  };

  return (
    <div data-columns>
      <Card title="Describe the work" description="Start with the outcome you want.">
        <div data-stack>
          <TextField
            label="Task"
            value={title}
            onValueChange={setTitle}
            placeholder="Retry failed webhook deliveries"
          />
          <Textarea label="Details" placeholder="Anything the agent must not touch" />
          <Select
            label="Repository"
            options={repositories}
            defaultValue={repo}
            onValueChange={setRepo}
          />
          {problem && (
            <Alert tone="danger" title="Check the task">
              {problem}
            </Alert>
          )}
        </div>
      </Card>
      <Card
        title="Configure the run"
        description="Launching starts a simulated run. No agent executes yet."
        footer={
          <div data-row>
            <Button tone="primary" onClick={submit}>
              Launch task
            </Button>
            <Button onClick={() => router.push('/tasks')}>Cancel</Button>
          </div>
        }
      >
        <div data-stack>
          <ModeDial
            label="Effort"
            options={efforts.map((value) => ({ value, label: value }))}
            value={effort}
            onValueChange={(value) => setEffort(value as Effort)}
          />
          <SlideSwitch
            label="Where"
            options={['Cloud', 'Local']}
            value={mode}
            onValueChange={(value) => setMode(value as 'Cloud' | 'Local')}
          />
          <Select label="Agent" options={agents} defaultValue={agent} onValueChange={setAgent} />
          <Stepper label="Time limit, minutes" defaultValue={30} min={1} max={240} />
          <Switch label="Ask before opening a pull request" defaultChecked />
        </div>
      </Card>
    </div>
  );
}
