/**
 * Index file for all TypeScript type definitions
 * This file re-exports all type definitions for easy importing
 */

// Re-export global types
/// <reference path="./global.d.ts" />
/// <reference path="./modules.d.ts" />
/// <reference path="./node.d.ts" />
/// <reference path="./utils.d.ts" />

// Export specific namespaces for direct import
export * as RefactoringToolkit from './utils';

// Common type aliases for convenience
export type {
  JSONValue,
  JSONObject,
  JSONArray,
  Result,
  ErrorLevel,
  FilePath,
  DirectoryPath,
  GlobPattern,
  NonEmptyArray,
  Optional,
  Required,
  DeepPartial,
  DeepRequired,
} from './global';

// Node.js specific exports
export type { Monorepo, Analysis, Git, CLI } from './global';

// Toolkit specific exports
export type { RefactoringToolkit as RT } from './utils';

// Utility functions for type guards
declare global {
  namespace TypeGuards {
    function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T>;
    function isJSONValue(value: unknown): value is JSONValue;
    function isResult<T>(value: unknown): value is Result<T>;
    function isFilePath(value: string): value is FilePath;
    function isDirectoryPath(value: string): value is DirectoryPath;
    function isGlobPattern(value: string): value is GlobPattern;
  }
}

// Type assertion helpers
export interface TypeAssertions {
  assertNonEmptyArray<T>(
    arr: T[],
    message?: string
  ): asserts arr is NonEmptyArray<T>;
  assertFilePath(path: string, message?: string): asserts path is FilePath;
  assertDirectoryPath(
    path: string,
    message?: string
  ): asserts path is DirectoryPath;
  assertJSONValue(value: unknown, message?: string): asserts value is JSONValue;
}

// Runtime type checking utilities
export interface TypeCheckers {
  isValidPackageName(name: string): boolean;
  isValidSemver(version: string): boolean;
  isValidFilePath(path: string): boolean;
  isValidDirectoryPath(path: string): boolean;
  isValidGlobPattern(pattern: string): boolean;
  isValidTSConfigPath(path: string): boolean;
}

// Configuration validation
export interface ConfigValidators {
  validateToolkitConfig(
    config: unknown
  ): config is RefactoringToolkit.Config.ToolkitConfig;
  validateProjectConfig(
    config: unknown
  ): config is RefactoringToolkit.Config.ProjectConfig;
  validateAnalysisConfig(
    config: unknown
  ): config is RefactoringToolkit.Config.AnalysisConfig;
  validateRefactoringConfig(
    config: unknown
  ): config is RefactoringToolkit.Config.RefactoringConfig;
  validateQualityConfig(
    config: unknown
  ): config is RefactoringToolkit.Config.QualityConfig;
  validateReportingConfig(
    config: unknown
  ): config is RefactoringToolkit.Config.ReportingConfig;
}

// Error types specific to the toolkit
export class ToolkitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ToolkitError';
  }
}

export class ValidationError extends ToolkitError {
  constructor(
    message: string,
    public readonly field: string,
    details?: any
  ) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends ToolkitError {
  constructor(
    message: string,
    public readonly configPath?: string,
    details?: any
  ) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class AnalysisError extends ToolkitError {
  constructor(
    message: string,
    public readonly file?: string,
    details?: any
  ) {
    super(message, 'ANALYSIS_ERROR', details);
    this.name = 'AnalysisError';
  }
}

export class RefactoringError extends ToolkitError {
  constructor(
    message: string,
    public readonly operation?: string,
    details?: any
  ) {
    super(message, 'REFACTORING_ERROR', details);
    this.name = 'RefactoringError';
  }
}

// Version information
export const TOOLKIT_VERSION = '1.0.0';
export const TYPESCRIPT_VERSION = '^5.0.0';
export const NODE_VERSION = '>=18.0.0';

// Feature flags for conditional compilation
declare global {
  const __DEV__: boolean;
  const __TEST__: boolean;
  const __PROD__: boolean;
  const __VERSION__: string;
  const __BUILD_TIME__: string;
}
