// Runs the Avero command line from this repository: pnpm avero run "<task>"
// `console` starts the full Next.js console (decisions, bench pages) on your recorded runs instead:
//   pnpm avero console [--port 3000] [--runs-dir <dir>]. `serve` is the light read-only viewer.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { runNx, workspaceRoot } from './run-command.mjs';

const args = process.argv.slice(2);

if (args[0] === 'console') {
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
  const result = spawnSync(process.execPath, [`${workspaceRoot}apps/cli/dist/index.js`, ...args], {
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}
