import { isAbsolute, relative, resolve } from 'node:path';

/**
 * Whether `target` is one of the allowed roots or inside one. Both are resolved first, so `..`
 * cannot climb out, and a sibling that merely starts with the same letters (`/work/demo-evil` next
 * to `/work/demo`) is not inside it. It does not look at the disk: a symbolic link inside a root
 * that points outside is the caller's to resolve with `realpath` first.
 */
export function pathWithinRoots(target: string, roots: readonly string[]): boolean {
  if (!isAbsolute(target)) return false;
  const resolved = resolve(target);
  return roots.some((root) => {
    if (!isAbsolute(root)) return false;
    const inside = relative(resolve(root), resolved);
    return inside === '' || (!inside.startsWith('..') && !isAbsolute(inside));
  });
}
