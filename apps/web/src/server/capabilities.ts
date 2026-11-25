import 'server-only';

import { readRepositoryRoots } from '@avero/config';
import { githubSettings } from './github';
import { clerkSettings, databaseConfigured } from './workspaces';

/**
 * What this server has set up, as yes or no. Never a value: the console shows these to explain why
 * a page cannot work, and a secret must not travel with the explanation.
 */
export type Capabilities = {
  /** Clerk keys: people can sign in. */
  signIn: boolean;
  /** A PostgreSQL URL: workspaces, repositories, agents and tasks can be stored. */
  database: boolean;
  /** A Redis URL: tasks can be queued for the worker. */
  queue: boolean;
  /** The GitHub App's credentials: pull requests can be reviewed. */
  github: boolean;
  /** A Cursor key in this server's environment. A command run in a terminal reads its own. */
  cursorKey: boolean;
  /** Folders the worker may use, so a repository can be registered by path. */
  repositoryFolders: boolean;
};

export function serverCapabilities(env: NodeJS.ProcessEnv = process.env): Capabilities {
  return {
    signIn: clerkSettings() !== undefined,
    database: databaseConfigured(),
    queue: Boolean(env.REDIS_URL?.trim()),
    github: githubSettings() !== undefined,
    cursorKey: Boolean(env.CURSOR_API_KEY?.trim()),
    repositoryFolders: readRepositoryRoots(env).length > 0,
  };
}
