/** One file of a unified diff, with what was added to it and with what the diff says about it. */
export type DiffFile = {
  path: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  added: number;
  removed: number;
  binary: boolean;
  /** True when the file's mode (permissions) changed. */
  modeChanged: boolean;
  /** The added lines, with their line numbers in the new file. */
  addedLines: { line: number; text: string }[];
};

/** Longest diff the tools read. Anything longer is cut, and the caller is told so. */
export const maxDiffChars = 400_000;

/**
 * Reads a `git diff` (unified format). Tolerant on purpose: unknown lines are skipped, so a diff
 * with extra headers (a commit message, a stat) still parses.
 */
export function parseDiff(text: string): { files: DiffFile[]; truncated: boolean } {
  const truncated = text.length > maxDiffChars;
  const lines = (truncated ? text.slice(0, maxDiffChars) : text).split('\n');
  const files: DiffFile[] = [];
  let file: DiffFile | undefined;
  let next = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      file = {
        path: match?.[2] ?? line.slice('diff --git '.length),
        status: 'modified',
        added: 0,
        removed: 0,
        binary: false,
        modeChanged: false,
        addedLines: [],
      };
      files.push(file);
      continue;
    }
    if (!file) continue;
    if (line.startsWith('new file mode')) file.status = 'added';
    else if (line.startsWith('deleted file mode')) file.status = 'deleted';
    else if (line.startsWith('rename to ')) file.status = 'renamed';
    else if (line.startsWith('old mode ') || line.startsWith('new mode ')) file.modeChanged = true;
    else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch'))
      file.binary = true;
    else if (line.startsWith('@@')) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
      next = match ? Number(match[1]) : 0;
    } else if (line.startsWith('+++') || line.startsWith('---')) continue;
    else if (line.startsWith('+')) {
      file.added += 1;
      file.addedLines.push({ line: next, text: line.slice(1) });
      next += 1;
    } else if (line.startsWith('-')) file.removed += 1;
    else if (line.startsWith(' ')) next += 1;
  }
  return { files, truncated };
}
