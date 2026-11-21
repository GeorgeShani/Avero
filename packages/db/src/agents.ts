import { agentSchema, type Agent, type AgentCreate } from '@avero/contracts';
import { and, asc, eq } from 'drizzle-orm';
import type { AveroDatabase } from './client.ts';
import { agents } from './schema/index.ts';

function toAgent(row: typeof agents.$inferSelect): Agent {
  return agentSchema.parse({
    id: row.id,
    name: row.name,
    model: row.model,
    rules: row.rules,
    createdAt: row.createdAt.toISOString(),
  });
}

/** Saves an agent definition. Throws when the workspace already has one with that name. */
export async function createAgent(
  db: AveroDatabase,
  workspaceId: string,
  input: AgentCreate,
): Promise<Agent> {
  const [row] = await db
    .insert(agents)
    .values({ workspaceId, name: input.name, model: input.model, rules: input.rules })
    .returning();
  if (!row) throw new Error('Could not save the agent.');
  return toAgent(row);
}

export async function listAgents(db: AveroDatabase, workspaceId: string): Promise<Agent[]> {
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId))
    .orderBy(asc(agents.name));
  return rows.map(toAgent);
}

/** Removes a definition. Tasks that used it keep running and keep their record of the model. */
export async function deleteAgent(
  db: AveroDatabase,
  workspaceId: string,
  agentId: string,
): Promise<boolean> {
  const rows = await db
    .delete(agents)
    .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)))
    .returning({ id: agents.id });
  return rows.length > 0;
}
