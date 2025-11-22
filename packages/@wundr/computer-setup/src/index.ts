/**
 * @wundr/computer-setup
 * 
 * Engineering team computer provisioning tool
 * Sets up new developer machines with all required tools, configurations, and environments
 * Based on the new-starter repository functionality
 */

// Core types
export * from './types';

// Profiles management
export * from './profiles';

// All installers and orchestrator
export * from './installers';

// Configuration management
export * from './configurators';

// Profile personalization
export * from './personalizers';

// Validation utilities
export * from './validators';

// Template management
export * from './templates';

// Legacy exports for compatibility
export { ComputerSetupManager } from './manager';
export { SetupOrchestrator } from './orchestrator';