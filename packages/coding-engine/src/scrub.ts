/**
 * Replaces the workspace's absolute path with `<workspace>` in a record line, so a shared record
 * does not carry the name of a folder on someone's machine. It matches the path as written, with
 * forward slashes, and as it appears inside JSON (backslashes doubled).
 */
export function scrubWorkspacePath(line: string, cwd: string): string {
  const forms = [...new Set([cwd, cwd.replaceAll('\\', '/'), JSON.stringify(cwd).slice(1, -1)])]
    .filter((form) => form.length > 1)
    .sort((a, b) => b.length - a.length);
  return forms.reduce((text, form) => text.replaceAll(form, '<workspace>'), line);
}
