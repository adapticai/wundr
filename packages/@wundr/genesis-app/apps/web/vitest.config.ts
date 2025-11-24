import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @genesis/web Next.js application.
 *
 * Configured for Next.js testing with:
 * - React Testing Library support
 * - Path alias resolution matching tsconfig
 * - jsdom environment for component testing
 */
export default defineConfig({
  plugins: [react()],

  test: {
    // Use jsdom for component testing
    environment: 'jsdom',

    // Enable globals
    globals: true,

    // Setup files
    setupFiles: ['./__tests__/setup.tsx'],

    // Include patterns
    include: [
      '**/*.{test,spec}.{ts,tsx}',
      '__tests__/**/*.{test,spec}.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],

    // CSS handling
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },

    // Coverage settings
    coverage: {
      provider: 'v8',
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/layout.tsx',
        '**/loading.tsx',
        '**/error.tsx',
        '**/not-found.tsx',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
      ],
    },

    // Test timeout
    testTimeout: 10000,

    // Reporter
    reporters: ['verbose'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@/components': path.resolve(__dirname, 'components'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/hooks': path.resolve(__dirname, 'hooks'),
      '@/styles': path.resolve(__dirname, 'styles'),
      '@/types': path.resolve(__dirname, 'types'),
    },
  },
});
