/**
 * @wundr.io/hydra-config - Hydra-style hierarchical configuration composition
 *
 * This package provides a configuration management system inspired by Facebook's
 * Hydra framework, enabling hierarchical configuration composition from multiple
 * sources with support for:
 *
 * - YAML configuration files
 * - Configuration groups and variants
 * - Variable interpolation (${...} references)
 * - CLI argument overrides
 * - Environment variable resolution
 * - Deep merging with configurable strategies
 * - Zod schema validation
 *
 * @example
 * ```typescript
 * import { ConfigComposer, createComposer, composeConfig } from '@wundr.io/hydra-config';
 *
 * // Simple usage
 * const result = composeConfig('./config/hydra.yaml', ['db=mysql', 'debug=true']);
 * console.log(result.config);
 *
 * // Advanced usage with composer instance
 * const composer = createComposer({
 *   basePath: './config',
 *   strictInterpolation: true,
 * });
 *
 * const hydraConfig = composer.loadHydraConfig('./hydra.yaml');
 * const composed = composer.compose(hydraConfig, process.argv.slice(2));
 * ```
 *
 * @packageDocumentation
 */

// Re-export all types
export * from './types';

// Re-export composer
export { ConfigComposer, createComposer, composeConfig } from './composer';

// Re-export loader
export {
  ConfigLoader,
  configLoader,
  loadConfig,
  configExists,
  writeConfig,
  type LoaderOptions,
  type LoadResult,
  type FileMetadata,
} from './loader';

// Re-export interpolation
export {
  interpolationResolver,
  resolveInterpolations,
  hasInterpolations,
  extractInterpolations,
  type InterpolationOptions,
  type InterpolationResult,
} from './interpolation';

// Re-export defaults
export {
  DefaultsManager,
  defaultsManager,
  mergeDefaults,
  type DefaultsOptions,
  type MergeStrategy,
} from './defaults';

// Default export for convenience
export { ConfigComposer as default } from './composer';
