/**
 * @wundr.io/hydra-config - Type definitions for Hydra-style configuration
 *
 * This module provides TypeScript interfaces and Zod schemas for hierarchical
 * configuration composition following the Hydra pattern.
 */

import { z } from 'zod';

/**
 * Represents a group of related configuration options.
 * Groups allow organizing configuration into logical sections.
 */
export interface ConfigGroup {
  /** Unique identifier for the configuration group */
  name: string;
  /** Optional description of the group's purpose */
  description?: string;
  /** Path to the YAML file containing this group's defaults */
  path: string;
  /** Whether this group is required or optional */
  optional?: boolean;
  /** Configuration values loaded from the YAML file */
  values: Record<string, unknown>;
}

/**
 * Main Hydra configuration structure.
 * Defines how configuration is composed from multiple sources.
 */
export interface HydraConfig {
  /** Base configuration directory path */
  configPath: string;
  /** Default configuration values applied before any overrides */
  defaults: ConfigDefaults[];
  /** Configuration groups available for composition */
  groups: Record<string, ConfigGroup>;
  /** CLI argument overrides (e.g., key=value pairs) */
  overrides?: Record<string, unknown>;
  /** Environment variable prefix for config resolution */
  envPrefix?: string;
  /** Whether to allow undefined interpolation variables */
  strictMode?: boolean;
}

/**
 * Represents a default configuration entry in the defaults list.
 * Each entry can be a simple path or a group-specific override.
 */
export interface ConfigDefaults {
  /** Simple default: path to config file */
  path?: string;
  /** Group reference with optional variant selection */
  group?: string;
  /** Specific variant within a group */
  variant?: string;
  /** Whether this default is optional (won't error if missing) */
  optional?: boolean;
}

/**
 * The final composed configuration after all merging and interpolation.
 */
export interface ComposedConfig<T = Record<string, unknown>> {
  /** The final merged configuration values */
  config: T;
  /** List of sources that contributed to this configuration */
  sources: ConfigSource[];
  /** Any warnings generated during composition */
  warnings: string[];
  /** Interpolation variables that were resolved */
  resolvedInterpolations: Map<string, unknown>;
}

/**
 * Tracks which configuration file contributed to the final config.
 */
export interface ConfigSource {
  /** Path to the configuration file */
  path: string;
  /** Type of source (file, defaults, override, env) */
  type: 'file' | 'defaults' | 'override' | 'env';
  /** Order in which this source was applied */
  order: number;
}

/**
 * Options for the configuration composer.
 */
export interface ComposerOptions {
  /** Base directory for relative config paths */
  basePath: string;
  /** Whether to throw on missing optional configs */
  throwOnMissing?: boolean;
  /** Environment variable prefix (default: 'HYDRA_') */
  envPrefix?: string;
  /** Enable strict interpolation mode */
  strictInterpolation?: boolean;
  /** Custom interpolation resolvers */
  customResolvers?: Record<string, InterpolationResolver>;
}

/**
 * Function type for custom interpolation resolvers.
 */
export type InterpolationResolver = (
  key: string,
  context: Record<string, unknown>
) => unknown;

/**
 * Result of parsing CLI overrides.
 */
export interface ParsedOverrides {
  /** Key-value pairs parsed from CLI arguments */
  overrides: Record<string, unknown>;
  /** Multi-run sweep configurations */
  sweeps: SweepConfig[];
  /** Group selections from CLI */
  groupSelections: GroupSelection[];
}

/**
 * Configuration for multi-run parameter sweeps.
 */
export interface SweepConfig {
  /** Parameter key to sweep */
  key: string;
  /** Values to sweep over */
  values: unknown[];
  /** Sweep type: grid or random */
  type: 'grid' | 'random';
}

/**
 * Group selection from CLI arguments.
 */
export interface GroupSelection {
  /** Group name */
  group: string;
  /** Selected variant */
  variant: string;
}

/**
 * Error thrown during configuration composition.
 */
export class HydraConfigError extends Error {
  constructor(
    message: string,
    public readonly code: HydraErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HydraConfigError';
  }
}

/**
 * Error codes for configuration errors.
 */
export enum HydraErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  INTERPOLATION_ERROR = 'INTERPOLATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  MISSING_GROUP = 'MISSING_GROUP',
  INVALID_OVERRIDE = 'INVALID_OVERRIDE',
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

/**
 * Zod schema for ConfigDefaults validation.
 */
export const ConfigDefaultsSchema = z.object({
  path: z.string().optional(),
  group: z.string().optional(),
  variant: z.string().optional(),
  optional: z.boolean().optional(),
});

/**
 * Zod schema for ConfigGroup validation.
 */
export const ConfigGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  path: z.string().min(1),
  optional: z.boolean().optional(),
  values: z.record(z.unknown()),
});

/**
 * Zod schema for HydraConfig validation.
 */
export const HydraConfigSchema = z.object({
  configPath: z.string().min(1),
  defaults: z.array(ConfigDefaultsSchema),
  groups: z.record(ConfigGroupSchema),
  overrides: z.record(z.unknown()).optional(),
  envPrefix: z.string().optional(),
  strictMode: z.boolean().optional(),
});

/**
 * Zod schema for ComposerOptions validation.
 */
export const ComposerOptionsSchema = z.object({
  basePath: z.string().min(1),
  throwOnMissing: z.boolean().optional(),
  envPrefix: z.string().optional(),
  strictInterpolation: z.boolean().optional(),
  customResolvers: z.record(z.function()).optional(),
});

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a ConfigGroup.
 */
export function isConfigGroup(value: unknown): value is ConfigGroup {
  return ConfigGroupSchema.safeParse(value).success;
}

/**
 * Type guard to check if a value is a HydraConfig.
 */
export function isHydraConfig(value: unknown): value is HydraConfig {
  return HydraConfigSchema.safeParse(value).success;
}
