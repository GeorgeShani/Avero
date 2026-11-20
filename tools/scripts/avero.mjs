// Runs the Avero command line from this repository: pnpm avero run "<task>"
// `serve` starts the web viewer on your recorded runs instead: pnpm avero serve [--port 3000]
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { runNx, workspaceRoot } from './run-command.mjs';

const args = process.argv.slice(2);

if (args[0] === 'serve') {
  const { values } = parseArgs({
    args: args.slice(1),
    options: { port: { type: 'string' }, 'runs-dir': { type: 'string' } },
  });
  const runsDir = resolve(values['runs-dir'] ?? '.avero/runs');
  const port = values.port ?? '3000';
  console.log(`Avero viewer on http://localhost:${port}\nReading runs from ${runsDir}\n`);
  runNx(['run', '@avero/web:dev'], { AVERO_RUNS_DIR: runsDir, PORT: port });
} else {
  runNx(['build', '@avero/cli', '--output-style=static', '--skipNxCache=false']);
  const result = spawnSync(process.execPath, [`${workspaceRoot}apps/cli/dist/cli.js`, ...args], {
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}
