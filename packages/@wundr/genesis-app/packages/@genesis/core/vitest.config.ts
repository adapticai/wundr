import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/services/__tests__/**/*.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/test-utils/**',
        '**/setup.ts',
        'vitest.config.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 10000,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@genesis/database': path.resolve(__dirname, '../database/src'),
      '@genesis/api-types': path.resolve(__dirname, '../api-types/src'),
    },
  },
});
