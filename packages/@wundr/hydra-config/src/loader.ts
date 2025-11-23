/**
 * @wundr.io/hydra-config - YAML configuration file loader
 *
 * This module provides utilities for loading and parsing YAML configuration
 * files with support for validation, schema inference, and error handling.
 */

import * as fs from 'fs';
import * as path from 'path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';

import { HydraConfigError, HydraErrorCode } from './types';

import type { ConfigGroup, ConfigDefaults } from './types';

/**
 * Options for the configuration loader.
 */
export interface LoaderOptions {
  /** Base directory for resolving relative paths */
  basePath?: string;
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
  /** Whether to throw on missing optional files */
  throwOnMissing?: boolean;
  /** Schema for validation (optional) */
  schema?: z.ZodType<unknown>;
  /** Whether to include file metadata in result */
  includeMetadata?: boolean;
}

/**
 * Result of loading a configuration file.
 */
export interface LoadResult<T = Record<string, unknown>> {
  /** Parsed configuration data */
  data: T;
  /** Absolute path to the loaded file */
  path: string;
  /** Whether the file existed */
  exists: boolean;
  /** File metadata (if includeMetadata is true) */
  metadata?: FileMetadata;
  /** Validation errors (if schema provided) */
  validationErrors?: z.ZodError;
}

/**
 * File metadata information.
 */
export interface FileMetadata {
  /** File size in bytes */
  size: number;
  /** Last modified time */
  modifiedTime: Date;
  /** File creation time */
  createdTime: Date;
}

/**
 * Configuration loader class.
 * Handles reading and parsing YAML configuration files.
 */
export class ConfigLoader {
  private readonly options: Required<LoaderOptions>;

  constructor(options: LoaderOptions = {}) {
    this.options = {
      basePath: options.basePath ?? process.cwd(),
      encoding: options.encoding ?? 'utf-8',
      throwOnMissing: options.throwOnMissing ?? true,
      schema: options.schema ?? z.record(z.unknown()),
      includeMetadata: options.includeMetadata ?? false,
    };
  }

