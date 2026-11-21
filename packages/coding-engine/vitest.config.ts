import { defineConfig } from 'vitest/config';

// Some tests start real child processes (the command guard's hook script, git). On a busy machine
// (every project's tests running at once) that takes longer than Vitest's 5 seconds.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 },
});
