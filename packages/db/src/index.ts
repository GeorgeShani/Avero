import { z } from 'zod';

export const postgresUrlSchema = z.url({ protocol: /^postgres(?:ql)?$/ });

export { connectDatabase } from './client.ts';
export { createWorkspace, listWorkspaces, readWorkspace, renameWorkspace } from './workspaces.ts';
export {
  dbRunSource,
  saveBenchResult,
  saveBenchSuite,
  saveHillclimb,
  saveRun,
  type SavedRun,
} from './runs.ts';
export type { AveroDatabase } from './client.ts';
