/**
 * @wundr/plugin-system - Plugin system and base interfaces for the Wundr platform
 */

// Types (selective exports to avoid unused warnings)
export type { PluginMetadata, PluginContext, PluginHook, PluginHookRegistry, PluginModule } from './types/index.js';

// Hook system
export * from './hooks/index.js';

// Plugin manager
export * from './manager/index.js';

// Package info
export const version = '1.0.0';
export const name = '@wundr/plugin-system';

// Re-export with aliases for convenience
import { getHookRegistry as _getHookRegistry } from './hooks/index.js';
import { WundrPluginManager } from './manager/index.js';
export { _getHookRegistry as getHookReg };
export { WundrPluginManager as PluginManager };