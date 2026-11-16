# Nx workspace

pnpm links the private workspace packages. Nx discovers projects from the package manifests and follows their declared dependencies. Next.js, ESLint, and Vitest targets are inferred. The Node.js worker and TypeScript libraries use explicit package scripts.

| Application            | Workspace dependencies                                      |
| ---------------------- | ----------------------------------------------------------- |
| `@avero/web`           | `@avero/contracts`, `@avero/ui`                             |
| `@avero/worker`        | `@avero/config`, `@avero/contracts`, `@avero/observability` |
| `@avero/agent-service` | `@avero/contracts`                                          |

`@avero/coding-engine` owns the Cursor TypeScript SDK prototype. `@avero/db`, `@avero/github`, and `@avero/security` provide PostgreSQL URL validation, GitHub repository slug validation, and explicit secret redaction respectively. The worker currently exposes process liveness. Queue processing and persistent storage begin in later milestones.

Workspace libraries expose compiled exports from `dist/`. Nx builds dependencies first for builds, type checks, tests, and development servers. Use package names in imports and Nx commands. The ESLint boundary rules enforce shared-library isolation, keep Node-only libraries out of browser-safe projects, and limit the agent service to shared contracts.

Builds, type checks, linting, and unit tests are cacheable. Process startup, SDK sign-in, provider runs, and model-based evals execute on demand.

## Verify

```shell
pnpm exec nx run-many -t lint typecheck test build
pnpm exec nx test @avero/contracts
pnpm exec nx show project @avero/web
pnpm exec nx show project @avero/worker
pnpm exec nx show project @avero/agent-service
pnpm exec nx graph
```

With the workspace dependencies installed, Nx 24.0.6 discovered 11 projects and six workspace dependency edges. The worker, agent service, and shared package builds passed, and Vitest 5.1.0 passed all nine unit tests. Use `pnpm install --frozen-lockfile` to install from the generated lockfile.

If Turbopack cannot connect to its CSS worker in a restricted environment, build the web app through Nx with Webpack.

```shell
pnpm exec nx build @avero/web --webpack
```
