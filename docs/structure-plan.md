# Plan: reaching the target repository structure

Written 2026-11-21. The target is the tree in `AVERO.md` section 3.2. This plan says what the repository has today, what each target path needs, and the order to build it in.

## Progress

**S0 and S1 done 2026-11-21.** Checked with `pnpm check`, `pnpm format:check` and `pnpm verify:workspace`.

- **S0.** `.github/workflows/ci.yml` (written and read through, but not yet run on GitHub: the repository has no remote CI history). `docs/database.md`, `security.md`, `api.md` written from the code; `architecture.md` and `AVERO.md` 3.2 updated. `pnpm install --frozen-lockfile` was exiting 1 on two `@carbon/*` build scripts nobody had reviewed, which would have failed CI on its first step; both are now marked as not allowed in `pnpm-workspace.yaml`.
- **S1.**
  - `config`: `environment.ts` and `constants.ts`.
  - `observability`: `logging/`.
  - `security`: `permissions/`, `policies/` (redaction) and `approvals/`. The decision input check moved out of the web app into `approvals/decision.ts`; the web app keeps the run-id check and the file writes.
  - `contracts`: `events/` (run record), `agents/` (verdict, change assessment), `tasks/` (bench, hillclimb), `api/` (workspaces, health).
  - `coding-engine`: `adapters/` (the agent port), `cursor/` (SDK factory, smoke, CLI), `events/` (stream, coalesce, scrub), `sessions/` (recorder, limits, git changes, reviewer). The `cursor:*` scripts now run `dist/cursor/cli.js`.
  - `db`: `schema/` split by table and migrations moved to `src/migrations/`. `drizzle-kit generate` reports "No schema changes", so the split schema matches the committed migration exactly. Not applied to a live database in this session (none was available).
  - `ui`: `primitives/` (the vendored kit, renamed from `hardware/`), `styles/` and `components/`. The `@avero/ui/styles.css` export is unchanged.
- **Left for later steps, on purpose:** `riskFloor` and the other policy code stay in `contracts/agents/verdict.ts`, because `contracts` cannot depend on `security`; moving it needs a decision about where shared policy lives. `github`, `observability/{tracing,metrics}` and the worker and agent-service folders wait for the code that needs them.

**S2 and S3 done 2026-11-21**, with the deviations below. Checked with the full workspace check, including the database tests against a real PostgreSQL started with `pnpm infra:up`.

- **S2.**
  - Route groups renamed: `(platform)` to `(auth)`, `(console)` to `(dashboard)`. URLs are unchanged (route groups are not part of the URL).
  - Added `features/` (`runs`, `review`, `bench`, `console-shell`, `marketing`), `hooks/` (`use-reduced-motion`, `use-theme-mode`) and `lib/format.ts`. Three copies of the reduced-motion hook and two sets of formatters became one each.
  - The `RunSource` interface is in `@avero/contracts`; `fileRunSource` in `@avero/run-store` implements it; `server/run-source.ts` is the only place the web app chooses one. A lint rule rejects any other import of `@avero/run-store` in the web app (proved with a deliberate bad import). The decision action now takes a `RunSource` too.
  - Every console route was requested on a production build and answered 200 (404 for a missing run).
  - **Deviation:** the workspace pages stay in `(auth)` at `/workspaces`, not under `settings/workspaces`. They use the Clerk provider and the hardware skin; moving them means restyling them and putting the dashboard behind sign-in, which belongs with the cloud mode. **Deviation:** instead of one test per page, the seam is proved by the `fileRunSource` tests and the lint rule, because pages are server components that cannot be unit-tested without a framework harness we do not have.
