import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    reporters: ['default'],
    restoreMocks: true,
    clearMocks: true,
    // Keep it maximally deterministic/stable in CI (and avoids worker-pool issues in some envs).
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    maxConcurrency: 1,
  },
});


