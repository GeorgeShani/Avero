# Avero

Avero is a flight recorder and test bench for [Cursor](https://cursor.com) coding agents.

- **Record** what an agent actually did: every command, edit, token and the final diff, saved as a file on your machine.
- **Replay** it in the browser, or send one HTML file to a teammate.
- **Review** it: an independent reviewer agent checks the diff against the task, Avero corrects what the record contradicts, and you approve or reject.
- **Bench** it: build tasks from your repository's own history and find out which model and which rules file resolve the most tasks for the least spend.

Avero runs locally. It uses your own Cursor API key and sends nothing anywhere else.

## Quick start

You need Node.js 24 or newer, a Cursor account on a paid plan, and a Cursor API key in `CURSOR_API_KEY` (or a `.env` file in the folder you run from).

```shell
npx avero run "fix the flaky retry test" --cwd .
npx avero serve
```

The first command lets an agent edit the folder, then saves a record to `.avero/runs`. The second opens a read-only viewer at `http://127.0.0.1:4173`. Try it on a throwaway copy of a project first: the agent really edits files and runs commands.

On Windows the Cursor sandbox is not available, so add `--no-sandbox` and use a throwaway folder.

## What you can do

```shell
npx avero run "<task>" --max-tokens 200000 --max-seconds 300   # caps: the run is cancelled and the record says why
npx avero run "<task>" --plan                                   # the agent plans first; nothing changes unless you approve
npx avero list                                                  # your recordings
npx avero verdict <run-id>                                      # an independent review of one run
npx avero decide <run-id> approve --note "ran it, looks right"  # your decision, saved beside the record
npx avero export <run-id>                                       # one HTML file, no network needed
npx avero trace <run-id> --revision <sha>                       # Agent Trace JSON, for tools that read it
npx avero mcp                                                   # an MCP server over your runs, for your own agent
```

### Which model and rules are best on _your_ repository

```shell
npx avero bench init --repo . --test "npm test"
npx avero bench run <suite> --repo . --model composer-2.5 --rules AGENTS.md --max-tokens 300000 --max-seconds 300
npx avero bench show <suite>
npx avero bench hillclimb <suite> --repo . --model composer-2.5 --iterations 3 --holdout 1
```

`init` finds commits that changed source and tests together. The agent gets the commit's description and the code before the change, never the tests. When it finishes, the original tests are put back and decide whether the task is resolved, so an agent that edits the tests cannot pass. `run` tries every task under each setup (a model, with and without each rules file) and reports pass rate with its uncertainty and what a _resolved_ task cost, counting the failed attempts. `hillclimb` has a model propose one change to your rules at a time and keeps it only if the numbers improve.

Honest limits: a handful of tasks gives wide ranges, so a gap smaller than the range is not a result. A task is only fair when the commit message says what the tests check; read the suite before you trust it. Bench runs spend real Cursor usage, so set the caps. The setup is described in [docs/bench.md](docs/bench.md).

## Sharing

`avero export` writes one HTML file with the replay, the diff and the verdict. Known secret formats are redacted, and the page carries no network access, but redaction cannot catch everything: read the file before you share it. See [docs/sharing.md](docs/sharing.md) for what is included, the Agent Trace mapping and the MCP tools.

## Develop

Use Node.js 24 or 26 and pnpm 12.21.0, then install from the repository root.

```shell
pnpm install
pnpm check              # lint, typecheck, test and build every project
pnpm verify:workspace
pnpm avero --help       # the CLI, built from source
pnpm avero console      # the full Next.js console, with decisions and the bench pages
pnpm build:npm          # builds the publishable package into dist-npm/avero
node tools/scripts/make-demo-repo.mjs   # a small repository with a history, to try the bench on
```

The repository is an Nx and pnpm workspace. [Architecture](docs/architecture.md) · [Development guide](docs/development.md) · [Product plan and progress](docs/product-plan.md) · [Cursor SDK setup and verification](docs/sdk-compatibility.md) · [Local infrastructure](infra/README.md)

The web app also contains a workspaces feature (Clerk and PostgreSQL) that is separate from the recorder. The development guide covers setting it up.

## License

MIT. See [LICENSE](LICENSE).
