import 'server-only';
import type { RunSource } from '@avero/contracts';
import { dbRunSource } from '@avero/db';
import { fileRunSource } from '@avero/run-store';
import { resolveRunsDir } from './runs-dir';
import { database } from './workspaces';

/**
 * The one place the console decides where its data comes from. Pages and server actions call this
 * (the folder of run files on this machine) or `workspaceRunSource` (a hosted workspace's runs in
 * the database) and nothing else.
 */
export function runSource(): RunSource {
  return fileRunSource(resolveRunsDir());
}

/**
 * The runs of one workspace. The caller has already checked that the person belongs to it, and
 * passes who is deciding when the source will be used to record a decision.
 */
export function workspaceRunSource(
  workspace: { id: string; name: string },
  decidedBy?: { clerkUserId: string },
): RunSource {
  return dbRunSource(database(), workspace, decidedBy ? { decidedBy } : {});
}
