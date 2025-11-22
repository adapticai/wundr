/**
 * @wundr/governance - AI Governance and Alignment Monitoring
 *
 * This package provides tools for monitoring AI system alignment,
 * ensuring policy compliance, and detecting behavioral drift.
 */

// Evaluator Agent
export {
  EvaluatorAgent,
  createEvaluator,
  createEvaluatorSuite,
  runEvaluatorSuite,
} from './evaluator-agent.js';

// Types
export type {
  EvaluatorType,
  EvaluationFrequency,
  ViolationAction,
  EvaluatorConfig,
  EvaluatorOptions,
  PolicyRule,
  EvaluationContext,
  EvaluationResult,
  RewardScore,
  ComplianceResult,
  PolicyViolation,
  AlignmentResult,
  AlignmentGap,
  RewardBreakdown,
  DriftResult,
  DriftIndicator,
  HistoricalComparison,
} from './evaluator-agent.js';

// Intent Parser
export {
  IntentParser,
  IntentParseError,
  createIntentParser,
  INTENT_SCHEMA,
} from './intent-parser.js';

// Intent Parser Types
export type {
  IntentParserConfig,
  ConflictRule,
  Intent,
  ValidationError as IntentValidationError,
  ValidationResult as IntentValidationResult,
  ValidationWarning as IntentValidationWarning,
} from './intent-parser.js';

// Policy Engine
export { PolicyEngine } from './policy-engine.js';

// Policy Engine Types
export type {
  PolicyCategory,
  ViolationSeverity,
  Policy as EnginePolicy,
  PolicySet,
  AgentAction,
  PolicyViolation as EnginePolicyViolation,
  PolicyCheckResult,
  PolicyConfig,
  PolicyDefinition,
  PolicyEngineConfig,
} from './policy-engine.js';

// Reward Calculator
export {
  RewardCalculator,
  createRewardCalculator,
} from './reward-calculator.js';

// Reward Calculator Types
export type {
  RewardWeights as CalculatorRewardWeights,
  RewardMetrics,
  RewardScore as CalculatorRewardScore,
  ScoreComparison,
} from './reward-calculator.js';

// IPRE Types (from types.ts)
export type {
  // Intent
  Intent as IPREIntent,
  // Policy Types
  SecurityPolicy,
  CompliancePolicy,
  OperationalPolicy,
  PolicyRule as IPREPolicyRule,
  PolicyAction,
  Policy as IPREPolicy,
  // Reward Types
  RewardWeights,
  RewardScore as IPRERewardScore,
  RewardFactor,
  Rewards,
  // Evaluator Types
  EvaluatorConfig as IPREEvaluatorConfig,
  EvaluatorOptions as IPREEvaluatorOptions,
  // Violation Types
  PolicyViolation as IPREPolicyViolation,
  ViolationLocation,
  EvaluationResult as IPREEvaluationResult,
  EvaluationDetail,
  // Root Configuration
  IPREConfig,
  IPREMetadata,
} from './types.js';

// Package info
export const version = '1.0.0';
export const name = '@wundr/governance';
