# Architecture

Avero is split into a control plane and an execution plane. This page records what exists today and what is planned, so the two are never confused. The milestone checklist in [`AVERO.md`](../AVERO.md) is the source of truth for progress.

## Layers

| Layer           | Responsibility                                                                    | Status                                                                                   |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Control plane   | Authentication, workspaces, repository access, tasks, approvals, audit, dashboard | Workspaces and membership-based access exist. Everything else is planned.                |
| Execution plane | Cursor SDK coding sessions, Agent SDK workflows, tool execution, evaluations      | Prototypes exist for both SDKs and have not yet run against a live model.                |
| Worker          | Background jobs, retries, recovery, outbox                                        | A process with a health endpoint only. BullMQ queues and job processing are Milestone 3. |

The control plane and the execution plane meet through authenticated APIs and the worker. The two SDK runtimes do not share session state and are not coupled to each other.

## Applications

| Project                | Role                                                                                      | Depends on (workspace)                                         |
| ---------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `@avero/web`           | Next.js App Router application, workspace pages, `/api/v1/workspaces`, `/api/healthz`     | `config`, `contracts`, `db`, `observability`, `security`, `ui` |
| `@avero/worker`        | Node.js process with `/healthz`                                                           | `config`, `contracts`, `observability`                         |
| `@avero/agent-service` | Agent SDK project (`bot/`, `evals/`) with the `assess_change` tool and a smoke evaluation | `contracts`                                                    |

## Shared packages

| Package                | Owns                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| `@avero/contracts`     | Zod schemas and types shared across processes                         |
| `@avero/config`        | Typed environment parsing (worker port, Clerk settings)               |
| `@avero/db`            | Drizzle schema, migrations, workspace queries                         |
| `@avero/security`      | Workspace edit permission and secret redaction                        |
| `@avero/observability` | Structured JSON logging                                               |
| `@avero/coding-engine` | Cursor TypeScript SDK prototype (provider abstraction is Milestone 3) |
| `@avero/github`        | Repository slug validation (GitHub App integration is Milestone 4)    |
| `@avero/ui`            | Shared interface components and tokens                                |

Libraries publish compiled output from `dist/` through a single entry point. Nx builds dependencies first for builds, type checks and tests.

## Dependency rules

Rules live in [`eslint.config.mjs`](../eslint.config.mjs) and run with `nx lint`. Tags are declared in each package's `nx.tags`.

- Applications may depend only on `scope:shared` libraries. Shared libraries depend only on other shared libraries.
- Anything tagged `runtime:browser` may depend only on `runtime:browser` libraries. This keeps Node-only code (`db`, `coding-engine`, `security`, `config`, `observability`) out of browser bundles. The web app's `src/server/**` and `src/proxy.ts` are the only allow-listed exceptions.
- `type:ui` may not depend on `type:data-access`, `type:integration` or `runtime:node` libraries.
- `scope:agent` may depend only on `type:contract` libraries.
- Transitive dependencies are banned: a project must declare what it imports.
- Packages are imported through their public entry point. Subpath imports such as `@avero/contracts/dist/index.js` are rejected, except for `@avero/ui`, whose subpath layout is decided with the new design system.

## Data

PostgreSQL holds users, workspaces and workspace members today, with Drizzle migrations in `packages/db/drizzle`. Authorization is enforced in the query: reads are filtered by membership and renames require an owner or admin role in the same statement. Redis is provisioned for local development and used from Milestone 3 onward.

## Not built yet

Task API, BullMQ jobs, transactional outbox, event persistence and SSE, GitHub App, specialized agents, evaluations dashboard, OpenTelemetry, CI/CD. See Milestones 2 to 7 in [`AVERO.md`](../AVERO.md). Separate `database`, `security`, `api` and `deployment` pages will be written with the milestones that introduce them.
