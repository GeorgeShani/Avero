# Database

PostgreSQL holds the platform data. It is used by the workspace feature only. The recorder, the bench and the local console do not need it: they read and write files (see [sharing](sharing.md) and [bench](bench.md)).

## Today

Tables, defined per file in [`packages/db/src/schema/`](../packages/db/src/schema) with Drizzle.

**Accounts** (migration `0000`):

| Table               | Holds                                                      | Constraints worth knowing                                                                                 |
| ------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `users`             | One row per Clerk user (`clerk_user_id`, email)            | `clerk_user_id` is unique                                                                                 |
| `workspaces`        | A workspace: `name`, `slug`, `owner_id`                    | `slug` is unique; name is 1 to 80 characters and slug 1 to 63, enforced by `CHECK`; index on `owner_id`   |
| `workspace_members` | Membership and role (`owner`, `admin`, `member`, `viewer`) | One row per workspace and user (unique); deleting a workspace deletes its memberships; index on `user_id` |

**Runs and bench** (migration `0001`). Everything here belongs to a workspace and is deleted with it.

| Table           | Holds                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `runs`          | A pushed run: summary columns for lists and totals, plus the whole JSONL record (`record_jsonl`). Unique per `(workspace_id, run_id)`. |
| `verdicts`      | The reviewer's verdict for a run (risk tier and failed-check count as columns, the verdict itself as validated `jsonb`). One per run.  |
| `run_decisions` | A person's decision on a run, with who made it. One per run; a later decision replaces it.                                             |
| `bench_suites`  | A bench suite as a validated `jsonb` document. Unique per `(workspace_id, slug)`.                                                      |
| `bench_results` | One matrix run of a suite. Unique per suite and result id.                                                                             |
| `hillclimbs`    | One hillclimb over a suite's rules. Unique per suite and hillclimb id.                                                                 |

The record, verdict, decision and bench documents are checked against their Zod schemas in `@avero/contracts` before they are written and again when they are read, so the database can never hand a page something the page cannot render.

Authorization lives in the query, not above it: workspace reads are filtered by membership, and a rename requires an owner or admin role in the same statement (`packages/db/src/workspaces.ts`, using `workspaceEditors` from `@avero/security`). The run source (`dbRunSource` in `packages/db/src/runs.ts`) filters every query by workspace id, so one workspace never sees another's runs; the integration tests prove it against a real Postgres, including deciding on a run in someone else's workspace. The role list comes from `@avero/contracts`, so the enum and the API agree.

## Migrations

Drizzle Kit generates SQL migrations from the schema into `packages/db/src/migrations/` (`0000_platform.sql` for accounts, `0001_runs_and_bench.sql` for runs and bench, each with its snapshot in `meta/`). Never edit an applied migration; generate a new one.

```shell
pnpm exec nx run @avero/db:db:generate -- --name=what_changed   # writes a migration from schema changes
pnpm exec nx run @avero/db:db:migrate    # applies pending migrations to DATABASE_URL
```

`DATABASE_URL` is read from the root `.env` (see `.env.example` for a local URL). Start the local server with `pnpm infra:up`, which also starts Redis.

## Tests

Most database tests run against a real PostgreSQL, not a fake. Set `AVERO_TEST_DATABASE_URL` and they run; leave it unset and they are skipped. Locally:

```shell
pnpm infra:up
export AVERO_TEST_DATABASE_URL=postgresql://avero:avero-local@127.0.0.1:55432/avero
pnpm exec nx run @avero/db:db:migrate   # with DATABASE_URL set to the same URL
pnpm exec nx test @avero/db
```

CI starts a Postgres service, applies the migrations and sets the variable. Each test creates its own workspaces with random identities and deletes them afterwards.

**Tasks** (migration `0002_tasks_and_outbox`). Everything belongs to a workspace and is deleted with it.

| Table          | Holds                                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repositories` | Where a task can run: a `local` folder on the worker's machine (`path`, never sent to a browser) or a `github` repository (`github_full_name`, linked to an installation). Names are unique per workspace; so are GitHub repositories.                |
| `tasks`        | A job for an agent: prompt, model, optional `review`, limits, `status`, `attempt`, the `run_id` it produced, the error if it failed, and `source` (the pull request that started it, if one did). Statuses are the lifecycle in `@avero/contracts`.   |
| `task_events`  | The run events of a task as they happen, `(task_id, seq)` unique. The dashboard follows them over server-sent events. Cleared when a task is started again.                                                                                           |
| `task_outbox`  | One row per "please queue this task", written in the same transaction as the task. The worker reads unpublished rows with `FOR UPDATE SKIP LOCKED`, puts them on the queue and marks them published, so a task is queued if and only if it was saved. |

**GitHub** (migration `0003_github`):

| Table                  | Holds                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `github_installations` | A GitHub App installation, attached to exactly one workspace (`installation_id` is unique), with `active` or `suspended`. |
| `webhook_deliveries`   | GitHub's delivery id of every accepted webhook, so a redelivery is recognised and ignored.                                |

**Agents** (migration `0004_agents`): `agents` holds a named setup per workspace (`name` unique per workspace, `model`, and `rules` up to 6000 characters). A task may name one (`tasks.agent_id`); deleting the agent keeps the task and sets the column to null.

Task authorization is in the query too: every task, repository and agent read or write is filtered by workspace id, and creating a task checks in the same transaction that the repository, and the agent if one is named, belong to that workspace.

The dashboard's tasks, repositories, agents and activity pages read these tables, and need sign-in. The runs, review and evaluations pages still read files, through the same `RunSource` interface the database implements.
