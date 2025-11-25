import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace configuration for Genesis App monorepo.
 *
 * Defines separate test workspaces for each package/app with
 * appropriate configurations for their specific environments.
 */
export default defineWorkspace([
  // UI Component Library - React/jsdom environment
  {
    extends: './packages/@genesis/ui/vitest.config.ts',
    test: {
      name: '@genesis/ui',
      root: './packages/@genesis/ui',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  },

  // Database Package - Node environment
  {
    extends: './packages/@genesis/database/vitest.config.ts',
    test: {
      name: '@genesis/database',
      root: './packages/@genesis/database',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  },

  // Web Application - Next.js environment
  {
    extends: './apps/web/vitest.config.ts',
    test: {
      name: '@genesis/web',
      root: './apps/web',
      include: ['**/*.{test,spec}.{ts,tsx}'],
      exclude: ['**/node_modules/**', '**/.next/**'],
    },
  },
]);
