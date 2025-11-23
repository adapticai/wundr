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

// Context engineering setup (JIT tools, agentic RAG, memory architecture)
export {
  setupContextEngineering,
  validateContextEngineering,
  getContextEngineeringSteps,
  DEFAULT_CONTEXT_ENGINEERING_OPTIONS,
} from './context-engineering';
export type { ContextEngineeringResult } from './context-engineering';

// Orchestration frameworks setup (LangGraph, CrewAI, AutoGen)
export {
  setupOrchestrationFrameworks,
  validateOrchestrationSetup,
  getOrchestrationSteps,
  DEFAULT_ORCHESTRATION_OPTIONS,
} from './orchestration-setup';
export type { OrchestrationSetupResult } from './orchestration-setup';

// Security setup (prompt security, MCP access control, API key management)
export {
  setupSecurity,
  validateSecuritySetup,
  getSecuritySteps,
  DEFAULT_SECURITY_OPTIONS,
} from './security-setup';
export type { SecuritySetupResult } from './security-setup';

// Legacy exports for compatibility
export { ComputerSetupManager } from './manager';
export { SetupOrchestrator } from './orchestrator';
