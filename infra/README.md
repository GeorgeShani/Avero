# Local infrastructure

From the Avero root, start and verify the PostgreSQL and Redis containers.

```shell
pnpm infra:up
pnpm infra:verify
```

Compose publishes both services on loopback and stores their data in named volumes. `pnpm infra:down` stops the stack and preserves those volumes.

| Service    | Local endpoint                                         |
| ---------- | ------------------------------------------------------ |
| PostgreSQL | `postgresql://avero:avero-local@127.0.0.1:55432/avero` |
| Redis      | `redis://127.0.0.1:56379`                              |

Set the host ports and the development database password in the root `.env` if needed. Update `DATABASE_URL` to match. PostgreSQL uses its initialization password when it creates a fresh volume.

## Application images

Use the workspace root as the build context for both images.

```shell
docker build -f infra/Dockerfile.web -t avero-web .
docker build -f infra/Dockerfile.worker -t avero-worker .
```

The web image runs Next.js standalone on port 3000. Inject the Clerk keys, `AVERO_APP_URL`, and a container-reachable `DATABASE_URL` at runtime to enable workspaces. The worker image starts the compiled Node.js process and probes its internal `/healthz` endpoint. Both images run as a non-root user.
