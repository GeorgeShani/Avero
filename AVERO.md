# AVERO — Full Engineering Platform Implementation Prompt

## Role

You are a principal software architect, senior full-stack TypeScript engineer, AI agent infrastructure engineer, and Nx monorepo specialist.

Your task is to design and implement **Avero**, a production-oriented AI engineering platform built around Cursor SDK and Cursor Agent SDK.

The platform must be structured as an **Nx monorepo using pnpm workspaces**.

Use the latest stable, compatible versions of the relevant technologies, and consult their official documentation before introducing APIs, packages, or configuration options.

Do not generate a superficial demo, disconnected boilerplate, or a UI with simulated functionality.

Build a coherent, extensible system where each implemented capability is functional, tested, observable, and appropriately secured.

---

# 1. Project Identity

**Name:** Avero  
**Tagline:** Your engineering workflow, intelligently orchestrated.  
**Category:** AI-powered software engineering platform  
**Status:** New project  
**Language:** TypeScript  
**Architecture:** Nx monorepo with modular applications and shared libraries  
**Package Manager:** pnpm

## Product Vision

Avero is an everyday developer tool for repository intelligence, autonomous coding, code review, issue investigation, testing, and engineering automation.

It allows developers to:

1. Connect GitHub repositories.
2. Create engineering tasks.
3. Launch coding agents.
4. Monitor execution in real time.
5. Inspect generated changes.
6. Review test results.
7. Manage pull requests.
8. Coordinate specialized agents.
9. Evaluate agent performance.
10. Audit previous executions.

Avero is not an IDE replacement.

It is an AI engineering workspace that extends existing development workflows.

---

# 2. Mandatory Technology Stack

Use the following stack unless a verified technical incompatibility requires an alternative.

| Layer                  | Technology                                      |
| ---------------------- | ----------------------------------------------- |
| Monorepo               | Nx                                              |
| Package manager        | pnpm                                            |
| Language               | TypeScript                                      |
| Runtime                | Node.js                                         |
| Frontend               | Next.js App Router                              |
| UI                     | React                                           |
| Styling                | Tailwind CSS v4                                 |
| Components             | Vercel UI SDK (`@ui-sdk/react`, `@ui-sdk/core`) |
| Icons                  | Lucide                                          |
| Authentication         | Clerk                                           |
| Database               | PostgreSQL                                      |
| ORM                    | Drizzle ORM                                     |
| Validation             | Zod                                             |
| Background processing  | BullMQ                                          |
| Queue infrastructure   | Redis                                           |
| Coding agents          | Cursor SDK (`@cursor/sdk`)                      |
| Custom agent workflows | Cursor Agent SDK (`@grok/agent-sdk`)            |
| GitHub integration     | Octokit + GitHub App                            |
| Realtime communication | Server-Sent Events                              |
| Artifact storage       | S3-compatible storage                           |
| Observability          | OpenTelemetry                                   |
| Unit testing           | Vitest                                          |
| End-to-end testing     | Playwright                                      |
| Web hosting            | Vercel                                          |
| Worker hosting         | Persistent Node.js container                    |

## Important Requirements

- Use Nx instead of Turborepo.
- Do not install Turborepo.
- Use pnpm workspaces.
- Use Nx project boundaries.
- Use Nx target inference where appropriate.
- Use Nx dependency graph.
- Configure task caching.
- Configure affected-project execution.
- Configure independent application builds.
- Keep shared packages independently testable.
- Keep all Nx plugins on compatible versions.
- Do not introduce unnecessary libraries.

---

# 3. Nx Monorepo Architecture

## 3.1 Workspace Strategy

Create a single Nx workspace named `avero`.

Use a package-based TypeScript monorepo structure with:

- `apps/` for deployable applications.
- `packages/` for internal shared libraries.
- `tools/` for workspace tooling and generators.
- `infra/` for infrastructure configuration.
- `docs/` for technical documentation.

Use pnpm workspace packages with a consistent `@avero/*` naming convention.

Nx must manage:

- Project discovery.
- Project dependency graph.
- Task orchestration.
- Build dependencies.
- Incremental builds.
- Local caching.
- Affected-project detection.
- Linting.
- Type checking.
- Testing.

