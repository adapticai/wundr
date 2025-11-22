/**
 * @wundr/risk-twin
 *
 * Risk Twin simulation engine for governance change validation.
 * Validates governance changes through accelerated digital twin simulations
 * before deploying to production environments.
 */

// Export base types (excluding those re-exported from other modules)
export type {
  DivergenceThresholds,
  SimulationResult,
  SimulationEvent,
  SimulationAnomaly,
  SimulationMetrics,
  DivergenceMetrics,
  NoveltyDetection,
  NoveltyFlag,
  MitigationPlan,
  DeploymentScope,
  HumanOversightConfig,
  RollbackCapability,
} from './types.js';

// Export PR Validator
export {
  PRValidator,
  createPRValidator,
  createStrictPRValidator,
} from './pr-validator.js';

// Export PR Validator types (these are the canonical exports)
export type {
  PRValidatorConfig,
  GovernancePattern,
  ValidationRule,
  PRInfo,
  FileChange,
  GovernanceChange,
  GovernanceChangeType,
  PRValidationResult,
  ValidationReport,
  ValidationSummary,
  RiskTwinOrchestrator,
  GovernanceChangeForValidation,
  RiskTwinValidationResult,
  RiskTwinConfig,
} from './pr-validator.js';
