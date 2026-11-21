# Database

PostgreSQL holds the platform data. It is used by the workspace feature only. The recorder, the bench and the local console do not need it: they read and write files (see [sharing](sharing.md) and [bench](bench.md)).

## Today

Three tables, defined in [`packages/db/src/schema/`](../packages/db/src/schema) with Drizzle:

| Table               | Holds                                                      | Constraints worth knowing                                                                                 |
| ------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `users`             | One row per Clerk user (`clerk_user_id`, email)            | `clerk_user_id` is unique                                                                                 |
| `workspaces`        | A workspace: `name`, `slug`, `owner_id`                    | `slug` is unique; name is 1 to 80 characters and slug 1 to 63, enforced by `CHECK`; index on `owner_id`   |
| `workspace_members` | Membership and role (`owner`, `admin`, `member`, `viewer`) | One row per workspace and user (unique); deleting a workspace deletes its memberships; index on `user_id` |

Authorization lives in the query, not above it: reads are filtered by membership, and a rename requires an owner or admin role in the same statement (`packages/db/src/workspaces.ts`, using `workspaceEditors` from `@avero/security`). The role list comes from `@avero/contracts`, so the enum and the API agree.

## Migrations

Drizzle Kit generates SQL migrations from the schema into `packages/db/src/migrations/` (one so far, `0000_platform.sql`, with its snapshot and journal). Never edit an applied migration; generate a new one.

```shell
pnpm exec nx run @avero/db:db:generate   # writes a new migration from schema changes
pnpm exec nx run @avero/db:db:migrate    # applies pending migrations to DATABASE_URL
```

`DATABASE_URL` is read from the root `.env` (see `.env.example` for a local URL). Start the local server with `pnpm infra:up`, which also starts Redis.

## Not built yet

Tables for repositories, tasks, task events, synced runs, verdicts, decisions and bench results arrive with the cloud work (steps S3 to S5 of [structure-plan.md](structure-plan.md)). Until then there is nothing in the database about runs, and this page says so on purpose.
