/**
 * @wundr/agent-delegation - Hub-and-Spoke Delegation Pattern for AI Agents
 *
 * This package provides a comprehensive framework for coordinating multi-agent
 * systems using the hub-and-spoke delegation pattern. It includes task delegation,
 * parallel execution, result synthesis, model selection, and audit logging.
 *
 * @example
 * ```typescript
 * import {
 *   HubCoordinator,
 *   AgentDefinitionInput,
 *   DelegationTaskInput,
 * } from '@wundr.io/agent-delegation';
 *
 * // Create coordinator
 * const coordinator = new HubCoordinator({
 *   config: {
 *     hubAgentId: 'main-orchestrator',
 *     maxParallelDelegations: 5,
 *     synthesisStrategy: 'merge',
 *   },
 * });
 *
 * // Register agents
 * const coder = coordinator.registerAgent({
 *   name: 'Code Expert',
 *   role: 'developer',
 *   capabilities: ['coding', 'refactoring', 'testing'],
 * });
 *
 * const reviewer = coordinator.registerAgent({
 *   name: 'Code Reviewer',
 *   role: 'reviewer',
 *   capabilities: ['code-review', 'security-audit'],
 * });
 *
 * // Delegate a single task
 * const result = await coordinator.delegateTask({
 *   description: 'Implement user authentication',
 *   requiredCapabilities: ['coding'],
 *   priority: 'high',
 * });
 *
 * // Delegate parallel tasks
 * const parallelResult = await coordinator.delegateParallel({
 *   tasks: [
 *     { description: 'Review authentication module' },
 *     { description: 'Review authorization module' },
 *   ],
 *   agents: [reviewer],
 * });
 *
 * // Synthesize results
 * const synthesis = await coordinator.synthesizeResults(
 *   parallelResult.results,
 *   'consensus'
 * );
 *
 * console.log('Synthesized output:', synthesis.synthesizedOutput);
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Main Coordinator Class
// =============================================================================

// =============================================================================
// Re-exports for convenience
// =============================================================================

import { AuditLogManager } from './audit-log';
import { HubCoordinator } from './coordinator';
import { ModelSelector } from './model-selector';
import { ResultSynthesizer } from './result-synthesizer';

export {
  HubCoordinator,
  createHubCoordinator,
  createHubCoordinatorWithExecutor,
  createParallelCoordinator,
} from './coordinator';

export type { HubCoordinatorOptions } from './coordinator';

// =============================================================================
// Audit Logging
// =============================================================================

export {
  AuditLogManager,
  createAuditLog,
  createAuditLogWithHandler,
} from './audit-log';

export type {
  AuditLogManagerOptions,
  AuditLogQuery,
  AuditLogStats,
} from './audit-log';

// =============================================================================
// Model Selection
// =============================================================================

export {
  ModelSelector,
  createModelSelector,
  createCostOptimizedSelector,
  createSpeedOptimizedSelector,
  createCapabilityOptimizedSelector,
} from './model-selector';

export type {
  ModelSelectorOptions,
  ModelSelectionResult,
} from './model-selector';

// =============================================================================
// Result Synthesis
// =============================================================================

export {
  ResultSynthesizer,
  createResultSynthesizer,
  createMergeSynthesizer,
  createConsensusSynthesizer,
  createVotingSynthesizer,
} from './result-synthesizer';

export type {
  ResultSynthesizerOptions,
  SynthesisConflict,
} from './result-synthesizer';

// =============================================================================
// Type Definitions
// =============================================================================

// Zod Schemas for validation (runtime values)
export {
  AgentCapabilityLevelSchema,
  DelegationStatusSchema,
  SynthesisStrategySchema,
  ModelTierSchema,
  AuditEventTypeSchema,
  AgentDefinitionSchema,
  DelegationTaskSchema,
  DelegationConfigSchema,
  DelegationResultSchema,
  SynthesisResultSchema,
  AuditLogEntrySchema,
  ModelSelectionCriteriaSchema,
  ModelConfigSchema,
  // Error Handling (class is a value)
  DelegationErrorCode,
  DelegationError,
} from './types';

// TypeScript Types (type-only exports)
export type {
  AgentCapabilityLevel,
  DelegationStatus,
  SynthesisStrategy,
  ModelTier,
  AuditEventType,
  AgentDefinition,
  AgentDefinitionInput,
  DelegationTask,
  DelegationTaskInput,
  DelegationConfig,
  DelegationConfigInput,
  DelegationResult,
  SynthesisResult,
  AuditLogEntry,
  ModelSelectionCriteria,
  ModelSelectionCriteriaInput,
  ModelConfig,
  // Interfaces
  ParallelDelegationRequest,
  ParallelDelegationResponse,
  CoordinatorMetrics,
  // Function Types
  TaskExecutor,
  ModelSelector as ModelSelectorFn,
  ResultSynthesizer as ResultSynthesizerFn,
  AuditLogger,
} from './types';

/**
 * Default export containing all main classes
 */
export default {
  HubCoordinator,
  AuditLogManager,
  ModelSelector,
  ResultSynthesizer,
};
