/**
 * Package Template - Main Entry Point
 * 
 * This is the main entry point for a monorepo package. It demonstrates
 * best practices for package structure, exports, and public API design.
 * 
 * @packageDocumentation
 */

// Core types and interfaces
export interface PackageConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
}

export interface PackageMetadata {
  buildTime: string;
  gitCommit?: string;
  environment: 'development' | 'production' | 'test';
}

// Core functionality
export class PackageCore {
  private readonly config: PackageConfig;
  private readonly metadata: PackageMetadata;

  constructor(config: PackageConfig) {
    this.config = { ...config };
    this.metadata = {
      buildTime: new Date().toISOString(),
      gitCommit: process.env.GIT_COMMIT,
      environment: (process.env.NODE_ENV as any) || 'development',
    };
  }

  /**
   * Get package information
   */
  public getInfo(): PackageConfig & { metadata: PackageMetadata } {
    return {
      ...this.config,
      metadata: { ...this.metadata },
    };
  }

  /**
   * Get package version
   */
  public getVersion(): string {
    return this.config.version;
  }

  /**
   * Get package name
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * Check if package is in development mode
   */
  public isDevelopment(): boolean {
    return this.metadata.environment === 'development';
  }

  /**
   * Check if package is in production mode
   */
  public isProduction(): boolean {
    return this.metadata.environment === 'production';
  }
}

// Utility functions
export namespace PackageUtils {
  /**
   * Create a new package instance with default configuration
   */
  export function createPackage(overrides: Partial<PackageConfig> = {}): PackageCore {
    const defaultConfig: PackageConfig = {
      name: 'monorepo-package',
      version: '1.0.0',
      description: 'A monorepo package built with the package template',
      author: 'Monorepo Team',
      license: 'MIT',
    };

    return new PackageCore({ ...defaultConfig, ...overrides });
  }

  /**
   * Validate package configuration
   */
  export function validateConfig(config: Partial<PackageConfig>): config is PackageConfig {
    return !!(config.name && config.version);
  }

  /**
   * Get package version from package.json
   */
  export function getPackageVersion(): string {
    try {
      // In a real implementation, you'd read from package.json
      return process.env.npm_package_version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Format package name for display
   */
  export function formatPackageName(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Constants
export const PACKAGE_CONSTANTS = {
  DEFAULT_TIMEOUT: 5000,
  MAX_RETRY_ATTEMPTS: 3,
  SUPPORTED_VERSIONS: ['1.0.0', '1.1.0', '2.0.0'],
  DEFAULT_ENVIRONMENT: 'development',
} as const;

// Types for external consumption
export type Environment = PackageMetadata['environment'];
export type PackageVersion = string;
export type PackageName = string;

// Error classes
export class PackageError extends Error {
  public readonly code: string;
  public readonly packageName?: string;

  constructor(message: string, code: string = 'PACKAGE_ERROR', packageName?: string) {
    super(message);
    this.name = 'PackageError';
    this.code = code;
    this.packageName = packageName;
  }
}

export class PackageValidationError extends PackageError {
  constructor(message: string, packageName?: string) {
    super(message, 'VALIDATION_ERROR', packageName);
    this.name = 'PackageValidationError';
  }
}

export class PackageConfigurationError extends PackageError {
  constructor(message: string, packageName?: string) {
    super(message, 'CONFIGURATION_ERROR', packageName);
    this.name = 'PackageConfigurationError';
  }
}

// Main package instance for convenience
const defaultPackage = PackageUtils.createPackage();

// Re-export commonly used functionality
export { defaultPackage };
export default defaultPackage;

// Version and metadata for external tools
export const VERSION = PackageUtils.getPackageVersion();
export const BUILD_INFO = {
  version: VERSION,
  buildTime: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
};

/**
 * Initialize the package with custom configuration
 * 
 * @param config - Package configuration
 * @returns Configured package instance
 */
export function initializePackage(config: Partial<PackageConfig> = {}): PackageCore {
  if (!PackageUtils.validateConfig({ name: 'temp', version: '1.0.0', ...config })) {
    throw new PackageValidationError('Invalid package configuration provided');
  }

  return PackageUtils.createPackage(config);
}

/**
 * Health check function for monitoring
 */
export function healthCheck(): {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  environment: Environment;
} {
  return {
    status: 'healthy',
    version: VERSION,
    uptime: process.uptime(),
    environment: (process.env.NODE_ENV as Environment) || 'development',
  };
}

// Type guards
export function isPackageConfig(obj: any): obj is PackageConfig {
  return obj && typeof obj.name === 'string' && typeof obj.version === 'string';
}

export function isPackageError(error: any): error is PackageError {
  return error instanceof PackageError;
}

// Logging utilities (simple implementation)
export namespace Logger {
  export function log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(prefix, message, ...args);
  }

  export function info(message: string, ...args: any[]): void {
    log('info', message, ...args);
  }

  export function warn(message: string, ...args: any[]): void {
    log('warn', message, ...args);
  }

  export function error(message: string, ...args: any[]): void {
    log('error', message, ...args);
  }
}