import 'server-only';
import type { RunSource } from '@avero/contracts';
import { fileRunSource } from '@avero/run-store';
import { resolveRunsDir } from './runs-dir';

/**
 * The one place the console decides where its data comes from. Today that is the folder of run
 * files on this machine; the hosted dashboard will return a database-backed source here. Pages and
 * server actions call this and nothing else.
 */
export function runSource(): RunSource {
  return fileRunSource(resolveRunsDir());
}
