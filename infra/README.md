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

Use the workspace root as the build context for all three images.

```shell
docker build -f infra/Dockerfile.web -t avero-web .
docker build -f infra/Dockerfile.worker -t avero-worker .
docker build -f infra/Dockerfile.agent-service -t avero-agent-service .
```

The web image runs Next.js standalone on port 3000. The worker image has `git`, starts the compiled Node.js process and probes its internal `/healthz`; it also carries the migrator (`node node_modules/@avero/db/dist/migrate-cli.js`). The agent-service image serves the Agent SDK project on port 3102 and refuses to start without `AVERO_AGENT_TOKEN`. All three run as a non-root user.

`docker-compose.prod.yml` runs the three images with PostgreSQL and Redis on one host. Releases, configuration and rollback are in [docs/deployment.md](../docs/deployment.md).
