/**
 * @wundr.io/hydra-config - Configuration composer
 *
 * This module provides the main ConfigComposer class that orchestrates
 * hierarchical configuration composition following the Hydra pattern.
 */

import { DefaultsManager } from './defaults';
import { InterpolationResolver as InterpolationResolverUtil } from './interpolation';
import { ConfigLoader } from './loader';
import {
  HydraConfigError,
  HydraErrorCode,
  type ComposerOptions,
  type ComposedConfig,
  type ConfigSource,
  type HydraConfig,
  type ParsedOverrides,
  type GroupSelection,
  type SweepConfig,
  type SweepValue,
  type CliOverrideValue,
  type ConfigGroup,
  ComposerOptionsSchema,
} from './types';

import type { z } from 'zod';

/**
 * CLI override patterns.
 */
const CLI_OVERRIDE_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*(.+)$/;
const GROUP_SELECTION_PATTERN =
  /^([a-zA-Z_][a-zA-Z0-9_]*)\/([a-zA-Z_][a-zA-Z0-9_]*)$/;
const SWEEP_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*\[(.+)\]$/;

/**
 * Configuration composer class.
 * Orchestrates loading, merging, and resolving hierarchical configuration.
 */
export class ConfigComposer {
  private readonly loader: ConfigLoader;
  private readonly interpolator: InterpolationResolverUtil;
  private readonly defaults: DefaultsManager;
  private readonly options: Required<ComposerOptions>;
  private readonly sources: ConfigSource[] = [];
  private sourceOrder = 0;

  constructor(options: ComposerOptions) {
    // Validate options
    const validation = ComposerOptionsSchema.safeParse(options);
    if (!validation.success) {
      throw new HydraConfigError(
        'Invalid composer options',
        HydraErrorCode.VALIDATION_ERROR,
        { errors: validation.error.errors }
      );
    }

    this.options = {
      basePath: options.basePath,
      throwOnMissing: options.throwOnMissing ?? true,
      envPrefix: options.envPrefix ?? 'HYDRA_',
      strictInterpolation: options.strictInterpolation ?? false,
      customResolvers: options.customResolvers ?? {},
    };

    this.loader = new ConfigLoader({
      basePath: this.options.basePath,
      throwOnMissing: this.options.throwOnMissing,
    });

    this.interpolator = new InterpolationResolverUtil({
      strict: this.options.strictInterpolation,
      resolvers: this.options.customResolvers,
    });

    this.defaults = new DefaultsManager();
  }

