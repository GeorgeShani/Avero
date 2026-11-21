import { z } from 'zod';

export const postgresUrlSchema = z.url({ protocol: /^postgres(?:ql)?$/ });

export { connectDatabase } from './client.ts';
export { createWorkspace, listWorkspaces, readWorkspace, renameWorkspace } from './workspaces.ts';
export {
  addGithubRepositories,
  detachGithubRepositories,
  findGithubRepository,
  findInstallation,
  hasReviewFor,
  linkInstallation,
  recordDelivery,
  repositoryAccess,
  setInstallationStatus,
  syncGithubRepositories,
  type InstallationRow,
  type RepositoryAccess,
} from './github.ts';
export { createAgent, deleteAgent, listAgents } from './agents.ts';
export {
  dbRunSource,
  saveBenchResult,
  saveBenchSuite,
  saveHillclimb,
  saveRun,
  type SavedRun,
} from './runs.ts';
export {
  addLocalRepository,
  appendTaskEvents,
  claimTask,
  clearTaskEvents,
  createTask,
  finishTask,
  getTask,
  heartbeat,
  listRepositories,
  listTaskEvents,
  listTasks,
  publishOutbox,
  recoverStaleTasks,
  repositoryFolder,
  requestCancel,
  type ClaimedTask,
  type Recovery,
} from './tasks.ts';
export type { AveroDatabase } from './client.ts';
