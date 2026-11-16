import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNx } from './run-command.mjs';

const applicationProjects = ['@avero/web', '@avero/worker', '@avero/agent-service'];
const requiredDependencies = {
  '@avero/web': [
    '@avero/config',
    '@avero/contracts',
    '@avero/db',
    '@avero/observability',
    '@avero/security',
    '@avero/ui',
  ],
  '@avero/worker': ['@avero/config', '@avero/contracts', '@avero/observability'],
  '@avero/agent-service': ['@avero/contracts'],
  '@avero/db': ['@avero/contracts', '@avero/security'],
  '@avero/security': ['@avero/contracts'],
};
const sharedProjects = [
  'coding-engine',
  'config',
  'contracts',
  'db',
  'github',
  'observability',
  'security',
  'ui',
].map((name) => `@avero/${name}`);

const graphFile = join(tmpdir(), `avero-nx-graph-${randomUUID()}.json`);
try {
  runNx(['graph', `--file=${graphFile}`]);
  const { graph } = JSON.parse(readFileSync(graphFile, 'utf8'));
  for (const name of [...applicationProjects, ...sharedProjects]) {
    const project = graph.nodes[name];
    assert(project, `Nx did not discover ${name}`);
    const { tags, targets } = project.data;
    assert(
      tags.includes(applicationProjects.includes(name) ? 'type:app' : 'scope:shared'),
      `Invalid project tags for ${name}`,
    );
    for (const target of ['build', 'lint', 'typecheck']) {
      assert(targets[target], `${name} has no ${target} target`);
    }

    const dependencies = new Set(graph.dependencies[name].map(({ target }) => target));
    for (const expected of requiredDependencies[name] ?? []) {
      assert(dependencies.has(expected), `Expected dependency ${name} → ${expected}`);
    }
    for (const app of applicationProjects) {
      assert(!dependencies.has(app), `Unexpected dependency ${name} → ${app}`);
    }
  }
  console.log('Nx discovered the expected projects, targets, and workspace dependencies.');
} finally {
  rmSync(graphFile, { force: true });
}
