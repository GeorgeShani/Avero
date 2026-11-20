# Bench

Bench answers one question with numbers: **which model and which rules file resolve the most tasks on your repository, and what does a resolved task cost?**

## How a task is made

`avero bench init --repo <dir> --test "<command>"` walks the repository's recent history and keeps commits that changed source files and test files together. For each one:

- the **task** is the commit's message, as the instruction to the agent;
- the **starting point** is the commit's parent;
- the **judge** is the test files from the commit itself.

Each candidate is validated before it is kept: the test command must pass at the solution commit, and fail at the parent with the solution's tests added. A commit whose tests do not fail without the change measures nothing, so it is dropped (the command lists each skip and why). Use `--no-validate` to skip this (not recommended) and `--scan` and `--count` to widen or narrow the search.

The test command runs on your machine, in throwaway `git worktree` checkouts. Your working copy is never touched.

## How an attempt is judged

For every task, setup and repeat, Avero:

1. checks out the parent commit in a fresh worktree, without the solution's tests;
2. commits the setup's rules file (for example `AGENTS.md`) so it is not counted as an agent change;
3. runs a real Cursor agent with the task, and records it as an ordinary run (so it has a replay and can be reviewed);
4. puts the solution's original test files back, overwriting anything the agent wrote at those paths, and runs the test command.

Exit code 0 is **resolved**. Because the original tests are restored after the agent finishes, an agent that edits or deletes the tests cannot pass by doing so. An attempt that could not be judged (the agent could not start, the tests could not run) is recorded as an **error** and counted as not resolved.

## What is reported

Per setup (a model, with or without each rules file):

- **Resolved** and **pass rate**, with a 95% Wilson interval. With a few attempts the interval is wide. A gap between two setups that is smaller than their intervals is not a result.
- **Tokens and time per resolved task**: everything spent, failed attempts included, divided by the number of resolved attempts. A cheap setup that fails often is not cheap.
- **Cost per resolved task**, only when Cursor reports billed cost for the account. Otherwise it is shown as _unknown_. Pass `--prices <model>=<input>,<output>[,<cacheRead>]` (US dollars per million tokens) to get an estimate, which is labelled as one.

Results are saved under `<repo>/.avero/bench/<suite>/` and shown in the console at `/bench` (start it with `pnpm avero console`). Each cell links to its recorded run.

## Hillclimb

`avero bench hillclimb <suite> --repo <dir> --model <id>` improves a rules file one change at a time:

1. measure the starting rules (`--start-rules <file>`, or none) on the frozen tasks;
2. a Cursor agent is shown the tasks that failed, with the test output, and proposes **one** change to the rules (via a `propose_rules` tool);
3. measure the change on the same tasks;
4. keep it only if more tasks resolved, or the same number with at least 10% fewer tokens per resolved task.

Two protections against fooling yourself:

- A proposal that names a task, test or path from the suite is refused (it would teach the answer, not a rule).
- `--holdout <n>` keeps `n` tasks out of what the proposer sees and uses only those to decide. Without it, the rules are tuned and judged on the same tasks, which overstates the gain.

The output is a rules text and the history of every change with why it was kept or dropped. Rerun with more tasks or `--repeats` before trusting a gain.

## Limits to know

- **A task is only fair if the commit message says what the tests check.** Mining commits cannot guarantee that. In a trial on the demo repository, a `chunk` task failed under every setup because its tests also required an error for a non-whole number that the commit message did not mention. The agent did what was asked. Read the suite (`avero bench show <suite>`) and the failing test output before drawing conclusions about a task.
- **Small suites give weak signals.** Five tasks and one repeat cannot separate two similar setups. Treat the first run as a smoke test.
- **Agents are not deterministic.** The same setup can resolve a task once and fail it the next time. `--repeats` measures that.
- **Real usage.** Every attempt is a real Cursor run. Use `--max-tokens` and `--max-seconds`.
- **Sandbox.** Cursor's sandbox is unsupported on some machines (Windows included). Use `--no-sandbox` on a repository you are happy to have an agent run commands in; each attempt runs in a throwaway checkout.
- **Your test command runs unsandboxed**, with your permissions, at every attempt.

## Try it without risking a project

```shell
node tools/scripts/make-demo-repo.mjs ./avero-demo
pnpm avero bench init --repo ./avero-demo --test "npm test"
pnpm avero bench run avero-demo --repo ./avero-demo --model composer-2.5 --max-tokens 300000 --max-seconds 240 --no-sandbox
```
