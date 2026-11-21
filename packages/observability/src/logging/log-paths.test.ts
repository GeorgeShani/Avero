import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every `writeLog(...)` call in the repository, found in the source. A log line carries
 * identifiers, counts and short codes, so the names a call may use are a closed list: a new name
 * (say `prompt`, `error` or `output`) fails this test until someone decides it is safe to log.
 */
const allowedDetails = new Set([
  'attempt',
  'checked',
  'code',
  'concurrency',
  'count',
  'created',
  'denied',
  'host',
  'port',
  'requeued',
  'republished',
  'failed',
  'cancelled',
  'status',
  'taskId',
  'workspaceId',
]);

const root = join(import.meta.dirname, '..', '..', '..', '..');

function sources(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.next', '.nx', 'coverage'].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

type Call = { file: string; event: string; keys: string[]; spread: boolean };

function calls(): Call[] {
  const found: Call[] = [];
  for (const base of ['apps', 'packages']) {
    for (const file of sources(join(root, base))) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(
        /writeLog\(\s*'(?:info|error)'\s*,\s*([`'"])([^`'"]+)\1\s*(?:,\s*(\{[^}]*\}|\w+))?\s*\)/g,
      )) {
        const details = match[3] ?? '';
        found.push({
          file: relative(root, file).split(sep).join('/'),
          event: match[2] ?? '',
          keys: details.startsWith('{')
            ? [...details.matchAll(/(?:^|[{,]\s*)(\w+)\s*(?::|(?=[,}]))/g)].map(
                (key) => key[1] ?? '',
              )
            : [],
          spread: details !== '' && !details.startsWith('{'),
        });
      }
    }
  }
  return found.filter((call) => !call.file.includes('observability/src/logging/'));
}

describe('every writeLog call in the repository', () => {
  const all = calls();

  it('finds the calls (the scan itself works)', () => {
    expect(all.length).toBeGreaterThan(15);
    expect(all.some((call) => call.event === 'task.settled')).toBe(true);
  });

  it('logs only identifiers, counts and short codes', () => {
    const unknown = all.flatMap((call) =>
      call.keys
        .filter((key) => !allowedDetails.has(key))
        .map((key) => `${call.file}: ${call.event} logs "${key}"`),
    );
    expect(unknown).toEqual([]);
  });

  it('passes a plain object, so what is logged can be read at the call', () => {
    // `writeLog('info', 'recovery.settled', result)` passes a value of a known type; anything else
    // must be written out. The one allowed variable is the recovery result.
    const variables = all
      .filter((call) => call.spread)
      .map((call) => `${call.file}: ${call.event}`);
    expect(variables).toEqual(['apps/worker/src/recovery/loops.ts: recovery.settled']);
  });
});
