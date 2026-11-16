import { runCommand } from './run-command.mjs';

const compose = ['compose', '--project-directory', '.', '-f', 'infra/docker-compose.yml'];
runCommand('docker', [...compose, 'config', '--quiet']);
runCommand('docker', [
  ...compose,
  'exec',
  '-T',
  'postgres',
  'sh',
  '-ec',
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -XAtq -v ON_ERROR_STOP=1 -c "SELECT 1"',
]);
runCommand('docker', [
  ...compose,
  'exec',
  '-T',
  'redis',
  'sh',
  '-ec',
  'test "$(redis-cli --raw ping)" = PONG',
]);
console.log('PostgreSQL executed SELECT 1 and Redis returned PONG.');