## 3.2 Target Repository Structure

```text
avero/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── overview/
│   │   │   │   │   ├── repositories/
│   │   │   │   │   ├── tasks/
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── evaluations/
│   │   │   │   │   ├── activity/
│   │   │   │   │   └── settings/
│   │   │   │   └── api/
│   │   │   │       └── v1/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── next.config.ts
│   │   ├── project.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── worker/
│   │   ├── src/
│   │   │   ├── queues/
│   │   │   ├── processors/
│   │   │   ├── orchestration/
│   │   │   ├── lifecycle/
│   │   │   ├── recovery/
│   │   │   └── main.ts
│   │   ├── project.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── agent-service/
│       ├── bot/
│       │   ├── agent.ts
│       │   ├── instructions.md
│       │   ├── tools/
│       │   ├── skills/
│       │   ├── subagents/
│       │   ├── channels/
│       │   ├── hooks/
│       │   └── mcp-connections/
│       ├── evals/
│       ├── project.json
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   ├── migrations/
│   │   │   └── client.ts
│   │   ├── drizzle.config.ts
│   │   ├── project.json
│   │   └── package.json
│   │
│   ├── contracts/
│   │   ├── src/
│   │   │   ├── tasks/
│   │   │   ├── agents/
│   │   │   ├── events/
│   │   │   └── api/
│   │   └── package.json
│   │
│   ├── coding-engine/
│   │   ├── src/
│   │   │   ├── cursor/
│   │   │   ├── adapters/
│   │   │   ├── sessions/
│   │   │   └── events/
│   │   └── package.json
│   │
│   ├── github/
│   │   ├── src/
│   │   │   ├── client/
│   │   │   ├── installations/
│   │   │   ├── webhooks/
│   │   │   └── pull-requests/
│   │   └── package.json
│   │
│   ├── security/
│   │   ├── src/
│   │   │   ├── permissions/
│   │   │   ├── policies/
│   │   │   └── approvals/
│   │   └── package.json
│   │
│   ├── observability/
│   │   ├── src/
│   │   │   ├── logging/
│   │   │   ├── tracing/
│   │   │   └── metrics/
│   │   └── package.json
│   │
│   ├── config/
│   │   ├── src/
│   │   │   ├── environment.ts
│   │   │   └── constants.ts
│   │   └── package.json
│   │
│   └── ui/
│       ├── src/
│       │   ├── components/
│       │   ├── primitives/
│       │   └── styles/
│       └── package.json
│
├── tools/
│   ├── generators/
│   └── scripts/
│
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.worker
│   └── Dockerfile.web
│
├── docs/
│   ├── architecture.md
│   ├── nx-workspace.md
│   ├── sdk-compatibility.md
│   ├── database.md
│   ├── security.md
│   ├── api.md
│   ├── development.md
│   └── deployment.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── nx.json
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
└── README.md
```

**Important:** This structure is the desired logical architecture. Allow Nx generators to create their supported configuration files and adapt the exact placement of `project.json`, TypeScript configurations, and build outputs to the installed Nx version. Do not create redundant configuration solely to match the diagram.

**Added since this diagram was drawn.** The product became a flight recorder and test bench for coding agents, local-first, with the hosted platform on top. These projects exist and are part of the structure: `apps/cli` (the `avero` command), `packages/run-store` (run, verdict, decision and bench files), `packages/bench` (tasks from history, the matrix runner, hillclimb), `packages/share` (one-file replay, Agent Trace, local viewer) and `packages/mcp` (the MCP server). The route groups are currently `(platform)`, `(console)` and `(marketing)`; [docs/structure-plan.md](docs/structure-plan.md) says how and when the tree reaches the layout above.

---

# 4. Nx Initialization

## Step 1 — Verify Environment

Check:

```bash
node --version
pnpm --version
```

Verify that Node.js and pnpm versions satisfy the requirements of Nx, Next.js, and both Cursor SDKs.

## Step 2 — Create Workspace

Start with:

```bash
pnpm dlx create-nx-workspace@latest avero
```

Choose:

