/**
 * Workflow Engine - Type Definitions
 *
 * Daemon-side type system for workflow management. Mirrors the Neolith
 * validation schemas (packages/@wundr/neolith/apps/web/lib/validations/workflow.ts)
 * while providing runtime-local interfaces suited for the orchestrator daemon's
 * execution model.
 *
 * Key design decisions:
 * - `WorkflowExecution.stepResults` uses a `Map` for O(1) step lookup during execution.
 * - Condition evaluation is expressed through typed `StepCondition` objects so the
 *   engine can evaluate them without eval().
 * - `RetryConfig` mirrors the template schema's retryConfig shape for compatibility.
 */

// =============================================================================
// Status Enums
// =============================================================================

/**
 * Lifecycle status for a workflow definition.
 *
 * Transitions:
 *   DRAFT -> ACTIVE -> INACTIVE -> ARCHIVED
 */
export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

/**
 * Execution lifecycle status, aligned with the Neolith `workflowExecutionSchema`.
 *
 * Transitions:
 *   PENDING -> RUNNING -> COMPLETED
 *                     \-> FAILED
 *                     \-> CANCELLED
 */
export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Supported step types. Each type drives different execution semantics in
 * the engine's `executeStep` method.
 *
 * - `task`     - Run a discrete unit of work (most common).
 * - `decision` - Evaluate conditions and route to a branch step.
 * - `parallel` - Wait for all dependency-satisfied steps to complete concurrently.
 * - `loop`     - Repeat until `config.condition` evaluates to false or `config.maxIterations` is reached.
 * - `wait`     - Sleep for `config.durationMs` milliseconds.
 */
export type StepType = 'task' | 'decision' | 'parallel' | 'loop' | 'wait';

// =============================================================================
// Condition Types
// =============================================================================

/**
 * Supported comparison operators for condition evaluation.
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'not_exists'
  | 'in'
  | 'not_in';

/**
 * A single condition that evaluates a named field in the execution's variable
 * map against a value using the given operator.
 */
export interface StepCondition {
  /** Dot-notation path into `WorkflowExecution.variables`, e.g. `"user.role"`. */
  field: string;
  operator: ConditionOperator;
  /** Expected value. Omit for `exists` / `not_exists` operators. */
  value?: string | number | boolean | string[];
}

/**
 * Condition attached to a trigger. Evaluated before the engine starts an
 * execution in response to an event or schedule.
 */
export interface TriggerCondition {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean | string[];
}

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Retry policy applied to a single step on failure.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts after the initial failure. */
  maxRetries: number;
  /** Base delay between attempts in milliseconds. */
  delayMs: number;
  /** Optional multiplier applied to `delayMs` on each retry (exponential backoff). */
  backoffMultiplier?: number;
}

// =============================================================================
// Core Domain Types
// =============================================================================

/**
 * A single step within a workflow definition.
 */
export interface WorkflowStep {
  /** Unique identifier for this step within the workflow. */
  id: string;
  /** Human-readable step name. */
  name: string;
  /** Execution semantics for this step. */
  type: StepType;
  /** Step-specific configuration (interpreter depends on `type`). */
  config: Record<string, unknown>;
  /**
   * IDs of steps that must reach COMPLETED status before this step can start.
   * Used by the dependency resolver to build execution layers.
   */
  dependencies: string[];
  /**
   * Optional conditions that must all evaluate to `true` for this step to execute.
   * When false the step is skipped and recorded as COMPLETED with no output.
   */
  conditions?: StepCondition[];
  /** Maximum execution time for this step in milliseconds. */
  timeout?: number;
  /** Retry policy applied when this step fails. */
  retryConfig?: RetryConfig;
}

/**
 * A trigger definition that describes when a workflow should be started.
 */
export interface WorkflowTrigger {
  /** How the workflow is initiated. */
  type: 'manual' | 'scheduled' | 'event' | 'webhook';
  /** For `event` triggers: the event name to listen for. */
  event?: string;
  /** Conditions evaluated against incoming event data before starting execution. */
  conditions?: TriggerCondition[];
  /** Trigger-specific configuration (cron expression, webhook secret, etc.). */
  config: Record<string, unknown>;
}

/**
 * A fully-specified workflow definition as stored and executed by the daemon.
 */
export interface WorkflowDefinition {
  /** Unique workflow identifier. */
  id: string;
  /** Human-readable workflow name. */
  name: string;
  /** Optional description of the workflow's purpose. */
  description?: string;
  /** Semantic version string (e.g. `"1.0.0"`). */
  version: string;
  /** Current lifecycle status of the definition. */
  status: WorkflowStatus;
  /** Ordered (or dependency-graph) collection of steps. */
  steps: WorkflowStep[];
  /** Trigger configurations that can start this workflow. */
  triggers: WorkflowTrigger[];
  /** Default variable values injected into new executions. */
  variables: Record<string, unknown>;
  /** Arbitrary metadata for external tooling or display. */
  metadata: Record<string, unknown>;
}

/**
 * The result of a single step's execution.
 */
export interface StepResult {
  /** ID of the step that produced this result. */
  stepId: string;
  /** Final status of the step. */
  status: ExecutionStatus;
  /** Step-specific output value. */
  output?: unknown;
  /** Human-readable error message on failure. */
  error?: string;
  /** Wall-clock time at which the step started. */
  startedAt: Date;
  /** Wall-clock time at which the step finished (success or failure). */
  completedAt?: Date;
  /** Total execution time in milliseconds. */
  durationMs?: number;
}

/**
 * A live (or historical) execution of a workflow definition.
 */
