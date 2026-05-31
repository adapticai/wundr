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

// The single setup orchestrator.
export { ComputerSetupManager } from './manager';

// NOTE: privilege helpers (isRoot / dropPrivilegesIfRoot, in ./lib/privileges)
// are intentionally NOT re-exported here. This package's barrel cannot reliably
// surface named re-exports to consumers under classic `node` module resolution
// (a long-standing version-collision quirk with the published copy), so the CLI
// carries its own root-drop guard. The helpers remain internal — used by the
// manager and the installer root guards.