  /**
   * Composes a configuration from multiple sources.
   * @param hydraConfig - Hydra configuration defining composition
   * @param cliArgs - Optional CLI arguments for overrides
   * @returns Composed configuration with metadata
   */
  compose<T = Record<string, unknown>>(
    hydraConfig: HydraConfig,
    cliArgs: string[] = []
  ): ComposedConfig<T> {
    this.sources.length = 0;
    this.sourceOrder = 0;

    const warnings: string[] = [];
    const configs: Record<string, unknown>[] = [];

    // Parse CLI arguments
    const parsedOverrides = this.parseCliOverrides(cliArgs);

    // Apply group selections from CLI
    const effectiveGroups = this.applyGroupSelections(
      hydraConfig.groups,
      parsedOverrides.groupSelections
    );

    // Load defaults in order
    const defaultsOrder = this.defaults.resolveDefaultsOrder({
      ...hydraConfig,
      groups: effectiveGroups,
    });

    for (const { path, optional } of defaultsOrder) {
      try {
        const result = this.loader.load(path, optional);
        if (result.exists) {
          configs.push(result.data);
          this.addSource(result.path, 'defaults');
        } else if (!optional) {
          warnings.push(`Optional config not found: ${path}`);
        }
      } catch (error) {
        if (!optional) {
          throw error;
        }
        warnings.push(
          `Failed to load optional config: ${path} - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Apply Hydra config overrides
    if (hydraConfig.overrides !== undefined) {
      configs.push(hydraConfig.overrides);
      this.addSource('hydra:overrides', 'override');
    }

    // Apply environment variable overrides
    const envOverrides = this.resolveEnvOverrides(hydraConfig.envPrefix);
    if (Object.keys(envOverrides).length > 0) {
      configs.push(envOverrides);
      this.addSource('env', 'env');
    }

    // Apply CLI overrides
    if (Object.keys(parsedOverrides.overrides).length > 0) {
      configs.push(parsedOverrides.overrides);
      this.addSource('cli', 'override');
    }

    // Merge all configs
    const mergedConfig = this.defaults.mergeConfigs(configs);

    // Resolve interpolations
    const interpolationResult = this.resolveInterpolations(mergedConfig);
    if (!interpolationResult.complete) {
      if (this.options.strictInterpolation) {
        throw new HydraConfigError(
          `Unresolved interpolations: ${interpolationResult.unresolved.join(', ')}`,
          HydraErrorCode.INTERPOLATION_ERROR,
          { unresolved: interpolationResult.unresolved }
        );
      }
      warnings.push(
        `Unresolved interpolations: ${interpolationResult.unresolved.join(', ')}`
      );
    }

    return {
      config: interpolationResult.value as T,
      sources: [...this.sources],
      warnings,
      resolvedInterpolations: interpolationResult.resolved,
    };
  }

  /**
   * Parses CLI override arguments into structured format.
   * @param args - CLI argument strings
   * @returns Parsed overrides structure
   */
  parseCliOverrides(args: string[]): ParsedOverrides {
    const overrides: Record<string, CliOverrideValue> = {};
    const sweeps: SweepConfig[] = [];
    const groupSelections: GroupSelection[] = [];

    for (const arg of args) {
      // Check for group selection (e.g., db/mysql)
      const groupMatch = arg.match(GROUP_SELECTION_PATTERN);
      if (groupMatch !== null) {
        groupSelections.push({
          group: groupMatch[1] as string,
          variant: groupMatch[2] as string,
        });
        continue;
      }

      // Check for sweep syntax (e.g., learning_rate=[0.1,0.01,0.001])
      const sweepMatch = arg.match(SWEEP_PATTERN);
      if (sweepMatch !== null) {
        const values = (sweepMatch[2] as string)
          .split(',')
          .map(v => this.parseValue(v.trim()));
        sweeps.push({
          key: sweepMatch[1] as string,
          values,
          type: 'grid',
        });
        continue;
      }

      // Check for key=value override
      const overrideMatch = arg.match(CLI_OVERRIDE_PATTERN);
      if (overrideMatch !== null) {
        const key = overrideMatch[1] as string;
        const value = this.parseValue(overrideMatch[2] as string);
        this.setNestedValue(overrides, key, value);
        continue;
      }
    }

    return { overrides, sweeps, groupSelections };
  }

  /**
   * Resolves interpolations in a configuration object.
   * @param config - Configuration with interpolations
   * @returns Interpolation result
   */
  resolveInterpolations(config: Record<string, unknown>): {
    value: Record<string, unknown>;
    resolved: Map<string, unknown>;
    unresolved: string[];
    complete: boolean;
  } {
    const result = this.interpolator.resolve(config);
    return {
      value: result.value as Record<string, unknown>,
      resolved: result.resolved,
      unresolved: result.unresolved,
      complete: result.complete,
    };
  }

  /**
   * Applies group selections from CLI to available groups.
   * @param groups - Available configuration groups
   * @param selections - Group selections from CLI
   * @returns Updated groups with selections applied
   */
  private applyGroupSelections(
    groups: Record<string, ConfigGroup>,
    selections: GroupSelection[]
  ): Record<string, ConfigGroup> {
    const result = { ...groups };

    for (const selection of selections) {
      const baseGroup = groups[selection.group];
      if (baseGroup !== undefined) {
        // Update the group path to point to the variant
        const variantPath = baseGroup.path.replace(
          /\/[^/]+\.ya?ml$/,
          `/${selection.variant}.yaml`
        );
        result[selection.group] = {
          ...baseGroup,
          path: variantPath,
        };
      }
    }

    return result;
  }

  /**
   * Resolves environment variable overrides.
   * @param prefix - Environment variable prefix
   * @returns Parsed environment overrides
   */
  private resolveEnvOverrides(
    prefix = this.options.envPrefix
  ): Record<string, CliOverrideValue> {
    const overrides: Record<string, CliOverrideValue> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value !== undefined) {
        // Convert HYDRA_FOO_BAR to foo.bar
        const configKey = key
          .slice(prefix.length)
          .toLowerCase()
          .replace(/_/g, '.');
        this.setNestedValue(overrides, configKey, this.parseValue(value));
      }
    }

    return overrides;
  }

  /**
   * Parses a string value into its appropriate type.
   * @param value - String value to parse
   * @returns Parsed value as a SweepValue (string, number, boolean, or null)
   */
  private parseValue(value: string): SweepValue {
    const trimmed = value.trim();

    // Boolean
    if (trimmed === 'true') {
      return true;
    }
    if (trimmed === 'false') {
      return false;
    }

    // Null
    if (trimmed === 'null' || trimmed === 'none') {
      return null;
    }

    // Number
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') {
      return num;
    }

    // Quoted string - remove quotes
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    // Plain string
    return trimmed;
  }

  /**
   * Sets a nested value using dot notation.
   * @param obj - Target object
   * @param path - Dot-notation path
   * @param value - Value to set
   */
  private setNestedValue(
    obj: Record<string, CliOverrideValue>,
    path: string,
    value: SweepValue
  ): void {
    const parts = path.split('.');
    let current: Record<string, CliOverrideValue> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i] as string;
      const existing = current[part];
      if (
        existing === undefined ||
        typeof existing !== 'object' ||
        existing === null
      ) {
        const newObj: Record<string, CliOverrideValue> = {};
        current[part] = newObj;
        current = newObj;
      } else {
        current = existing as Record<string, CliOverrideValue>;
      }
    }

    const lastPart = parts[parts.length - 1] as string;
    current[lastPart] = value;
  }

  /**
   * Adds a source to the tracking list.
   * @param path - Source path
   * @param type - Source type
   */
  private addSource(path: string, type: ConfigSource['type']): void {
    this.sources.push({
      path,
      type,
      order: this.sourceOrder++,
    });
  }

  /**
   * Validates composed configuration against a schema.
   * @param config - Configuration to validate
   * @param schema - Zod schema for validation
   * @returns Validated configuration
   */
  validate<T>(config: unknown, schema: z.ZodType<T>): T {
    const result = schema.safeParse(config);
    if (!result.success) {
      throw new HydraConfigError(
        'Configuration validation failed',
        HydraErrorCode.VALIDATION_ERROR,
        { errors: result.error.errors }
      );
    }
    return result.data;
  }

  /**
   * Creates a HydraConfig from a config path.
   * @param configPath - Path to the hydra configuration
   * @returns HydraConfig object
   */
  loadHydraConfig(configPath: string): HydraConfig {
    const result = this.loader.load<HydraConfig>(configPath);

    const config: HydraConfig = {
      configPath: result.path,
      defaults: result.data.defaults ?? [],
      groups: result.data.groups ?? {},
      envPrefix: result.data.envPrefix ?? this.options.envPrefix,
      strictMode: result.data.strictMode ?? this.options.strictInterpolation,
    };

    if (result.data.overrides !== undefined) {
      config.overrides = result.data.overrides;
    }

    return config;
  }
}

/**
 * Creates a ConfigComposer instance with the specified options.
 * @param options - Composer options
 * @returns ConfigComposer instance
 */
export function createComposer(options: ComposerOptions): ConfigComposer {
  return new ConfigComposer(options);
}

/**
 * Convenience function to compose configuration from a Hydra config file.
 * @param configPath - Path to Hydra configuration file
 * @param cliArgs - Optional CLI arguments
 * @param options - Additional composer options
 * @returns Composed configuration
 */
export function composeConfig<T = Record<string, unknown>>(
  configPath: string,
  cliArgs: string[] = [],
  options: Partial<ComposerOptions> = {}
): ComposedConfig<T> {
  const basePath = options.basePath ?? process.cwd();
  const composer = new ConfigComposer({ ...options, basePath });
  const hydraConfig = composer.loadHydraConfig(configPath);
  return composer.compose<T>(hydraConfig, cliArgs);
}
