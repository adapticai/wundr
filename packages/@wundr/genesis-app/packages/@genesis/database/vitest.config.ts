import path from 'path';

import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @genesis/database package.
 *
 * Configured for Node.js database testing with:
 * - Node environment for Prisma client
 * - Mock database setup
 * - Integration test support
 */
export default defineConfig({
  test: {
    // Use Node environment for database operations
    environment: 'node',

    // Enable globals
    globals: true,

    // Setup files for test environment (mocks, etc.)
    setupFiles: ['./src/__tests__/setup.ts'],

    // Include patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Exclude patterns
    exclude: ['**/node_modules/**', '**/dist/**', '**/prisma/**'],

    // Coverage settings
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/index.ts', '**/__tests__/**', '**/*.test.ts', '**/*.d.ts'],
    },

    // Longer timeout for database operations
    testTimeout: 30000,

    // Hooks timeout for database setup/teardown
    hookTimeout: 30000,

    // Reporter
    reporters: ['verbose'],

    // Sequence configuration for database tests
    sequence: {
      // Run tests sequentially to avoid database conflicts
      shuffle: false,
    },

    // Pool options - use forks for isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
