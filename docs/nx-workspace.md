# Nx workspace

pnpm links the private workspace packages. Nx discovers projects from the package manifests and follows their declared dependencies. Next.js, ESLint, and Vitest targets are inferred. The Node.js worker and TypeScript libraries use explicit package scripts.

| Application            | Workspace dependencies                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `@avero/web`           | `@avero/config`, `@avero/contracts`, `@avero/db`, `@avero/observability`, `@avero/security`, `@avero/ui` |
| `@avero/worker`        | `@avero/config`, `@avero/contracts`, `@avero/observability`                                              |
| `@avero/agent-service` | `@avero/contracts`                                                                                       |

`@avero/coding-engine` owns the Cursor TypeScript SDK prototype. `@avero/db` owns the platform schema and workspace queries. `@avero/security` defines workspace edit permissions and secret redaction. `@avero/github` provides GitHub repository slug validation. The worker currently exposes process liveness.

Workspace libraries expose compiled exports from `dist/`. Nx builds dependencies first for builds, type checks, tests, and development servers. Use package names in imports and Nx commands. The ESLint boundary rules enforce shared-library isolation, restrict the web app's Node-only imports to its server modules and proxy, and limit the agent service to shared contracts.

Builds, type checks, linting, and unit tests are cacheable. Process startup, SDK sign-in, provider runs, and model-based evals execute on demand.

## Verify

```shell
pnpm exec nx run-many -t lint typecheck test build
pnpm exec nx test @avero/contracts
pnpm exec nx show project @avero/web
pnpm exec nx show project @avero/worker
pnpm exec nx show project @avero/agent-service
pnpm verify:workspace
```

Use `pnpm install --frozen-lockfile` to install from the generated lockfile. The workspace verification command checks the current Nx project graph against the expected projects, targets, and dependency edges.

If Turbopack cannot connect to its CSS worker in a restricted environment, build the web app through Nx with Webpack.

```shell
pnpm exec nx build @avero/web --webpack
```