- **S3.**
  - Migration `0001_runs_and_bench`: `runs` (summary columns plus the whole record), `verdicts`, `run_decisions`, `bench_suites`, `bench_results`, `hillclimbs`, all per workspace and deleted with it. Applied to the local Postgres; migration `0000` was applied from its new `src/migrations` path first.
  - `saveRun`, `saveBenchSuite`, `saveBenchResult`, `saveHillclimb` and `dbRunSource` in `@avero/db`. Records are validated before they are written and when they are read; a push of the same run replaces it.
  - 8 integration tests against the real database: newest-first listing with review state, **a workspace never sees another's runs**, replace on re-push, invalid input refused and nothing stored, decisions saved and replaced, **a decision in another workspace refused**, bench suites and results per workspace, and cascade delete. They run when `AVERO_TEST_DATABASE_URL` is set; CI now starts a Postgres service and sets it.
  - `canPushRuns` and `canDecideRuns` in `@avero/security`. `POST /api/v1/workspaces/{id}/runs` with the rules in `server/run-push.ts` (404 for a non-member, 403 for a viewer, 400 for bad input), covered by unit tests with injected storage.
  - **Not done, on purpose:** the `repositories`, `tasks` and `task_events` tables. Nothing reads them until the worker (S4) and GitHub (S5) exist, and an unused table is the empty scaffolding this plan rules out. **Not done:** the dashboard does not read the database yet (it needs sign-in, which needs Clerk keys, and a workspace picker); the CLI cannot push yet (no API tokens); the push route was tested with fakes, not through a signed-in Clerk session, because Clerk is not configured in this environment.
  - Also found and fixed: the bench suite page showed results oldest first (it reversed a list that was already newest first).

## 1. Rules for getting there

1. **No empty scaffolding.** A folder or file is created in the same change as the code that needs it, with a test. The target's own note says not to create configuration just to match the diagram, and this project has already paid for fake screens once (the simulated Tasks, Repositories, Agents, Evaluations and Activity pages were deleted). A folder that exists only to look finished is the same mistake.
2. **Moves first, features second.** Splitting a package into the target's subfolders is mechanical and safe behind the existing tests, so it goes first. New features follow, each landing in a folder that already exists.
3. **Barrels keep imports stable.** Every package keeps one `index.ts` that re-exports from the new subfolders, so a move does not touch callers. Moves use `git mv` so history follows.
4. **Nx decides its own files.** There is no `project.json` today: Nx 24 infers targets from `package.json` and the plugins, and that stays. Where the target lists `project.json`, the equivalent is the `nx` block in `package.json`.
5. **Every step ends green:** `pnpm check`, `pnpm format:check`, `pnpm verify:workspace`, and the boundary lint rules still enforced.

## 2. Where we are

