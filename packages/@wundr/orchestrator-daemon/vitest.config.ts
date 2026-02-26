import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const localWorkers = Math.max(4, Math.min(16, os.cpus().length));
const ciWorkers = 3;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  test: {
    // ---------------------------------------------------------------------------
    // General
    // ---------------------------------------------------------------------------
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,

    // Use forks for process isolation -- auth/crypto tests that mutate
    // process.env or use timingSafeEqual need separate processes.
    pool: 'forks',
    maxWorkers: isCI ? ciWorkers : localWorkers,

    // ---------------------------------------------------------------------------
    // File patterns
    // ---------------------------------------------------------------------------
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: [
      'dist/**',
      'node_modules/**',
      '**/*.example.ts',
      '**/*.live.test.ts',
      '**/*.e2e.test.ts',
    ],

    // ---------------------------------------------------------------------------
    // Setup
    // ---------------------------------------------------------------------------
    setupFiles: ['src/__tests__/helpers/setup.ts'],

    // ---------------------------------------------------------------------------
    // Coverage (v8 provider, aligned with OpenClaw's approach)
    // ---------------------------------------------------------------------------
    coverage: {
      provider: 'v8',
      enabled: false, // Enable via --coverage flag or test:coverage script
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',

      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },

      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/bin/**',
        'src/**/examples/**',
        'src/**/*.example.ts',
        'src/__tests__/**',
      ],
    },

    // ---------------------------------------------------------------------------
    // Reporter
    // ---------------------------------------------------------------------------
    reporters: isCI ? ['verbose', 'junit'] : ['verbose'],
    ...(isCI && {
      outputFile: {
        junit: './test-results.xml',
      },
    }),
  },
});
