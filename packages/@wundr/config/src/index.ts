/**
 * @wundr/config - Configuration management and validation for the Wundr platform
 */

// Types
export * from './types/index.js';

// Sources
export * from './sources/index.js';

// Manager
export * from './manager/index.js';

// Package info
export const version = '1.0.0';
export const name = '@wundr/config';

// Convenience exports
export { WundrConfigManager as ConfigManager } from './manager/index.js';
export { JsonConfigSource, YamlConfigSource, EnvConfigSource, MemoryConfigSource } from './sources/index.js';