- A package-based workspace strategy suitable for pnpm.
- TypeScript.
- pnpm.
- An Nx-compatible setup.
- Local caching.
- No mandatory Nx Cloud subscription.

For non-interactive initialization, consult the installed `create-nx-workspace` CLI help and use the verified flags.

Do not guess removed or renamed CLI arguments.

## Step 3 — Install Plugins

Use the Nx CLI to add compatible plugins:

```bash
pnpm exec nx add @nx/next
pnpm exec nx add @nx/node
```

Install the linting and testing plugins required by the chosen workspace configuration.

Keep Nx core and plugin versions synchronized.

Use official generators rather than manually recreating generator boilerplate.

## Step 4 — Generate Applications

Use the applicable Nx generators for:

- Next.js web application.
- Node.js background worker.

Examples:

```bash
pnpm exec nx g @nx/next:application apps/web
pnpm exec nx g @nx/node:application apps/worker
```

Verify exact arguments against the installed generator schemas.

For the Agent SDK service, use the official Agent SDK project initializer and integrate its output into Nx as a project.

Do not impose a Node.js bundler or deployment model incompatible with the Agent SDK.

## Step 5 — Create Shared Libraries

Create workspace libraries for:

- `@avero/db`
- `@avero/contracts`
- `@avero/coding-engine`
- `@avero/github`
- `@avero/security`
- `@avero/observability`
- `@avero/config`
- `@avero/ui`

Use Nx generators or pnpm workspace package conventions.

Ensure each package has a clear public API.

Avoid importing directly from another package's private source files.

---

# 5. Nx Project Boundaries

Maintain a dependency graph that prevents inappropriate coupling.

## Application Boundaries

Applications may consume shared libraries.

Shared libraries must not import application code.

## Package Boundaries

Recommended dependency direction:

```text
apps/web
  ├── @avero/ui
  ├── @avero/contracts
  ├── @avero/db
  ├── @avero/github
  └── @avero/security

apps/worker
  ├── @avero/contracts
  ├── @avero/db
  ├── @avero/coding-engine
  ├── @avero/github
  ├── @avero/security
  └── @avero/observability

apps/agent-service
  ├── @avero/contracts
  └── approved Avero service clients
```

The agent service should use controlled APIs where appropriate rather than directly modifying worker or coding-engine internals.

## Nx Tags

Apply project tags such as:

```text
scope:web
scope:worker
scope:agent
scope:shared

type:app
type:feature
type:data-access
type:util
type:ui
type:integration
```

Configure module-boundary rules using the supported Nx ESLint tooling.

Prevent:

- Shared libraries importing applications.
- UI packages importing database packages.
- Browser-side code importing Node-only integrations.
- Circular project dependencies.
- Direct access to another library's internal implementation.

---

# 6. Nx Task Configuration

Nx must manage the following common targets:

- `build`
- `dev`
- `start`
- `lint`
- `typecheck`
- `test`
- `e2e`
- `db:generate`
- `db:migrate`
- `agent:validate`

Use inferred targets wherever appropriate.

Add explicit project targets only when necessary.

## 6.1 Build Dependencies

Configure Nx so build operations run required dependency builds first.

Conceptually:

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

Adapt this to actual Nx project configurations.

Do not cache tasks with nondeterministic outputs or external side effects.

## 6.2 Important Caching Rules

Cache:

- Deterministic builds.
- Type checking.
- Linting.
- Suitable unit tests.

Do not cache:

- Development servers.
- Production deployments.
- Database migrations.
- GitHub modifications.
- Live agent executions.
- External API mutations.

Include relevant files, environment configuration, and dependency inputs in cache hashing.

Do not include secret values in build artifacts.

## 6.3 Development Commands

The workspace should support commands equivalent to:

```bash
pnpm exec nx dev web
pnpm exec nx serve worker
pnpm exec nx build web
pnpm exec nx build worker
pnpm exec nx test contracts
pnpm exec nx graph
```

Use the actual generated target names.

## 6.4 CI Commands

The CI pipeline should support:

```bash
pnpm exec nx affected -t lint typecheck test build
```

Configure an appropriate Git base and head for affected-project calculations.

The pipeline must not silently skip required checks because the Git comparison range is incorrect.

---

# 7. System Architecture

