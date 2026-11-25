/** The cookie that remembers which workspace the console is showing. */
export const workspaceCookie = 'avero-workspace';

/**
 * The workspace the console shows: the one remembered in the cookie if the person still belongs
 * to it, else their first. A cookie naming a workspace they cannot see is ignored, so it can never
 * widen what they are shown.
 */
export function pickWorkspace<T extends { id: string }>(
  workspaces: readonly T[],
  remembered: string | undefined,
): T | undefined {
  return workspaces.find((item) => item.id === remembered) ?? workspaces[0];
}
