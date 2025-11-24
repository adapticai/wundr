import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @genesis/ui package.
 *
 * Configured for React component testing with:
 * - jsdom environment for DOM simulation
 * - React Testing Library integration
 * - CSS handling for styled components
 */
export default defineConfig({
  plugins: [react()],

  test: {
    // Use jsdom for DOM testing
    environment: 'jsdom',

    // Enable globals for expect, describe, it, etc.
    globals: true,

    // Setup files for test environment
    setupFiles: ['./src/__tests__/setup.ts'],

    // Include patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Exclude patterns
    exclude: ['**/node_modules/**', '**/dist/**'],

    // CSS handling
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },

    // Coverage settings specific to UI package
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/index.ts',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
      ],
    },

    // Test timeout
    testTimeout: 5000,

    // Reporter
    reporters: ['verbose'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/components': path.resolve(__dirname, 'src/components'),
    },
  },
});
