# Avero: product plan

Status: direction agreed 2026-11-19. Nothing here is built yet. It replaces the "SaaS orchestration dashboard" framing in `AVERO.md`.

**Decisions recorded:** build the flight recorder and test bench _and_ the team orchestration platform, with the recorder and bench as the foundation; ship local-first _and_ hosted, over one shared run-record format; support Cursor only at first.

## 1. The problem with the current idea

`AVERO.md` describes a hosted platform: connect repositories, launch coding agents from a dashboard, watch them run, approve pull requests. Research says that genre is crowded and partly commoditized:

- Cursor itself ships a **kanban board for cloud agents** in its open cookbook, built on the same SDK ([cursor/cookbook](https://github.com/cursor/cookbook), [coverage](https://pasqualepillitteri.it/en/news/1717/cursor-kanban-agent-sdk-2026)). It also ships Automations, Bugbot and Bugbot Autofix ([Automations](https://cursor.com/docs/automations)).
- Parallel-agent managers already exist: Conductor, Claude Squad, Vibe Kanban (whose company shut down in April 2026 and is now community-maintained) ([roundup](https://crystl.dev/blog/best-ai-agent-orchestration-tools/), [comparison](https://nimbalyst-website.pages.dev/blog/best-agent-management-tools-2026/)). Treat vendor comparison blogs as opinion.
- A web dashboard that _launches and watches_ agents is the part users are tired of. It also needs the most infrastructure (Clerk, Postgres, Redis, BullMQ, a GitHub App), which is slow to build and hard for others to adopt.

So "another agent dashboard" is both the least differentiated and the most expensive thing we could build.

## 2. Where the real gap is

Developer-written sources agree on the same pain, and it is not launching agents:

| Pain                                                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verification is the bottleneck.** Reviewing agent output costs more than writing it. | 96% of developers do not fully trust AI code; 38% say reviewing it takes more effort ([Sonar via search summary](https://www.qodo.ai/?p=22120)); Qodo's 2026 report names verification the top constraint. Reviewers must "reconstruct the prompt from the diff" ([analysis](https://tianpan.co/blog/2026/04/27/reviewing-agent-prs-different-not-faster)). Vendor-reported numbers, so weigh accordingly.                |
| **You can't see what the agent did or why.**                                           | At least six small open-source tools exist just to replay agent sessions: [cctrace](https://github.com/androidZzT/cctrace), [agent-strace](https://pypi.org/project/agent-strace/0.48.0/), [Wake](https://github.com/zzzgydi/wake), [tracebench](https://github.com/Skandesh/tracebench), [agentplay](https://www.everydev.ai/tools/agentplay/llms.txt), Rewind. None is polished, and none is built on Cursor's SDK.     |
| **Nobody knows which setup is best on _their_ repo.**                                  | Public benchmarks do not cover your workload. Cost per resolved task differs by more than 2x across harnesses for the same model (self-reported, [Databricks](https://letsdatascience.com/news/databricks-benchmarks-coding-agents-on-its-own-codebase-3a107646)). Tools exist ([RepoAgentBench](https://pypi.org/project/repoagentbench/), Superconductor beta) but are Python-only or closed and not Cursor-SDK-native. |
| **Running several agents turns you into a monitor.**                                   | Supervision load, branch collisions and attention thinning ([DEV](https://dev.to/battyterm/5-lessons-from-running-ai-coding-agents-in-parallel-53on), [LeadDev](https://leaddev.com/?p=29717)). I found no direct data on cost visibility, so that one is an assumption.                                                                                                                                                  |
| **Provenance is unsolved.**                                                            | Cursor's own [Agent Trace](https://github.com/cursor/agent-trace) RFC (v0.1.0) records which lines were AI-written; Thoughtworks lists it at "Assess" ([radar](https://www.thoughtworks.com/radar/platforms/agent-trace)). Merges and rebases are explicitly unresolved.                                                                                                                                                  |

## 3. What the SDKs actually give us

From the official docs ([Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript), Agent SDK docs shipped in `@grok/agent-sdk@0.6.0`):

**Cursor SDK (`@cursor/sdk`, public beta)**

- Same API for local and Cloud (isolated VM) runtimes; Node 22.13+.
- Streams normalized events: `assistant`, `thinking`, `tool_call` (running, then completed/error, with args and result), `status`, `task`, `usage`. Raw deltas through `onDelta` and `onStep`. `run.conversation()` returns the structured history.
- `run.steer(text)` injects guidance into a live local run; `run.cancel()`; `mode: "plan" | "agent"`, so a run can plan first and wait for a human.
- Token usage per turn and per run, `agent.getUsage()` for billed cost, `requestId` and `idempotencyKey` for correlation, `cloud.metadata` tags, `Agent.list/get/listRuns/getRun`, `Cursor.models.list()` (including the Router's cost/balanced/intelligence modes).
- Cloud: PR creation (`autoCreatePR`), artifacts, per-run env vars, resume.
- Local: sandbox (`sandboxOptions`), `autoReview`, `customTools`, toolset restriction, a JSONL local store (so recordings can be plain files).
- **Constraints that shape the design:** headless runs have no approval prompt; hooks are file-based only; custom tools, auto-review and `systemPrompt` are local only; local artifacts are empty; local usage needs per-account enablement; the package is in beta.

**Agent SDK (`@grok/agent-sdk`, GA since 2026-10-20)**

- Agents as a folder of Markdown and TypeScript: instructions, typed tools, skills, subagents, hooks, memory, MCP connections.
- **Evals** with trajectory assertions (`calledTool`, `notCalledTool`, `maxToolCalls`) and a documented **hillclimbing** loop: fix inputs, change one lever, rerun, keep only measured wins.
- Channels for GitHub, Slack, webhooks, schedules; OpenTelemetry export; artifacts; peer agents; a guide for handing work to Cursor cloud agents and steering them.

The two SDKs fit together: Cursor SDK runs and records the coding agents; Agent SDK builds the reviewer and evaluator agents and gives us a tested way to improve them.

## 4. Proposed product: Avero is the flight recorder and test bench for coding agents

One sentence: _Run any Cursor agent through Avero and get back evidence you can trust: exactly what it did, whether the result matches the intent, and which setup works best on your repository per dollar._

The visual identity already fits: a bench instrument. Avero is the oscilloscope for agent runs.

### Features

1. **Recorder.** `avero run "task"` wraps a Cursor SDK run (local first, cloud later) and stores a complete **run record**: prompt, plan, every tool call with args and result, thinking summaries, files read and changed, tests run, token usage and cost, git diff, outcome. Plain files in `.avero/` (JSONL), validated by a Zod schema in `@avero/contracts`, secrets redacted by the existing `redactSecrets`. No account, no database.
2. **Scope (replay).** A scrubbable timeline and waterfall of a run: what the agent read first, which tools repeated, where time and tokens went, what changed at each step. Built on UI SDK's Timeline, Waterfall and Tree, in the hardware look. Real recorded runs replace today's simulation.
3. **Verdict (verification).** After a run, an independent reviewer agent (Agent SDK, not the author) answers: does the diff match the stated intent, what is out of scope, what is redundant, which claims have test evidence, what is the risk tier. Output is a one-screen review card with a human approve, reject or request-changes. This directly attacks "reconstruct the prompt from the diff".
4. **Gates.** Plan-then-approve using `mode: "plan"`; for local runs a `request_approval` custom tool that blocks until a human answers; budget and time caps that call `run.cancel()`; sandbox and auto-review on by default; generated `.cursor/hooks.json` policy. This is real human-in-the-loop on top of a headless SDK.
5. **Bench.** Build a task set from your own merged pull requests (task = PR description, checks = the PR's tests), then run a matrix: model x mode x effort x rules/AGENTS.md variant. Score with tests plus Verdict. Report **cost per resolved task**, pass rate, time and variance. Answers "which setup is best on this repo per dollar".
6. **Hillclimb.** Propose one change to rules or instructions, rerun the frozen tasks, keep it only if the score improves, lock wins as evals. Follows the Agent SDK hillclimbing method, applied to your Cursor rules.
7. **Share.** `avero export <run>` produces one self-contained, redacted HTML replay. A shareable link to "what my agent did" is the viral and showcase hook.
8. **Provenance.** Emit [Agent Trace](https://github.com/cursor/agent-trace) records for each run so attribution rides an emerging standard instead of a private format.
9. **Agent-ready surface.** An MCP server exposing runs, verdicts and benchmarks so other agents can ask "what happened in run X", and the UI wired to UI SDK's agent bridge so an agent can operate it (UI SDK reports large token savings for this).

### The team layer: Avero Cloud

The original platform stays on the roadmap, but as a layer _over_ the recorder, not as the product's foundation. Orchestration is where Cursor overlaps most, so it only earns its place when it carries what Cursor's board does not: every run recorded, every result verified, every setup benchmarked.

- **Sync.** `avero push` uploads run records to a workspace; the hosted viewer reads the same format as the local one.
- **Launch and watch.** Start local or cloud agents from a board, with plan-then-approve gates, budgets and live Scope views, built on `Agent.create`, `run.stream`, `steer` and `cancel`.
- **Review queue.** Verdicts ordered by risk, with approve, reject and request-changes, then PR creation and PR status (GitHub App).
- **Org Bench.** Shared task sets and cost-per-resolved-task across a team's repositories and rules.
- **Channels.** GitHub, Slack and webhook triggers through Agent SDK channels, and the cloud-agent hand-off guide.
- **Accounts and access.** Workspaces, roles and audit (the Clerk, Postgres and workspace code that already exists).

What we still do not build first: a standalone launcher with no recording, Slack-first flows, or billing.

## 5. Architecture changes

**One record format, two ways to run.** Ship the local tool first as `npx avero` (CLI plus a local web UI reading `.avero/`): adoption cost is one command and one API key. Avero Cloud (Postgres, Clerk, GitHub App, cloud agents, Slack through Agent SDK channels) is built second over the _same_ run-record format, so a recording made locally opens unchanged in the hosted workspace.

| Package                                                | Plan                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `@avero/contracts`                                     | Grow: run-record schema, event types, bench task and result schemas.                                               |
| `@avero/coding-engine`                                 | Becomes the recorder: wraps the Cursor SDK, normalizes events, writes JSONL. Keep behind the provider abstraction. |
| `@avero/agent-service`                                 | Home of the Verdict reviewer and the eval suites (trajectory assertions).                                          |
| `@avero/security`                                      | Keep `redactSecrets`; add policy and gate helpers.                                                                 |
| `@avero/ui`                                            | Keep the hardware kit; replace simulated screens with replay, verdict and bench views.                             |
| `@avero/cli` (new)                                     | `run`, `replay`, `verdict`, `bench`, `export`, `serve`.                                                            |
| `apps/web`                                             | Becomes the local viewer. Decide Next.js standalone vs a Vite SPA for `npx` size and start-up.                     |
| `apps/worker`, `@avero/github`, Clerk, Postgres, Redis | Paused until Phase 5, then become Avero Cloud. Workspace and auth code stays as is.                                |

## 6. Roadmap

Each phase ends in something demonstrable. Estimates are rough and assume focused work.

| Phase                    | Deliverable                                                                                                                            | Done when                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Prove the SDKs**    | Close Milestone 0: authenticate, one real local run, one Agent SDK eval. Draft the run-record schema.                                  | `pnpm verify:sdk --live` passes; one real run saved as JSONL. Needs your Cursor credentials.                                           |
| **1. Recorder + Scope**  | `avero run`, run-record schema, JSONL store, replay UI over real records. Delete the simulation.                                       | A real run replays in the browser with timeline, waterfall, changed files and cost.                                                    |
| **2. Verdict + Gates**   | Reviewer agent, intent-vs-diff card, plan gate, approval tool, caps.                                                                   | A run ends in a Verdict you can approve or reject, and the reviewer has trajectory evals.                                              |
| **3. Bench + Hillclimb** | Task builder from merged PRs, matrix runner, cost-per-resolved-task view, one hillclimb round.                                         | You can answer "which model and rules are best on this repo" with numbers, and a kept rules change is locked by an eval.               |
| **4. Share + Launch**    | HTML export, Agent Trace output, MCP server, docs, demo repo, recorded demo, `npx` packaging, README with a 60-second quick start.     | A stranger can install, record a run and view the replay in under two minutes.                                                         |
| **5. Avero Cloud**       | Run sync, hosted viewer, launch board with plan gates, review queue, GitHub App, cloud runtime, org Bench, Slack and webhook channels. | A team can push recordings, launch a cloud run from the board, review its Verdict and merge the PR, all against one run-record format. |

## 7. Showcase and adoption

- The demo is **real recorded runs**, not simulations: a public read-only viewer seeded with several genuine runs (success, failure, plan gate, bench result). This also fixes the current screens, which are simulated.
- One strong hook: the exported replay link. Pair it with a short screen recording of a run, a verdict and a bench chart.
- Honest positioning: Avero does not replace Cursor; it records, verifies and benchmarks what Cursor agents do. Open-source, MIT, bring your own key.
- Quality bar for "showcase-ready": install to first replay in under two minutes; every number on screen traceable to a record; keyboard and screen-reader usable; no unlabeled fake data.

## 8. Risks and open questions

- **SDK beta and churn.** `@cursor/sdk` is public beta; `@grok/agent-sdk` is new. Pin versions and keep the provider abstraction.
- **Account-gated features.** Local usage reporting and some options are enabled per account; Bench cost numbers depend on it. Verify early in Phase 0.
- **Cursor could ship this.** Mitigate with the local-first, multi-run, cost-per-task and open-format angles Cursor's own tools do not target, and by building on its standards (Agent Trace, OTel).
- **Run cost.** Benchmarks spend real tokens. Budget caps and small default task sets are part of Bench.
- **Security.** Agents run shell commands: sandbox and auto-review on by default, secrets redacted before anything is stored or exported.
- **Terms and licensing.** Check Cursor's SDK terms for redistributing a tool that requires the user's own key before launch.
- **Multi-harness.** Reading Claude Code, Codex and Cursor session logs (as tracebench does) would widen the audience but dilutes the SDK-native story. Revisit after Phase 3.

## 9. Decisions and what is still needed

Decided: recorder plus bench plus team platform; local-first plus hosted; Cursor only first.

Still needed from you:

1. **Credentials.** A Cursor API key (or `cursor:login`) so Phase 0 can record real runs. I never handle the key.
2. **Packaging choice for the local viewer:** Next.js standalone or a lighter Vite single-page app bundled in the CLI. I recommend deciding after Phase 1 measures install size and start-up.
3. **License and name check:** MIT is assumed; confirm, and confirm the Cursor SDK terms allow the bring-your-own-key model.

## Sources

[Cursor TypeScript SDK docs](https://cursor.com/docs/sdk/typescript) · [Cursor Agent SDK changelog](https://cursor.com/changelog/agent-sdk) · [Cursor cookbook](https://github.com/cursor/cookbook) · [Cursor Automations](https://cursor.com/docs/automations) · [Agent Trace](https://github.com/cursor/agent-trace) · [GitHub: reviewing agent PRs](https://github.blog/2026-03-30-agent-pull-requests-are-everywhere-heres-how-to-review-them/) · [Qodo 2026 report](https://www.qodo.ai/?p=22120) · [RepoAgentBench](https://pypi.org/project/repoagentbench/) · [Superconductor benchmark](https://www.superconductor.com/docs/project/benchmark)