Avero is divided into two architectural layers.

## Control Plane

Responsible for:

- Authentication.
- Workspace management.
- Repository access.
- Task creation.
- Scheduling.
- Approval management.
- Event persistence.
- Dashboard APIs.
- Auditing.

## Execution Plane

Responsible for:

- Cursor SDK coding sessions.
- Cursor Agent SDK workflows.
- Tool execution.
- Specialized agents.
- Repository modifications.
- Evaluations.
- Verification.

## Execution Flow

```text
Developer
   |
   v
Next.js Dashboard
   |
   v
Avero API
   |
   +----> Clerk Authentication
   |
   +----> PostgreSQL
   |
   +----> BullMQ / Redis
               |
               v
         Background Worker
               |
               v
        Cursor SDK Adapter
               |
               v
        Cursor Cloud Agents
               |
               v
       Authorized Repository
```

GitHub events and Agent SDK workflows communicate with Avero through authenticated interfaces.

Do not directly couple the two SDK runtimes.

---

# 8. Cursor SDK Integration

Create the Cursor SDK integration inside:

```text
packages/coding-engine/
```

## Responsibilities

- Create coding agents.
- Execute tasks.
- Manage supported sessions.
- Stream provider events.
- Normalize output.
- Collect results.
- Correlate identifiers.
- Handle errors.
- Support cancellation where available.
- Enforce resource limits.

## Provider Abstraction

Define Avero-owned interfaces.

Example:

```typescript
interface CodingEngine {
  start(input: StartCodingTask): Promise<AgentSession>;

  resume(sessionId: string): Promise<AgentSession>;

  cancel(runId: string): Promise<void>;

  getResult(runId: string): Promise<CodingResult>;
}
```

These interfaces must be implemented against the real APIs supported by the installed Cursor SDK.

Do not invent SDK functionality.

## Execution Policy

- Prefer cloud coding agents for production.
- Isolate local agent execution.
- Validate repository authorization.
- Restrict available tools.
- Limit execution time.
- Capture real execution events.
- Prevent unauthorized merges.
- Protect environment secrets.

---

# 9. Cursor Agent SDK Integration

Create the specialized agent project inside:

```text
apps/agent-service/
```

The installable package is `@grok/agent-sdk` (formerly `@cursor/bdk`), as documented at https://cursor.com/docs/agent-sdk.

Use Cursor Agent SDK for:

- Custom agents.
- Agent instructions.
- Custom tools.
- Skills.
- Subagents.
- Event channels.
- MCP integrations.
- Evaluations.
- Deployment where supported.

## Initial Agents

### Engineering Coordinator

Coordinates engineering workflows.

### Pull Request Reviewer

Analyzes changes and reports actionable findings.

### Security Reviewer

Investigates vulnerabilities and insecure implementation patterns.

### Issue Triage Agent

Analyzes GitHub issues and recommends next steps.

### Documentation Agent

Investigates documentation quality and proposes improvements.

### Testing Agent

Analyzes tests and regression coverage.

## Agent-to-Avero Integration

Custom agent tools should communicate through authenticated Avero service APIs.

Example:

1. GitHub emits an event.
2. Agent SDK receives the event.
3. Specialized agent analyzes it.
4. Agent invokes an Avero tool.
5. Tool requests an engineering task.
6. Avero validates the request.
7. Worker executes the task through Cursor SDK.
8. Results return through Avero's task APIs.

Do not assume Cursor SDK and Cursor Agent SDK share session state.

---

# 10. Database Architecture

Use PostgreSQL and Drizzle ORM.

Keep schema and migrations inside:

```text
packages/db/
```

## Required Entities

- Users.
- Workspaces.
- Workspace Members.
- GitHub Installations.
- Repositories.
- Tasks.
- Agent Definitions.
- Agent Runs.
- Run Events.
- Tool Executions.
- Approvals.
- Artifacts.
- Pull Requests.
- Evaluations.
- Evaluation Runs.
- Audit Logs.
- Webhook Deliveries.
- Outbox Events.

## Requirements

