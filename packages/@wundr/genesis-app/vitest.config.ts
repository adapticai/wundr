import path from 'path';

import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration for Genesis App monorepo.
 *
 * This configuration provides:
 * - Workspace-based test organization
 * - Global coverage settings
 * - Shared test utilities
 */
export default defineConfig({
  test: {
    // Use workspace configuration for multi-package testing
    workspace: './vitest.workspace.ts',

    // Global test settings
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      enabled: false, // Enable via --coverage flag
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',

      // Coverage thresholds
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },

      // Files to include in coverage
      include: [
        'packages/**/src/**/*.{ts,tsx}',
        'apps/**/src/**/*.{ts,tsx}',
        'apps/**/app/**/*.{ts,tsx}',
      ],

      // Files to exclude from coverage
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/index.ts',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/test/**',
        '**/mocks/**',
      ],
    },

    // Test file patterns
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Reporter configuration
    reporters: ['verbose'],

    // Test timeout
    testTimeout: 10000,

    // Retry failed tests
    retry: 0,

    // Pool options for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },

  // Resolve configuration for path aliases
  resolve: {
    alias: {
      '@genesis/ui': path.resolve(__dirname, 'packages/@genesis/ui/src'),
      '@genesis/database': path.resolve(
        __dirname,
        'packages/@genesis/database/src'
      ),
    },
  },
});
