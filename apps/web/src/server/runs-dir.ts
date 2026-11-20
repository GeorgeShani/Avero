import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Where the viewer looks for run records: AVERO_RUNS_DIR if set, otherwise the first `.avero/runs`
 * it finds in the server's folder or the workspace root two levels up (the web app runs from
 * apps/web). When none exists yet it points at the first place a record would be written.
 */
export function resolveRunsDir(
  cwd: string = process.cwd(),
  env: Record<string, string | undefined> = process.env,
  exists: (path: string) => boolean = existsSync,
): string {
  const configured = env.AVERO_RUNS_DIR?.trim();
  if (configured) return resolve(configured);
  const here = join(cwd, '.avero', 'runs');
  const root = resolve(cwd, '..', '..', '.avero', 'runs');
  return [here, root].find((candidate) => exists(candidate)) ?? here;
}
