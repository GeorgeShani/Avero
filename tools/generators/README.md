# Nx generators

`@avero/generators` holds this workspace's own generators.

## Create a shared library

```shell
pnpm exec nx g @avero/generators:package queue-tools --type=integration --runtime=node --dependencies=contracts
pnpm install
pnpm exec nx run-many -t typecheck lint test build -p @avero/queue-tools
```

It creates `packages/queue-tools` as `@avero/queue-tools`: `package.json` with the tags the lint rules read (`scope:shared`, `type:*`, `runtime:*`), the `build` target, `tsconfig.json` and `tsconfig.build.json`, a `src/index.ts` entry point, and (unless `--no-tests`) a Vitest config with one test that only proves the package loads, which you replace.

| Option           | Values                                                     | Meaning                                                                               |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `name`           | lower-case words joined by dashes                          | The folder and the `@avero/<name>` package                                            |
| `--type`         | `util` (default), `contract`, `data-access`, `integration` | What it is for; the boundary rules use it                                             |
| `--runtime`      | `node` (default), `browser`                                | `browser` is for code safe to ship to a browser, and cannot depend on `node` packages |
| `--dependencies` | `contracts,security`                                       | Workspace packages it uses, added as `workspace:*`                                    |
| `--tests`        | `true` (default)                                           | Set up Vitest and a first test                                                        |

It refuses a bad name, a package that exists, an unknown dependency, and a `browser` package that depends on a `node` one, and reports every problem at once. `pnpm verify:workspace` also fails if any package in `packages/` is missing one of the three tags.

Applications (`apps/`) are not generated: there are few of them, and each needs choices (a framework, a port, a Dockerfile) a template cannot make. For those use Nx's own generators (`pnpm exec nx list @nx/next`, `@nx/node`) and apply the tags in [the Nx workspace guide](../../docs/nx-workspace.md).