  /**
   * Loads a single YAML configuration file.
   * @param filePath - Path to the YAML file (relative or absolute)
   * @param optional - Whether the file is optional
   * @returns LoadResult with parsed configuration
   */
  load<T = Record<string, unknown>>(
    filePath: string,
    optional = false
  ): LoadResult<T> {
    const absolutePath = this.resolvePath(filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      if (!optional && this.options.throwOnMissing) {
        throw new HydraConfigError(
          `Configuration file not found: ${absolutePath}`,
          HydraErrorCode.FILE_NOT_FOUND,
          { path: absolutePath }
        );
      }

      return {
        data: {} as T,
        path: absolutePath,
        exists: false,
      };
    }

    // Read and parse file
    const content = fs.readFileSync(absolutePath, this.options.encoding);
    let data: unknown;

    try {
      data = parseYaml(content);
    } catch (error) {
      throw new HydraConfigError(
        `Failed to parse YAML file: ${absolutePath}`,
        HydraErrorCode.PARSE_ERROR,
        {
          path: absolutePath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Ensure data is an object
    if (data === null || data === undefined) {
      data = {};
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new HydraConfigError(
        `Configuration file must contain an object: ${absolutePath}`,
        HydraErrorCode.PARSE_ERROR,
        { path: absolutePath, actualType: typeof data }
      );
    }

    // Validate against schema if provided
    const result: LoadResult<T> = {
      data: data as T,
      path: absolutePath,
      exists: true,
    };

    if (this.options.schema !== undefined) {
      const validation = this.options.schema.safeParse(data);
      if (!validation.success) {
        result.validationErrors = validation.error;
      }
    }

    // Include metadata if requested
    if (this.options.includeMetadata) {
      const stats = fs.statSync(absolutePath);
      result.metadata = {
        size: stats.size,
        modifiedTime: stats.mtime,
        createdTime: stats.birthtime,
      };
    }

    return result;
  }

  /**
   * Loads multiple configuration files and returns them as an array.
   * @param filePaths - Array of file paths to load
   * @returns Array of LoadResults
   */
  loadMultiple<T = Record<string, unknown>>(
    filePaths: Array<{ path: string; optional?: boolean }>
  ): LoadResult<T>[] {
    return filePaths.map(({ path: filePath, optional }) =>
      this.load<T>(filePath, optional)
    );
  }

  /**
   * Loads configuration defaults from a list.
   * @param defaults - Array of ConfigDefaults to load
   * @param groups - Map of group configurations
   * @returns Array of LoadResults
   */
  loadDefaults(
    defaults: ConfigDefaults[],
    groups: Record<string, ConfigGroup>
  ): LoadResult[] {
    const results: LoadResult[] = [];

    for (const defaultEntry of defaults) {
      if (defaultEntry.path !== undefined) {
        results.push(this.load(defaultEntry.path, defaultEntry.optional));
      } else if (defaultEntry.group !== undefined) {
        const group = groups[defaultEntry.group];
        if (group !== undefined) {
          results.push(
            this.load(group.path, defaultEntry.optional ?? group.optional)
          );
        } else if (!defaultEntry.optional) {
          throw new HydraConfigError(
            `Configuration group not found: ${defaultEntry.group}`,
            HydraErrorCode.MISSING_GROUP,
            { group: defaultEntry.group }
          );
        }
      }
    }

    return results;
  }

  /**
   * Loads a configuration directory.
   * Scans for .yaml and .yml files and loads them.
   * @param dirPath - Path to the configuration directory
   * @returns Map of filename to LoadResult
   */
  loadDirectory<T = Record<string, unknown>>(
    dirPath: string
  ): Map<string, LoadResult<T>> {
    const absolutePath = this.resolvePath(dirPath);

    if (!fs.existsSync(absolutePath)) {
      throw new HydraConfigError(
        `Configuration directory not found: ${absolutePath}`,
        HydraErrorCode.FILE_NOT_FOUND,
        { path: absolutePath }
      );
    }

    const stats = fs.statSync(absolutePath);
    if (!stats.isDirectory()) {
      throw new HydraConfigError(
        `Path is not a directory: ${absolutePath}`,
        HydraErrorCode.FILE_NOT_FOUND,
        { path: absolutePath }
      );
    }

    const results = new Map<string, LoadResult<T>>();
    const files = fs.readdirSync(absolutePath);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const filePath = path.join(absolutePath, file);
        const name = path.basename(file, path.extname(file));
        results.set(name, this.load<T>(filePath));
      }
    }

    return results;
  }

  /**
   * Checks if a configuration file exists.
   * @param filePath - Path to check
   * @returns True if file exists
   */
  exists(filePath: string): boolean {
    const absolutePath = this.resolvePath(filePath);
    return fs.existsSync(absolutePath);
  }

  /**
   * Resolves a path relative to the base path.
   * @param filePath - Path to resolve
   * @returns Absolute path
   */
  resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.options.basePath, filePath);
  }

  /**
   * Writes configuration to a YAML file.
   * @param filePath - Path to write to
   * @param data - Data to write
   */
  write(filePath: string, data: Record<string, unknown>): void {
    const absolutePath = this.resolvePath(filePath);
    const dir = path.dirname(absolutePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = stringifyYaml(data, {
      indent: 2,
      lineWidth: 0,
    });

    fs.writeFileSync(absolutePath, content, this.options.encoding);
  }
}

/**
 * Default loader instance.
 */
export const configLoader = new ConfigLoader();

/**
 * Convenience function to load a YAML configuration file.
 * @param filePath - Path to the YAML file
 * @param options - Loader options
 * @returns Parsed configuration
 */
export function loadConfig<T = Record<string, unknown>>(
  filePath: string,
  options: LoaderOptions = {}
): T {
  const loader = new ConfigLoader(options);
  const result = loader.load<T>(filePath);
  return result.data;
}

/**
 * Convenience function to check if a config file exists.
 * @param filePath - Path to check
 * @param basePath - Optional base path
 * @returns True if file exists
 */
export function configExists(filePath: string, basePath?: string): boolean {
  const options: LoaderOptions = {};
  if (basePath !== undefined) {
    options.basePath = basePath;
  }
  const loader = new ConfigLoader(options);
  return loader.exists(filePath);
}

/**
 * Convenience function to write configuration to YAML.
 * @param filePath - Path to write to
 * @param data - Data to write
 * @param basePath - Optional base path
 */
export function writeConfig(
  filePath: string,
  data: Record<string, unknown>,
  basePath?: string
): void {
  const options: LoaderOptions = {};
  if (basePath !== undefined) {
    options.basePath = basePath;
  }
  const loader = new ConfigLoader(options);
  loader.write(filePath, data);
}
