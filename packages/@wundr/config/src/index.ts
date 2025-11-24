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

// Re-export with aliases for convenience
import { WundrConfigManager } from './manager/index.js';
import { JsonConfigSource, YamlConfigSource, EnvConfigSource, MemoryConfigSource } from './sources/index.js';
export { WundrConfigManager as ConfigManager };
export { JsonConfigSource as JsonSource, YamlConfigSource as YamlSource, EnvConfigSource as EnvSource, MemoryConfigSource as MemorySource };