import { workspaceRoles } from '@avero/contracts';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { postgresUrlSchema } from './index.ts';
import { users, workspaceMembers, workspaceRole, workspaces } from './schema/index.ts';

describe('postgresUrlSchema', () => {
  it.each(['postgres://u:p@localhost:5432/avero', 'postgresql://u:p@db.internal/avero'])(
    'accepts %s',
    (url) => {
      expect(postgresUrlSchema.safeParse(url).success).toBe(true);
    },
  );

  it.each(['', 'localhost:5432', 'mysql://u:p@localhost/avero', 'http://localhost/avero'])(
    'rejects %j',
    (url) => {
      expect(postgresUrlSchema.safeParse(url).success).toBe(false);
    },
  );
});

describe('workspace schema', () => {
  it('stores the same roles the contracts allow', () => {
    expect(workspaceRole.enumValues).toEqual([...workspaceRoles]);
  });

  it('makes Clerk user ids and workspace slugs unique', () => {
    const columns = (table: Parameters<typeof getTableConfig>[0]) =>
      Object.fromEntries(getTableConfig(table).columns.map((column) => [column.name, column]));

    expect(columns(users)['clerk_user_id']?.isUnique).toBe(true);
    expect(columns(workspaces)['slug']?.isUnique).toBe(true);
  });

  it('allows one membership per user per workspace', () => {
    const { uniqueConstraints } = getTableConfig(workspaceMembers);
    expect(uniqueConstraints.map((constraint) => constraint.name)).toContain(
      'workspace_members_workspace_user_unique',
    );
  });

  it('constrains workspace name and slug length in the database', () => {
    const { checks } = getTableConfig(workspaces);
    expect(checks.map((check) => check.name).sort()).toEqual([
      'workspaces_name_length',
      'workspaces_slug_length',
    ]);
  });

  it('deletes memberships when a workspace is deleted', () => {
    const { foreignKeys } = getTableConfig(workspaceMembers);
    const toWorkspace = foreignKeys.find(
      (key) => getTableConfig(key.reference().foreignTable).name === 'workspaces',
    );
    expect(toWorkspace?.onDelete).toBe('cascade');
  });
});