What matches the target already: `apps/web`, `apps/worker`, `apps/agent-service`, and the packages `db`, `contracts`, `coding-engine`, `github`, `security`, `observability`, `config`, `ui`; `infra/` with both Dockerfiles and compose; `tools/scripts` and `tools/generators`; `eslint.config.mjs`, `nx.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `.env.example`.

What the target does not list but the repository has, because the product became a recorder and bench: `apps/cli`, `packages/run-store`, `packages/bench`, `packages/share`, `packages/mcp`. These stay. Section 3.2 of `AVERO.md` should be updated to include them (step S0).

The packages named in the target are mostly one file today:

| Package         | Today                                                             | Target subfolders                                                     |
| --------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `contracts`     | `run-record.ts`, `verdict.ts`, `bench.ts`, `hillclimb.ts`         | `tasks/`, `agents/`, `events/`, `api/`                                |
| `coding-engine` | 11 flat files (recorder, limits, review, agent port, git changes) | `cursor/`, `adapters/`, `sessions/`, `events/`                        |
| `github`        | one slug schema                                                   | `client/`, `installations/`, `webhooks/`, `pull-requests/`            |
| `security`      | role check and secret redaction                                   | `permissions/`, `policies/`, `approvals/`                             |
| `observability` | one log function                                                  | `logging/`, `tracing/`, `metrics/`                                    |
| `config`        | one file                                                          | `environment.ts`, `constants.ts`                                      |
| `db`            | `schema.ts`, `drizzle/` migrations                                | `schema/`, `migrations/`, `client.ts`                                 |
| `ui`            | `hardware/` kit, `avero.css`, `dark.css`, `components/`           | `components/`, `primitives/`, `styles/`                               |
| `worker`        | a health server                                                   | `queues/`, `processors/`, `orchestration/`, `lifecycle/`, `recovery/` |
| `agent-service` | `bot/agent.ts`, one tool, instructions, one eval                  | `skills/`, `subagents/`, `channels/`, `hooks/`, `mcp-connections/`    |

Missing entirely: `.github/workflows/ci.yml` and `deploy.yml`; `docs/database.md`, `security.md`, `api.md`, `deployment.md`; web `features/` and `hooks/`; any generator in `tools/generators`.

## 3. One decision the target forces

The target dashboard is the authenticated, database-backed team product. The console today is local and has no login: it reads run files from a folder. Both are wanted (local-first first, hosted second, over one record format), so the plan introduces **one seam**: a `RunSource` interface (`listRuns`, `readRun`, verdict and decision read and write, bench read) that the console's server code calls. `run-store` is the file implementation. A database implementation in `db` arrives with the cloud work, and the same pages serve both. Without this seam the dashboard would be rewritten, not extended. It is built in step S2.

Decisions for you, with my recommendation:

1. **Route names.** Target: `(auth)` and `(dashboard)` with `overview, repositories, tasks, agents, evaluations, activity, settings`. Today: `(platform)` and `(console)` with `overview, runs, review, bench, settings`. Recommendation: rename the groups, keep `runs`, `review` and `bench` as real routes, and add `repositories`, `tasks`, `agents`, `evaluations`, `activity` only when their backing exists (S5). `evaluations` then becomes the home for bench; `bench` redirects to it. If you would rather have the five missing routes now, they would be honest empty states, not mock data.
2. **Marketing group.** The target has none. Keep `(marketing)`; it is the landing page.
3. **Local mode stays.** Confirm the CLI, local viewer and file-based console remain supported after the cloud layer exists (this plan assumes yes).

## 4. Steps

Each step is a separate commit series. Sizes are rough working estimates, not promises.

### S0. Housekeeping and the missing files that need no new code (about half a day)

- `.github/workflows/ci.yml`: install, then `nx affected -t lint typecheck test build`, plus `verify:workspace`. Node 24, pnpm 12.21.0, Nx cache.
- `docs/database.md` (current schema, migrations, how to run them), `docs/security.md` (secret redaction, authorization, the sandbox and approval limits we already documented), `docs/api.md` (the `/api/v1/workspaces` contract and the MCP tools), `docs/architecture.md` refreshed. `docs/deployment.md` waits for S6.
- Update `AVERO.md` 3.2 with the packages the target does not list.
- Done when: CI is green on a pull request and the docs describe what exists, not what is planned.

### S1. Split the packages into the target subfolders (about 2 days)

Mechanical, one package per commit, in this order (smallest risk first):

1. `config`: `environment.ts` (env reading) and `constants.ts`.
2. `observability`: `logging/` (the existing log function). `tracing/` and `metrics/` are created in S6, when OpenTelemetry is wired.
3. `security`: `permissions/` (role checks), and the redaction moves to `policies/`. `approvals/` receives the decision logic that now lives in `apps/web/src/server/decisions.ts` (validate, record, read-only guard).
4. `contracts`: `events/` ← `run-record.ts`; `agents/` ← `verdict.ts`; `tasks/` ← `bench.ts` and `hillclimb.ts`; `api/` ← the workspace API schemas now in `apps/web/src/server/workspace-api.ts`.
5. `coding-engine`: `cursor/` ← agent port implementation and smoke; `adapters/` ← the `AgentLike` port; `sessions/` ← recorder, limits, review; `events/` ← stream-event, coalesce, scrub.
6. `db`: `schema.ts` into `schema/` (users, workspaces, members); `drizzle/` to `src/migrations/` with `drizzle.config.ts` pointed at it, and the existing migration checked to apply unchanged.
7. `ui`: `styles/` ← `hardware.css`, `avero.css`, `dark.css`; `primitives/` ← the kit's `hardware/ui`; `components/` ← brand and status.

- Not created yet: `github/{client,installations,webhooks,pull-requests}` (S5), `tracing`, `metrics`.
- Done when: all imports go through the package barrels, no test changed except paths, `pnpm check` is green.

### S2. Restructure the web app and add the seam (about 2 days)

- Rename groups: `(platform)` to `(auth)` for sign-in and sign-up; `(console)` to `(dashboard)`; the workspace pages move under `(dashboard)/settings/workspaces` (they need auth, which the dashboard will require in cloud mode and skip in local mode).
- Create `features/` and move code into it: `features/runs` (replay, run table, stats), `features/review` (verdict panel, queue), `features/bench`, `features/workspaces`, `features/console-shell`. Create `hooks/` with the shared ones that exist (theme, reduced motion) and `lib/` (theme, boot, format). `components/` keeps only what is shared and generic.
- Introduce the `RunSource` interface in `run-store`, with the file implementation, and make the pages call it through `apps/web/src/server`.
- Done when: the console behaves exactly as before, one new test per page proves it reads through the interface.

### S3. Platform data and the task model (about 1 week; needs PostgreSQL provisioned and Clerk configured)

Prerequisites from you: a Postgres instance and Clerk keys (two unchecked Milestone 2 boxes).

- `db/schema/`: `repositories`, `tasks`, `task_events`, `runs` (synced run records), `verdicts`, `decisions`, `bench_results`. Migrations for each, with constraint tests.
- `contracts/tasks`, `contracts/api`: task, repository and event schemas, and `/api/v1/tasks` request and response shapes.
- A database `RunSource`.
- Done when: a run record pushed through the API appears in the dashboard for the right workspace and not for another.

### S4. Worker: queue, lifecycle, recovery (about 1 week; needs Redis, already in compose)

- `worker/queues` (BullMQ queue definitions), `processors` (run a task through `coding-engine` and write events), `lifecycle` (task states and legal transitions, with a test table of every transition), `orchestration` (plan, run, review, open PR as one flow with the plan gate and caps we already have), `recovery` (on start, find tasks stuck in running and mark or retry them). `main.ts` wires them and keeps the health endpoint.
- API: task creation with a transactional outbox, cancellation, SSE event stream. Web: `tasks` route.
- Done when: a task launched from the dashboard runs, can be cancelled, and survives a worker restart mid-run.

### S5. GitHub, agents and the remaining dashboard routes (about 2 weeks; needs a GitHub App)

- `github/client`, `installations`, `webhooks` (signature check and delivery de-duplication), `pull-requests`. Routes `repositories` and `activity`.
- `agent-service`: `skills/` (PR review, issue triage, security review as skills), `subagents/` (the reviewer as a subagent), `hooks/` (the approval hook, which finally enforces what `request_approval` only advises today), `mcp-connections/` (Avero's own MCP server), `channels/` (Slack, last). Route `agents` shows and edits agent definitions (the bench's hillclimb output feeds this).
- `evaluations` route over the stored bench results; `bench` redirects to it.
- Done when: a webhook for a pull request produces a review verdict in the dashboard, and an approval hook stops a risky action in a real run.

### S6. Observability, deployment and release (about 1 week)

- `observability/tracing` and `metrics` with OpenTelemetry; secret-redaction test over every log path.
- `.github/workflows/deploy.yml`, `docs/deployment.md`, images for web, worker and agent-service (a third Dockerfile is needed for the last), production data services.
- Done when: a tagged release deploys all three apps from CI and the recovery scenarios have tests.

### S7. Generator (any time after S1)

Twelve packages share the same `package.json`, tsconfigs, vitest config and boundary tags. One Nx generator in `tools/generators` that creates a package from them removes the copying and guarantees the tags. Build it once the structure has settled, not before.

## 5. Order and dependencies

```text
S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6
              \-> S7 (after S1)
```

S0 to S2 need nothing from you and can start now. S3 needs Postgres and Clerk keys. S4 needs Redis (already local). S5 needs a GitHub App. S6 needs a hosting choice.

## 6. Risks

- **Large moves hide bugs.** One package per commit, `pnpm check` after each, no behavior change in a move commit.
- **The database migration move (S1.6)** can break `drizzle-kit` paths. It is checked by applying migration 0000 to a clean database before and after.
- **The seam can leak.** Pages must call `RunSource`, never `run-store` directly; a lint rule (`no-restricted-imports` on `@avero/run-store` from `app/`) enforces it after S2.
- **Scope.** S3 to S6 are the cloud product, about five weeks of focused work. S0 to S2 are about four days and leave a repository that has the target's shape for everything that already exists.
