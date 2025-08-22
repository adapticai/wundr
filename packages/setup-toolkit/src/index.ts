/**
 * @fileoverview Setup toolkit package entry point
 * This package provides environment setup and configuration tools.
 */

// Export all installers
export * from './installers';

// Export all configurators  
export * from './configurators';

// Export all validators
export * from './validators';

// Convenience re-exports for commonly used instances
export {
  nodeInstaller,
  pythonInstaller,
  dockerInstaller,
  gitInstaller,
  createInstaller,
} from './installers';

export {
  gitConfigurator,
  npmConfigurator,
  dockerConfigurator,
  vscodeConfigurator,
  createConfigurator,
} from './configurators';

export {
  systemValidator,
  dependencyValidator,
  environmentValidator,
  createValidator,
  validateAll,
} from './validators';

// Export common types
export type {
  Installer,
  InstallerOptions,
  InstallationResult,
} from './installers';

export type {
  Configurator,
  ConfigurationOptions,
  ConfigurationResult,
  ConfigurationValue,
} from './configurators';

export type {
  Validator,
  ValidationOptions,
  ValidationResult,
  ValidationIssue,
  SystemRequirement,
} from './validators';