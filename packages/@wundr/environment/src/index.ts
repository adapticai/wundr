/**
 * @wundr/environment - Cross-platform development environment setup and management
 */

export * from './cli/commands';
export * from './core/environment-manager';
export * from './core/profile-manager';
export * from './core/tool-manager';
export * from './installers';
export * from './validators';
export * from './types';

// Re-export with alias for convenience
import { EnvironmentManager as _EnvironmentManager } from './core/environment-manager';
export { _EnvironmentManager as EnvManager };