export interface WorkflowExecution {
  /** Unique execution identifier. */
  id: string;
  /** ID of the `WorkflowDefinition` being executed. */
  workflowId: string;
  /** Current lifecycle status. */
  status: ExecutionStatus;
  /** ID of the step currently being executed, if any. */
  currentStepId?: string;
  /**
   * Mutable variable map for the execution. Steps may read from and write
   * to this map via their `config.outputVariable` field.
   */
  variables: Record<string, unknown>;
  /**
   * Results keyed by step ID. Using a Map for O(1) lookup during execution.
   * Callers serializing to JSON should convert to a plain object first.
   */
  stepResults: Map<string, StepResult>;
  /** Wall-clock time at which the execution was created. */
  startedAt: Date;
  /** Wall-clock time at which the execution reached a terminal status. */
  completedAt?: Date;
  /** Human-readable error message if the execution failed. */
  error?: string;
}

// =============================================================================
// Engine Configuration
// =============================================================================

/**
 * Configuration options for the `WorkflowEngine`.
 */
export interface WorkflowEngineConfig {
  /**
   * Maximum number of concurrent step executions within a single workflow
   * execution. Applies to parallel step layers. Default: `10`.
   */
  maxConcurrentSteps?: number;

  /**
   * Global step timeout in milliseconds, used when a step does not define
   * its own `timeout`. Default: `30_000` (30 seconds).
   */
  defaultStepTimeoutMs?: number;

  /**
   * Whether to allow executing workflows with `DRAFT` or `INACTIVE` status.
   * Useful in test environments. Default: `false`.
   */
  allowInactiveWorkflows?: boolean;
}

// =============================================================================
// Event Map
// =============================================================================

/**
 * Typed event map for the `WorkflowEngine` EventEmitter.
 *
 * Consumers can subscribe with:
 * ```typescript
 * engine.on('execution:completed', ({ execution }) => { ... });
 * ```
 */
export interface WorkflowEventMap {
  'execution:started': (payload: { execution: WorkflowExecution }) => void;
  'execution:completed': (payload: { execution: WorkflowExecution }) => void;
  'execution:failed': (payload: {
    execution: WorkflowExecution;
    error: string;
  }) => void;
  'execution:cancelled': (payload: { execution: WorkflowExecution }) => void;
  'step:started': (payload: {
    execution: WorkflowExecution;
    stepId: string;
  }) => void;
  'step:completed': (payload: {
    execution: WorkflowExecution;
    result: StepResult;
  }) => void;
  'step:failed': (payload: {
    execution: WorkflowExecution;
    result: StepResult;
  }) => void;
  'step:skipped': (payload: {
    execution: WorkflowExecution;
    stepId: string;
  }) => void;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for workflow operations.
 */
export enum WorkflowErrorCode {
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',
  WORKFLOW_INACTIVE = 'WORKFLOW_INACTIVE',
  CIRCULAR_DEPENDENCY = 'WORKFLOW_CIRCULAR_DEPENDENCY',
  STEP_TIMEOUT = 'WORKFLOW_STEP_TIMEOUT',
  STEP_FAILED = 'WORKFLOW_STEP_FAILED',
  INVALID_STEP_TYPE = 'WORKFLOW_INVALID_STEP_TYPE',
  EXECUTION_CANCELLED = 'WORKFLOW_EXECUTION_CANCELLED',
  STORE_ERROR = 'WORKFLOW_STORE_ERROR',
  VALIDATION_ERROR = 'WORKFLOW_VALIDATION_ERROR',
}

/**
 * Base error class for all workflow-related errors.
 */
export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: WorkflowErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.details = details;
  }
}

/** Thrown when a workflow definition ID cannot be found. */
export class WorkflowNotFoundError extends WorkflowError {
  constructor(workflowId: string) {
    super(
      WorkflowErrorCode.WORKFLOW_NOT_FOUND,
      `Workflow not found: ${workflowId}`,
      { workflowId }
    );
    this.name = 'WorkflowNotFoundError';
  }
}

/** Thrown when an execution ID cannot be found. */
export class ExecutionNotFoundError extends WorkflowError {
  constructor(executionId: string) {
    super(
      WorkflowErrorCode.EXECUTION_NOT_FOUND,
      `Execution not found: ${executionId}`,
      { executionId }
    );
    this.name = 'ExecutionNotFoundError';
  }
}

/** Thrown when attempting to execute a workflow that is not ACTIVE. */
export class WorkflowInactiveError extends WorkflowError {
  constructor(workflowId: string, status: WorkflowStatus) {
    super(
      WorkflowErrorCode.WORKFLOW_INACTIVE,
      `Workflow ${workflowId} is not active (status: ${status})`,
      { workflowId, status }
    );
    this.name = 'WorkflowInactiveError';
  }
}

/** Thrown when step dependency resolution detects a cycle. */
export class WorkflowCircularDependencyError extends WorkflowError {
  constructor(cycle: string[]) {
    super(
      WorkflowErrorCode.CIRCULAR_DEPENDENCY,
      `Circular step dependency detected: ${cycle.join(' -> ')}`,
      { cycle }
    );
    this.name = 'WorkflowCircularDependencyError';
  }
}

/** Thrown when a step exceeds its configured timeout. */
export class StepTimeoutError extends WorkflowError {
  constructor(stepId: string, timeoutMs: number) {
    super(
      WorkflowErrorCode.STEP_TIMEOUT,
      `Step ${stepId} timed out after ${timeoutMs}ms`,
      { stepId, timeoutMs }
    );
    this.name = 'StepTimeoutError';
  }
}
