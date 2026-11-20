# Avero: product plan

Status: direction agreed 2026-11-19. It replaces the "SaaS orchestration dashboard" framing in `AVERO.md`. Phases 0, 1 and most of 2 are done (2026-11-20): see [Progress](#progress).

**Decisions recorded:** build the flight recorder and test bench _and_ the team orchestration platform, with the recorder and bench as the foundation; ship local-first _and_ hosted, over one shared run-record format; support Cursor only at first.

## Progress

**Phase 0, done 2026-11-20.** `pnpm verify:sdk --live` passes on a Cursor Pro account. A free plan is rejected with `plan_required` on every SDK call, local runs included. Billed cost (`agent.getUsage()`) returns `feature_unavailable` for this account, so records carry token counts and show cost as "not reported" rather than an estimate.

**Phase 1, done 2026-11-20** (one gap, below). Built and tested:

- Run-record schema in `@avero/contracts` (JSONL, one event per line, strict Zod validation, helpers for tool spans and run summaries).
- Recorder in `@avero/coding-engine`: wraps a local Cursor SDK run, merges the SDK's streamed text fragments, bounds large tool output, scrubs the API key and the workspace path, and records changed files and a patch from git (including files git does not track yet). A failed run is recorded too.
- `@avero/run-store` (read, write, list; rejects run ids that could leave the folder) and the `avero` CLI: `pnpm avero run | list | show | serve`.
- Console: `/overview` (totals and the latest runs), `/runs` and `/runs/[id]` (timeline, event feed, token counter, playhead and the diff), all read from run records. The simulation and its screens (Tasks, Repositories, Agents, Evaluations, Activity) are deleted.
- The marketing page replays a real recorded run (`apps/web/src/content/example-run.ts`, exported with `tools/scripts/export-example-run.mjs`). Only the Verdict and Bench demos still use illustrative data, labelled as such, until those phases are built.

One real run (30 s, 49.6k tokens, 2 files, tests passing) was recorded on Cursor Pro and replayed.

**Known gaps.** The Cursor sandbox is unsupported on this Windows machine, so recordings here use `--no-sandbox` in a throwaway folder; the CLI explains this when the sandbox is refused. The viewer is now `avero serve` (Phase 4), and `pnpm avero console` runs the fuller Next.js console from this repository. The replay only animates in a visible window, so it was checked through the DOM and in earlier browser sessions, not on every change.

**Phase 2, mostly done 2026-11-20.** Built and tested:

- **Verdict.** `pnpm avero verdict <run-id>` has an independent reviewer agent (a fresh Cursor SDK agent with no tools but a `submit_verdict` tool) read the task, the author's own claim, the diff and the shell commands, and return a structured verdict: checks with evidence, files outside the task, whether tests ran, and a risk tier. Avero then checks it against the record and lists every correction: files that were not changed are removed, "tests ran" is dropped when no command ran, and risk is raised to a floor the record supports (dependency, workflow, env or migration files, a very large change, a failed check, files outside the task, or a run that did not finish). It is saved beside the record as `<run>.verdict.json`; the record itself never changes.
- **Decisions.** A person approves, requests changes or rejects, from the run page or `pnpm avero decide`, with an optional note. Set `AVERO_READ_ONLY=1` to turn deciding off on a shared viewer. The runs list and the Overview show each run's risk and decision, and how many finished runs are still undecided.
- **Gates.** `avero run` takes `--max-tokens` and `--max-seconds` (the run is cancelled and the record says why; time spent waiting for a person does not count), `--plan` (the agent plans without editing, you read its actual plan, and nothing changes unless you approve), `--approvals` (the agent gets a `request_approval` tool and is told to use it before risky actions), and `--verdict` (review right after the run). Every gate is a `gate` event in the run record and shows in the replay.
- **Reviewer evals.** `pnpm avero eval-reviewer` runs the reviewer on four runs whose answer is known: a correct change, a fixed delay where exponential backoff was asked for, scope creep (a dependency and a tracking module), and an "all tests pass" claim with no test run. On 2026-11-20 it got 4 of 4 right. That is one run of a non-deterministic model, so treat it as a smoke test, not a score.

Checked live on Cursor Pro: a real review of a good run (risk low, seven checks with evidence), a real review of a run cancelled by the time cap (the reviewer found the tests never ran, and Avero raised the risk from medium to high), a real plan-then-approve run, and a real time cap.

**Phase 2 gaps and deviations.**

- The reviewer runs on the Cursor SDK, not the Agent SDK: it needed only one structured tool, and the Agent SDK's trajectory evals are for agents deployed through it. The evals above are checks on the structured verdict instead.
- Custom system prompts are not enabled on this Cursor account, so the reviewer's instructions are sent in the message.
- `request_approval` is advice to the model: Avero cannot make an agent call a tool, so it records every request and answer but cannot guarantee a risky action went through it. Real enforcement needs the sandbox (unsupported on this Windows machine) or generated Cursor hooks, which are not built.
- A run cancelled by a cap reports 0 tokens, because the SDK does not report usage for a cancelled turn.
- The reviewer is a model and can be wrong. The page says so, and a person decides.
- Starting a review from the run page (instead of the command) is not built, so the key stays out of the web server.

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

**Hosting agents on Cursor.** An Agent SDK project can be deployed to Cursor-managed hosting with `agent-sdk deploy` (from a pushed Git ref), or run on your own Node 22.13+ server with `agent-sdk serve`. A deployed agent gets a stable URL and manages from the Deployed Agents dashboard (roles Viewer, Editor, Owner). It exposes an HTTP API for durable sessions, follow-ups, a live NDJSON event stream with replay from an index, per-turn cost, tool calls without a model turn, and an MCP endpoint. It also comes with a built-in playground (chat, trace, raw events, evals), secrets (`agent-sdk secret set`), an egress allowlist, session state that survives redeploys, cron schedules and reminders, and artifacts. Triggers come from GitHub, GitLab, Bitbucket, Slack and PagerDuty channels, webhooks and deployment events; GitHub events are pulled through the Cursor account, so no public webhook URL is needed. Hosted agents can call each other by slug, hand coding work to Cursor cloud agents and steer them, and open pull requests against their own source. Limits: Privacy Mode (Legacy) blocks deploys; some teams cap deployments (default 20) and deploys per day (100). I read this in the SDK's shipped docs and have not deployed anything, since that needs your Cursor login.

**What that means for Avero:** the Verdict reviewer and the eval suites can be deployed on Cursor hosting instead of running our own worker, queue and webhook receiver. Avero Cloud would call the hosted agent's session API and stream its events into Scope. That removes most of the planned BullMQ, Redis and GitHub-webhook work, at the price of depending on Cursor's hosting and its beta surface. Cursor's own playground already shows traces for one agent, so Scope's value is across runs, across agents and with verification and bench data on top.

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

| Package                                                | Plan                                                                                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@avero/contracts`                                     | Grow: run-record schema, event types, bench task and result schemas.                                                                                                                            |
| `@avero/coding-engine`                                 | Becomes the recorder: wraps the Cursor SDK, normalizes events, writes JSONL. Keep behind the provider abstraction.                                                                              |
| `@avero/agent-service`                                 | Home of the Verdict reviewer and the eval suites (trajectory assertions).                                                                                                                       |
| `@avero/security`                                      | Keep `redactSecrets`; add policy and gate helpers.                                                                                                                                              |
| `@avero/ui`                                            | Keep the hardware kit; replace simulated screens with replay, verdict and bench views.                                                                                                          |
| `@avero/cli` (new)                                     | `run`, `replay`, `verdict`, `bench`, `export`, `serve`.                                                                                                                                         |
| `apps/web`                                             | Becomes the local viewer. Decide Next.js standalone vs a Vite SPA for `npx` size and start-up.                                                                                                  |
| `apps/worker`, `@avero/github`, Clerk, Postgres, Redis | Paused until Phase 5, then become Avero Cloud. The worker and queue may shrink or disappear if Cursor-hosted agents run the Verdict reviewer and channels. Workspace and auth code stays as is. |

**Phase 3, built and run live 2026-11-20.**

- **Suite from history.** `avero bench init` finds commits that changed source and tests together; the task is the commit message, the start is the parent, the judge is the commit's own test files. Each candidate is validated (tests pass at the solution, fail at the parent with the solution's tests added) and dropped with a reason if not.
- **Matrix runner.** `avero bench run` runs every task under every setup (model, with and without each rules file) in throwaway `git worktree`s, records each attempt as an ordinary run, then puts the original tests back and runs them, so an agent that edits tests cannot pass. The repository is never touched.
- **Numbers.** Pass rate with a 95% Wilson interval, tokens and time per resolved task counting failed attempts, and cost per resolved task only when the account reports billed cost (otherwise unknown, or an estimate from `--prices`, labelled).
- **Hillclimb.** `avero bench hillclimb` has an agent propose one rules change at a time from the failed tasks, refuses a proposal that names a task, test or path from the suite, and keeps a change only if more tasks resolve or the same number resolve with at least 10% fewer tokens. `--holdout` judges on tasks the proposer never saw.
- **Console.** `/bench`, `/bench/<suite>` and `/bench/<suite>/<result>`: the setup table, a per-task grid whose cells open the recorded run, and the hillclimb history.
- Details and limits: [docs/bench.md](bench.md).

Run live on Cursor Pro against a small demo repository (`tools/scripts/make-demo-repo.mjs`): 2 tasks x 2 setups (composer-2.5, with and without a three-line rules file), 1 repeat, capped at 300k tokens and 240 s. Result: 1 of 2 resolved under each setup, about 135k tokens and 43 to 50 s per resolved task, cost unknown on this account. That is four attempts, so it shows the pipeline works and says nothing about which setup is better. The unresolved task (`chunk`) failed under both setups because its tests required an error for non-whole sizes that the commit message did not state: a fair demonstration that a mined task is only as fair as its commit message. A small hillclimb (3 tasks, 1 held out) measured the starting rules, found nothing failing on the visible tasks, and so proposed no change. The proposal path is covered by tests with a fake agent, not yet by a live run.

**Phase 3 gaps.** No live hillclimb has produced and measured a real rules change. Task quality depends on commit messages; there is no check that a message states what the tests check. Billed cost is unavailable for this account. The first suite tried had 4 tasks; a useful one needs more.

**Phase 4, built and checked 2026-11-20.**

- **Share.** `avero export` writes one self-contained HTML replay (strict CSP, record text only ever inserted as text, known secret formats redacted). `avero serve` is a read-only local viewer with no Next.js. `@avero/share` is tested against a hostile record (script and image injection) and the page was loaded in a real browser.
- **Agent Trace.** `avero trace` writes Agent Trace JSON (version `0.1`) for the lines the agent added. The spec has ambiguities (the schema's version pattern rejects the spec's own `0.1.0` examples; the revision is meant to be the commit containing the code, but a record only knows the base commit), recorded in [docs/sharing.md](sharing.md).
- **MCP.** `avero mcp` serves six read-only tools over stdio (list, get, events, verdict, changes, search) using the official MCP SDK. Checked over a real stdio session against real records.
- **npx packaging.** `pnpm build:npm` bundles the CLI, bench, share and MCP into `dist-npm/avero` (about 290 kB packed) with `@cursor/sdk` as the one dependency. The tarball installed into a clean folder and ran `--help`, `list`, `export`, `serve` (the replay page worked in the browser) and `bench show`. **Nothing is published.** The name `avero` was free on npm when checked (2026-11-20).
- README quick start, MIT `LICENSE`, and the demo repository script.

**Phase 4 gaps.** Not published to npm; the license holder in `LICENSE` is "Avero contributors", change it if you want a name. The Cursor SDK terms for redistributing a tool that uses the user's own key are still unchecked (section 8). No recorded demo video and no public read-only viewer seeded with runs. `avero serve` cannot record decisions (use `avero decide` or the Next.js console). The marketing page's Bench demo still shows illustrative data. The 60-second quick start has been run in pieces (record, serve, export on this machine), not by a stranger on a fresh machine, and `npx avero` has not been tried against the registry because nothing is published.

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
