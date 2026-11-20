/** A closed range of line numbers in the new version of a file, counting from 1. */
export type LineRange = { start: number; end: number };

export type FileDiff = {
  /** The path after the change, as git printed it. */
  path: string;
  /** The block of the unified diff that belongs to this file, header included. */
  text: string;
  isNew: boolean;
  isDeleted: boolean;
  /** Lines this change added, by their line numbers in the new file. Adjacent runs are merged. */
  added: LineRange[];
};

/** Git quotes a path that holds unusual characters: "a/caf\303\251.txt". */
function unquote(raw: string): string {
  if (!(raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2)) return raw;
  const bytes: number[] = [];
  const body = raw.slice(1, -1);
  const escapes: Record<string, string> = { t: '\t', n: '\n', r: '\r', '"': '"', '\\': '\\' };
  for (let index = 0; index < body.length; index += 1) {
    const char = body.charAt(index);
    if (char !== '\\') {
      bytes.push(...Buffer.from(char, 'utf8'));
      continue;
    }
    const octal = /^[0-7]{3}/.exec(body.slice(index + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      index += 3;
      continue;
    }
    const next = body.charAt(index + 1);
    bytes.push(...Buffer.from(escapes[next] ?? next, 'utf8'));
    index += 1;
  }
  return Buffer.from(bytes).toString('utf8');
}

function stripPrefix(path: string, prefix: 'a/' | 'b/'): string {
  return path.startsWith(prefix) ? path.slice(2) : path;
}

/** The path from a `diff --git` line, used only when the block has no `+++` line. */
function pathFromHeader(line: string): string {
  const rest = line.slice('diff --git '.length);
  if (rest.startsWith('"')) {
    const closing = rest.indexOf('" ', 1);
    const second = closing === -1 ? rest : rest.slice(closing + 2);
    return stripPrefix(unquote(second), 'b/');
  }
  // Without quotes, a path with spaces is ambiguous. The two sides name the same path unless the
  // file was renamed, so look for the split that makes them equal.
  for (let at = rest.indexOf(' b/'); at !== -1; at = rest.indexOf(' b/', at + 1)) {
    if (rest.slice(2, at) === rest.slice(at + 3)) return rest.slice(at + 3);
  }
  const last = rest.lastIndexOf(' b/');
  return last === -1 ? rest : rest.slice(last + 3);
}

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function mergeRanges(lines: number[]): LineRange[] {
  const ranges: LineRange[] = [];
  for (const line of lines) {
    const last = ranges.at(-1);
    if (last && line === last.end + 1) last.end = line;
    else ranges.push({ start: line, end: line });
  }
  return ranges;
}

function parseBlock(block: string[]): FileDiff {
  const header = block[0] ?? '';
  let path = '';
  let renamedTo: string | undefined;
  let isNew = false;
  let isDeleted = false;
  const added: number[] = [];
  let inHunk = false;
  let newLine = 0;

  for (const line of block.slice(1)) {
    if (!inHunk) {
      if (line.startsWith('new file mode')) isNew = true;
      else if (line.startsWith('deleted file mode')) isDeleted = true;
      else if (line.startsWith('rename to ')) renamedTo = unquote(line.slice('rename to '.length));
      else if (line.startsWith('+++ ')) {
        const target = unquote(line.slice(4).replace(/\t.*$/, ''));
        if (target === '/dev/null') isDeleted = true;
        else path = stripPrefix(target, 'b/');
      } else if (line.startsWith('--- ') && line.slice(4).startsWith('/dev/null')) isNew = true;
      const match = hunkHeader.exec(line);
      if (match) {
        inHunk = true;
        newLine = Number(match[1]);
      }
      continue;
    }
    const match = hunkHeader.exec(line);
    if (match) {
      newLine = Number(match[1]);
    } else if (line.startsWith('+')) {
      added.push(newLine);
      newLine += 1;
    } else if (line.startsWith('-') || line.startsWith('\\')) {
      // Removed lines and "\ No newline at end of file" do not exist in the new file.
    } else {
      newLine += 1;
    }
  }

  if (!path) path = renamedTo ?? pathFromHeader(header);
  return { path, text: block.join('\n'), isNew, isDeleted, added: mergeRanges(added) };
}

/** Splits a unified diff, as `git diff` prints it, into one entry per file. */
export function parseUnifiedDiff(patch: string | undefined): FileDiff[] {
  if (!patch) return [];
  const blocks: string[][] = [];
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) blocks.push([line]);
    else blocks.at(-1)?.push(line);
  }
  return blocks.map((block) => {
    const file = parseBlock(block);
    return { ...file, text: file.text.replace(/\n+$/, '') };
  });
}
