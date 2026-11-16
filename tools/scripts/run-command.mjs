import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));

export function runCommand(executable, args, env = process.env) {
  const result = spawnSync(executable, args, { cwd: workspaceRoot, stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${executable} ${args.join(' ')} failed (${result.signal ?? result.status}).`);
  }
}

export function runNx(args) {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('nx/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const cli = resolve(dirname(manifestPath), manifest.bin.nx);
  runCommand(process.execPath, [cli, ...args], {
    ...process.env,
    NX_DAEMON: process.env.NX_DAEMON ?? 'false',
    NX_ISOLATE_PLUGINS: process.env.NX_ISOLATE_PLUGINS ?? 'false',
  });
}
