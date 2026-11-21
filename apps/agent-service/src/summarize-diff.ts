import { assessChange } from './assess-change.ts';
import { parseDiff } from './diff.ts';

export type DiffFlag = { path: string; kind: string; why: string };

const testFile =
  /(?:^|\/)(?:tests?|__tests__|e2e)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|_test\.(?:go|py)$/;

/** Things in a diff that a reviewer should look at on purpose, whatever the task was. */
function flagsFor(file: ReturnType<typeof parseDiff>['files'][number]): DiffFlag[] {
  const flags: DiffFlag[] = [];
  const name = file.path.split('/').at(-1) ?? '';
  if (/^\.env(?:\..+)?$/.test(name) && name !== '.env.example')
    flags.push({
      path: file.path,
      kind: 'environment file',
      why: 'Environment files hold secrets.',
    });
  if (/(?:^|\/)migrations?\//.test(file.path) || file.path.endsWith('.sql'))
    flags.push({
      path: file.path,
      kind: 'database migration',
      why: 'A migration changes stored data and cannot be undone by reverting the code.',
    });
  if (assessChange([file.path]).reviewPaths.length > 0)
    flags.push({
      path: file.path,
      kind: 'dependency or workflow',
      why: 'Dependencies and workflows run code with the project’s trust.',
    });
  if (file.status === 'deleted' && testFile.test(file.path))
    flags.push({ path: file.path, kind: 'test deleted', why: 'A deleted test removes a check.' });
  if (file.modeChanged)
    flags.push({ path: file.path, kind: 'permissions', why: 'The file’s mode changed.' });
  if (file.binary)
    flags.push({
      path: file.path,
      kind: 'binary file',
      why: 'A binary change cannot be read in a diff.',
    });
  return flags;
}

/** The shape of a change: which files, how much, and what deserves a person's eyes. */
export function summarizeDiff(diff: string) {
  const { files, truncated } = parseDiff(diff);
  return {
    files: files.map(({ path, status, added, removed, binary }) => ({
      path,
      status,
      added,
      removed,
      binary,
    })),
    totals: {
      files: files.length,
      added: files.reduce((sum, file) => sum + file.added, 0),
      removed: files.reduce((sum, file) => sum + file.removed, 0),
    },
    flags: files.flatMap(flagsFor),
    truncated,
  };
}