- UUID primary keys.
- Foreign key constraints.
- Unique external provider identifiers where appropriate.
- Indexed foreign keys.
- Workspace authorization.
- Transactions.
- Idempotency keys.
- Timezone-aware timestamps.
- Secret redaction.
- Artifact references instead of storing large files in PostgreSQL.

## Nx Database Targets

Expose migration-related operations through dedicated Nx targets.

Examples:

```text
db:generate
db:migrate
db:studio
```

Do not allow database migration commands to run as cached build dependencies.

Production migrations must be explicitly controlled.

---

# 11. Background Jobs

Use BullMQ and Redis.

The background worker is an independently deployable Node.js application managed by Nx.

## Responsibilities

- Consume task jobs.
- Start coding agents.
- Persist execution state.
- Process provider results.
- Handle retries.
- Recover interrupted tasks.
- Process outbox events.
- Reconcile cloud runs.
- Handle cancellation requests.

## Required Reliability Features

- Idempotent execution.
- Unique job identifiers.
- Bounded retries.
- Exponential backoff.
- Dead-letter handling.
- Persistent provider identifiers.
- Worker crash recovery.
- Graceful shutdown.
- Timeouts.
- Execution reconciliation.

The worker must not depend on an active browser session.

---

# 12. API Architecture

Use versioned APIs under:

```text
/api/v1/
```

## Required Modules

### Workspaces

```http
GET /api/v1/workspaces
POST /api/v1/workspaces
GET /api/v1/workspaces/:id
PATCH /api/v1/workspaces/:id
```

### Repositories

```http
GET /api/v1/repositories
POST /api/v1/repositories/connect
GET /api/v1/repositories/:id
POST /api/v1/repositories/:id/sync
DELETE /api/v1/repositories/:id
```

### Tasks

```http
GET /api/v1/tasks
POST /api/v1/tasks
GET /api/v1/tasks/:id
POST /api/v1/tasks/:id/cancel
POST /api/v1/tasks/:id/retry
GET /api/v1/tasks/:id/events
GET /api/v1/tasks/:id/artifacts
```

### Agents

```http
GET /api/v1/agents
GET /api/v1/agents/:id
GET /api/v1/agents/:id/runs
```

### Evaluations

```http
GET /api/v1/evaluations
POST /api/v1/evaluations/:id/run
GET /api/v1/evaluation-runs/:id
```

### Approvals

```http
GET /api/v1/approvals
POST /api/v1/approvals/:id/decision
```

### Webhooks

```http
POST /api/v1/webhooks/github
```

Validate all application inputs with shared Zod contracts.

Enforce authorization on every protected resource.

---

# 13. Real-Time Execution Events

Use Server-Sent Events.

Define shared event contracts inside:

```text
packages/contracts/src/events/
```

Example:

```typescript
type AveroEventType =
  | 'run.started'
  | 'agent.message'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'approval.requested'
  | 'artifact.created'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled';

interface AveroEvent {
  id: string;
  runId: string;
  sequence: number;
  timestamp: string;
  type: AveroEventType;
  payload: Record<string, unknown>;
}
```

## Requirements

- Persist events before broadcasting.
- Preserve per-run event ordering.
- Support client reconnection.
- Support event replay.
- Authenticate subscriptions.
- Redact secrets.
- Avoid blocking workers on disconnected clients.

---

# 14. Frontend Requirements

Avero must look like a mature developer platform.

## Design Principles

- Dark-mode-first.
- Minimal and professional.
- Excellent typography.
- High information density.
- Clear hierarchy.
- Accessible.
- Responsive.
- Fast navigation.
- Subtle animation.
- Real data.
- Clear loading states.
- Meaningful error handling.

## Required Pages

### Overview

Display:

- Total tasks.
- Active runs.
- Completed runs.
- Failed runs.
- Pending approvals.
- Recent activity.
- Usage summaries.

### Repositories

Display:

- Connected repositories.
- GitHub installation status.
- Repository metadata.
- Recent tasks.

### Tasks

Display:

- Task list.
- Status.
- Repository.
- Agent.
- Duration.
- Execution mode.
- Pull request status.

### Task Detail

Include tabs for:

- Activity.
- Files.
- Tests.
- Artifacts.
- Approvals.

### Agent Studio

Display:

