import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    // SQLite cannot handle concurrent writes from multiple test files;
    // run test files sequentially to avoid "Operation has timed out" errors.
    fileParallelism: false,
  },
});
