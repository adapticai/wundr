/**
 * @fileoverview Web client package entry point
 * This package provides shared web components and utilities.
 */

// Export all components
export * from './components';

// Export hooks (excluding Theme to avoid conflict)
export { useDebounce, useLocalStorage, useTheme } from './hooks';
export type { UseThemeReturn } from './hooks';

// Export all utilities
export * from './utils';