- Agent definitions.
- Capabilities.
- Tools.
- Skills.
- Instructions.
- Version information.

### Evaluation Lab

Display:

- Evaluation suites.
- Results.
- Scores.
- Comparisons.
- Regressions.

### Activity

Display:

- Execution history.
- Webhook activity.
- Audits.
- Errors.

### Settings

Display:

- Workspace management.
- Members.
- GitHub connections.
- Agent configuration.
- Usage limits.
- Security settings.

Never fabricate analytics or execution results.

---

# 15. Security Requirements

Implement:

- Clerk authentication.
- Workspace RBAC.
- GitHub App authorization.
- Webhook signature verification.
- Least-privilege credentials.
- Isolated agent execution.
- Tool allowlists.
- Secret redaction.
- Execution timeouts.
- Human approval.
- Audit logs.
- Prompt injection defenses.
- Cross-workspace isolation.

Require approval for:

- PR merges.
- Protected branch modifications.
- Production deployments.
- Destructive operations.
- Sensitive credential access.
- Irreversible external actions.

A user instruction must not override server-enforced security policies.

---

# 16. Testing Architecture with Nx

Use Nx to orchestrate tests across applications and shared packages.

## Unit Testing

Use Vitest.

Test:

- Authorization.
- Task state transitions.
- Event normalization.
- Validation.
- Approval rules.
- Retry logic.
- Coding adapter behavior.

## Integration Testing

Test:

- PostgreSQL.
- Redis.
- BullMQ.
- GitHub webhooks.
- Database transactions.
- Outbox publishing.
- Worker recovery.

## End-to-End Testing

Use Playwright.

Test:

- Authentication.
- Workspace creation.
- Repository connection.
- Task creation.
- Execution monitoring.
- SSE updates.
- PR navigation.
- Approval workflows.

## Nx CI Requirements

Use affected-project execution.

Configure project dependencies so changes in shared libraries correctly trigger checks in affected applications.

Do not depend only on manual project lists.

---

# 17. Nx Developer Experience

The workspace should provide an excellent local development experience.

## Requirements

- One-command installation.
- Clear environment setup.
- Local PostgreSQL and Redis through Docker Compose.
- Independent app execution.
- Shared package linking.
- Incremental builds.
- Fast unit tests.
- Project graph visualization.
- Consistent linting.
- Consistent formatting.
- Typed environment variables.

## Required Commands

Document commands for:

```bash
pnpm install

pnpm exec nx graph

pnpm exec nx show projects

pnpm exec nx run-many -t build

pnpm exec nx run-many -t lint

pnpm exec nx run-many -t test

pnpm exec nx affected -t lint test build
```

Project-specific execution commands must use the actual generated project names.

## Optional Nx Features

Consider:

- Nx Console.
- Nx MCP integration for AI coding assistants.
- Nx custom generators.
- Nx Cloud remote caching.

Nx Cloud must remain optional during initial development.

Avoid introducing paid infrastructure before it is necessary.

---

# 18. Implementation Milestones

## Milestone 0 — SDK Validation

- [x] Verify SDK packages.
- [x] Install dependencies.
- [x] Authenticate.
- [x] Execute Cursor SDK prototype.
- [x] Stream execution events.
- [x] Execute Agent SDK prototype.
- [x] Create custom tool.
- [x] Run evaluation.
- [x] Document compatibility.

**Exit Criteria:** Both SDKs execute real tasks.

**Status (2026-11-20):** met. `pnpm verify:sdk --live` passes on a Cursor Pro account: both SDKs authenticate, the Cursor SDK smoke run completes a real read tool call and streams events, the Agent SDK smoke run and the live evaluation pass. A free Cursor plan is rejected with `plan_required` on every SDK call, local runs included, so the account must be on a paid plan.

## Milestone 1 — Nx Foundation

- [x] Initialize Nx workspace.
- [x] Configure pnpm workspaces.
- [x] Configure Nx plugins.
- [x] Generate Next.js app.
- [x] Generate Node.js worker.
- [x] Integrate Agent SDK project.
- [x] Generate shared packages.
- [x] Configure project boundaries.
- [x] Configure task caching.
- [x] Configure TypeScript.
- [x] Configure linting.
- [x] Configure unit tests.
- [x] Verify project graph.
- [x] Verify workspace builds.

