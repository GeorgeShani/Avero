# Development

Use Node.js 24 or 26 and pnpm 12.21.0. Copy `.env.example` to `.env` and fill in the values you need.

## First run

```shell
pnpm install --frozen-lockfile
pnpm infra:up
pnpm infra:verify
pnpm exec nx run @avero/db:db:migrate
pnpm exec nx dev @avero/web
pnpm exec nx dev @avero/worker
```

The web app serves `http://localhost:3000`, the worker `http://127.0.0.1:3101/healthz`. Workspaces need Clerk development keys and `DATABASE_URL`. See the [README](../README.md) for the full setup and [infra/README.md](../infra/README.md) for Docker.

## Running tasks from the dashboard

Needs Clerk keys, `DATABASE_URL`, Redis and a Cursor key for the worker. Set these (see `.env.example`), start the web app and the worker, and open **Repositories** to add a folder, then **Tasks**.

| Variable                                                                                                     | For                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`                                                                                                  | The task queue (the worker and the tests)                                                                |
| `AVERO_REPOSITORY_ROOTS`                                                                                     | Folders the worker may use, separated by `;` on Windows and `:` elsewhere. Empty: no folder repositories |
| `AVERO_WORKER_CONCURRENCY`, `AVERO_WORKER_SANDBOX`, `AVERO_WORKER_GUARD`                                     | Parallel tasks; Cursor's sandbox; the command guard (on by default)                                      |
| `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_STATE_SECRET` | The GitHub App. All five, or GitHub stays off                                                            |
| `AVERO_TEST_DATABASE_URL`, `AVERO_TEST_REDIS_URL`                                                            | Run the database and queue tests against real services; unset, they are skipped                          |

`node tools/scripts/e2e-task.mjs finish|cancel|guard` runs a real task end to end against the local services.

## Everyday commands

| Task                               | Command                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| Run every check                    | `pnpm check` (lint, typecheck, test, build for all projects)        |
| One project                        | `pnpm exec nx run-many -t lint typecheck test build -p @avero/db`   |
| Only what a change affects         | `pnpm exec nx affected -t lint typecheck test build --base=main`    |
| Check workspace structure          | `pnpm verify:workspace` (projects, tags, targets, dependency edges) |
| See the dependency graph           | `pnpm exec nx graph`                                                |
| SDK checks without a model         | `pnpm verify:sdk`                                                   |
| SDK checks with Cursor credentials | `pnpm verify:sdk --live`                                            |
| Format                             | `pnpm format` / `pnpm format:check`                                 |

Builds, type checks, linting and unit tests are cached by Nx. Dev servers, database migrations, SDK sign-in, provider runs and evals are never cached.

## Tests

Unit tests use Vitest and live next to the code as `*.test.ts`. A project gets a `test` target by having a `vitest.config.ts`. Libraries import each other through `dist/`, so Nx builds dependencies before testing. In `apps/web`, `server-only` is aliased to an empty module so server modules can be tested without Next.js.

Playwright end-to-end tests arrive with Milestone 2.

## Vendored UI kit

`packages/ui/src/primitives/` is the SPEC-01 hardware kit, copied from https://spec-01.vercel.app/r/registry.json and owned by this repo. It is excluded from ESLint and Prettier, and `@avero/ui` turns off `noUncheckedIndexedAccess` for it. Edit it deliberately; re-importing overwrites local changes (text fields, stepper, wheel select, resizable and command palette were adapted).

## Boundaries

Lint enforces the dependency rules in [architecture.md](architecture.md#dependency-rules). If lint reports that a project "can only depend on libs tagged with …", the import crosses a boundary: move the shared code into a library with the right tags rather than loosening a rule.

## Troubleshooting

- **`nx build @avero/web` fails on `.next/dev/types/validator.ts` after deleting or renaming routes.** Next.js generates route types in `apps/web/.next`. Remove that folder (`rm -rf apps/web/.next`) and rebuild.
- **Line-ending warnings from Git.** `.gitattributes` normalises text files to LF. Run `git add --renormalize .` once if an old checkout shows CRLF noise.
- **Turbopack cannot reach its CSS worker in a restricted environment.** Build with `pnpm exec nx build @avero/web --webpack`.
- **A package change is not visible in the app.** Libraries are consumed from `dist/`; run the dependent target through Nx so dependencies rebuild first.
