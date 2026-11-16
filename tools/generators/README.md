# Nx generators

Use Nx's installed generators for new apps and shared packages. Inspect the generator options before adding a project.

```shell
pnpm exec nx list @nx/next
pnpm exec nx list @nx/node
pnpm exec nx list @nx/js
```

Place application packages in `apps/` and shared packages in `packages/`. Keep the `@avero/` naming convention, declare workspace dependencies with `workspace:*`, and apply the project tags documented in [the Nx workspace guide](../../docs/nx-workspace.md).