**Exit Criteria:** The Nx monorepo builds successfully and project dependencies are correctly identified.

**Status (2026-11-18):** met. `pnpm check` (lint, typecheck, test, build) ran 43 of 43 tasks successfully from a clean `.next`, and `pnpm verify:workspace` confirmed the projects, tags, targets and dependency edges. Boundary rules were proven by deliberately bad imports (ui to db, web to db outside server modules, a deep import into another package's `dist`), each rejected by lint.

Known limits that do not block the exit criteria:

- The worker is a hand-built health server, not generated by `@nx/node`. Job processing is Milestone 3.
- Unit tests run in 10 of 11 projects. `@avero/ui` gets tests with the design-system rebuild.
- There is no `e2e` target yet (Playwright, Milestone 2) and no CI workflow (Milestone 7).
- Tags differ from section 5: `type:contract` and `runtime:*` are used and `type:feature` is not. See [docs/architecture.md](docs/architecture.md#dependency-rules).

## Milestone 2 — Platform Foundation

- [ ] Configure Clerk.
- [x] Create workspace management.
- [ ] Provision PostgreSQL.
- [x] Configure Drizzle.
- [x] Create database schema.
- [x] Configure Redis (local Docker service only; no client code until Milestone 3).
- [x] Create shared Zod contracts.
- [x] Implement authorization.
- [x] Add logging.

**Exit Criteria:** Users can authenticate and access authorized workspaces.

## Milestone 3 — Coding Engine

- [ ] Implement Cursor SDK adapter.
- [ ] Implement task API.
- [ ] Implement background worker.
- [ ] Add transactional outbox.
- [ ] Persist provider identifiers.
- [ ] Persist execution events.
- [ ] Add SSE streaming.
- [ ] Build task pages.
- [ ] Implement retries.
- [ ] Implement cancellation.
- [ ] Implement recovery.

**Exit Criteria:** Real coding-agent executions are visible and persistent.

## Milestone 4 — GitHub Integration

- [ ] Create GitHub App.
- [ ] Implement installation flow.
- [ ] Sync repositories.
- [ ] Verify webhooks.
- [ ] Deduplicate deliveries.
- [ ] Execute tasks against repositories.
- [ ] Collect PR metadata.
- [ ] Display diffs and results.
- [ ] Add approval workflows.

**Exit Criteria:** Coding tasks produce reviewable GitHub PRs.

## Milestone 5 — Specialized Agents

- [ ] Implement PR Reviewer.
- [ ] Implement Issue Triage Agent.
- [ ] Implement Security Reviewer.
- [ ] Define agent skills.
- [ ] Define custom tools.
- [ ] Connect Agent SDK to Avero APIs.
- [ ] Handle GitHub events.
- [ ] Test agent coordination.

**Exit Criteria:** Specialized agents can initiate and monitor authorized coding tasks.

## Milestone 6 — Evaluations and Observability

- [ ] Define evaluation suites.
- [ ] Implement evaluation runner.
- [ ] Store results.
- [ ] Build evaluation dashboard.
- [ ] Add usage monitoring.
- [ ] Add execution metrics.
- [ ] Configure OpenTelemetry.
- [ ] Verify secret redaction.
- [ ] Test recovery scenarios.

**Exit Criteria:** Agent quality and execution behavior can be evaluated.

## Milestone 7 — CI/CD and Release

- [ ] Configure Nx affected CI.
- [ ] Configure caching.
- [ ] Build deployable applications.
- [ ] Deploy Next.js.
- [ ] Deploy worker.
- [ ] Deploy Agent SDK service.
- [ ] Configure production data services.
- [ ] Test complete workflows.
- [ ] Document deployment.
- [ ] Prepare demo repositories.
- [ ] Publish repository.

**Exit Criteria:** Avero is deployable and demonstrable end to end.

---

# 19. Definition of Done

Avero v1 is complete when:

- [ ] The repository uses Nx and pnpm.
- [ ] All applications are Nx projects.
- [ ] Shared libraries follow dependency boundaries.
- [ ] The Nx project graph is correct.
- [ ] Builds are reproducible.
- [ ] Affected CI checks work.
- [ ] Users can authenticate.
- [ ] Users can connect GitHub repositories.
- [ ] Users can create tasks.
- [ ] Cursor SDK executes real coding workflows.
- [ ] Agent SDK executes specialized workflows.
- [ ] Execution events are persisted.
- [ ] Execution events stream to the dashboard.
- [ ] Tasks survive application restarts.
- [ ] Failed runs are visible.
- [ ] Pull requests are reviewable.
- [ ] Agent evaluations are reproducible.
- [ ] Approval rules are enforced.
- [ ] Workspace isolation works.
- [ ] Secrets are protected.
- [ ] Documentation is complete.
- [ ] Production builds succeed.

---

# 20. Execution Instructions for the Coding Agent

Follow these rules throughout implementation.

1. Inspect the existing repository before changing files.
2. Consult official documentation when using unfamiliar APIs.
3. Validate Nx generator schemas before running commands.
4. Keep package versions compatible.
5. Do not invent SDK APIs.
6. Do not mix Nx and Turborepo.
7. Use pnpm consistently.
8. Do not introduce circular dependencies.
9. Use strict TypeScript.
10. Validate external data with Zod.
11. Keep SDK integrations behind abstractions.
12. Never fake execution results.
13. Write meaningful tests.
14. Run relevant Nx checks after changes.
15. Document architecture decisions.
16. Avoid unnecessary complexity.
17. Do not expose secrets.
18. Maintain clear, focused modules.
19. Implement working vertical slices before expanding features.
20. Preserve working functionality while adding new capabilities.

## First Implementation Objective

Start by establishing the Nx workspace.

The first vertical slice must demonstrate:

1. Successful Nx workspace initialization.
2. Next.js application running.
3. Node.js worker running.
4. Shared contracts imported by both applications.
5. PostgreSQL and Redis connectivity.
6. One task created through the API.
7. One background job executed by the worker.
8. A real Cursor SDK task initiated.
9. Execution status persisted.
10. The frontend displaying the task's real state.

Do not spend the initial implementation period building an elaborate interface before this flow is functional.

## Expected Deliverables

Provide:

- Actual application source code.
- Nx workspace configuration.
- pnpm workspace configuration.
- All necessary package manifests.
- Shared libraries.
- Database schema.
- Working API routes.
- Worker implementation.
- SDK adapters.
- Environment variable examples.
- Docker Compose configuration.
- Tests.
- Documentation.
- Reproducible setup instructions.

After each milestone, report:

- Files created or modified.
- Features implemented.
- Commands executed.
- Test results.
- Remaining limitations.
- Next engineering priorities.

Do not report unexecuted tests as passing or unimplemented features as complete.

---

# 21. Official Documentation

- Nx: https://nx.dev/
- Nx with Next.js: https://nx.dev/docs/technologies/react/next/introduction
- Nx with Node.js: https://nx.dev/docs/technologies/node/introduction
- Nx Project Configuration: https://nx.dev/docs/reference/project-configuration
- Nx CI: https://nx.dev/docs/features/ci-features
- Cursor SDK: https://cursor.com/docs/sdk/typescript
- Cursor Agent SDK: https://cursor.com/docs/agent-sdk
- Next.js: https://nextjs.org/docs
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- BullMQ: https://docs.bullmq.io/
- GitHub Apps: https://docs.github.com/en/apps
- OpenTelemetry: https://opentelemetry.io/docs/

---

# Final Objective

Build **Avero** as a modular, production-oriented AI engineering platform powered by Cursor SDK and Cursor Agent SDK.

Use **Nx** to organize applications, enforce architectural boundaries, accelerate development, orchestrate builds, and optimize CI.

The end result should demonstrate:

- Practical autonomous software engineering.
- Real coding-agent execution.
- Specialized agent workflows.
- Persistent task management.
- Observable execution.
- Secure repository operations.
- Reproducible agent evaluations.
- Reliable distributed processing.
- Maintainable monorepo architecture.

**Avero — Your engineering workflow, intelligently orchestrated.**

**Begin with SDK validation and Nx workspace initialization.**
