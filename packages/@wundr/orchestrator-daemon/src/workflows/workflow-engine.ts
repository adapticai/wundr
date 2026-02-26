/**
 * Workflow Engine - Core execution runtime
 *
 * Responsible for:
 * 1. Registering and indexing workflow definitions.
 * 2. Starting, cancelling, and tracking executions.
 * 3. Resolving step dependency order via topological sort (Kahn's algorithm).
 * 4. Dispatching step execution with per-type semantics:
 *    - `task`     – invoke async work described in `step.config`.
 *    - `decision` – evaluate conditions and skip non-matching branches.
 *    - `parallel` – run an entire dependency layer concurrently.
 *    - `loop`     – iterate with condition check and optional max-iteration guard.
 *    - `wait`     – sleep for `step.config.durationMs` milliseconds.
 * 5. Emitting typed lifecycle events for observability.
 *
 * The engine is intentionally storage-agnostic. Persisting definitions and
 * executions beyond process lifetime is delegated to `IWorkflowStore`.
 */

import { EventEmitter } from 'eventemitter3';

import { Logger } from '../utils/logger';
import {
  WorkflowNotFoundError,
  ExecutionNotFoundError,
  WorkflowInactiveError,
  WorkflowCircularDependencyError,
  StepTimeoutError,
  WorkflowError,
  WorkflowErrorCode,
} from './types';

import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  StepResult,
  StepCondition,
  WorkflowEngineConfig,
  WorkflowEventMap,
  ExecutionStatus,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_CONCURRENT_STEPS = 10;
const DEFAULT_STEP_TIMEOUT_MS = 30_000;
const DEFAULT_LOOP_MAX_ITERATIONS = 100;

// =============================================================================
// WorkflowEngine
// =============================================================================

/**
 * Core workflow execution engine.
 *
 * @example
 * ```typescript
 * const engine = new WorkflowEngine({ maxConcurrentSteps: 5 });
 *
 * engine.registerWorkflow({
 *   id: 'onboarding',
 *   name: 'User Onboarding',
 *   version: '1.0.0',
 *   status: 'ACTIVE',
 *   steps: [
 *     { id: 'send-welcome', name: 'Send welcome email', type: 'task', config: {}, dependencies: [] },
 *     { id: 'create-profile', name: 'Create profile', type: 'task', config: {}, dependencies: ['send-welcome'] },
 *   ],
 *   triggers: [{ type: 'manual', config: {} }],
 *   variables: {},
 *   metadata: {},
 * });
 *
 * const execution = await engine.execute('onboarding', { userId: '42' });
 * ```
 */
export class WorkflowEngine extends EventEmitter<WorkflowEventMap> {
  private readonly definitions: Map<string, WorkflowDefinition> = new Map();
  private readonly executions: Map<string, WorkflowExecution> = new Map();
  private readonly cancelledExecutions: Set<string> = new Set();
  private readonly config: Required<WorkflowEngineConfig>;
  private readonly logger: Logger;

  constructor(config: WorkflowEngineConfig = {}) {
    super();
    this.logger = new Logger('WorkflowEngine');
    this.config = {
      maxConcurrentSteps:
        config.maxConcurrentSteps ?? DEFAULT_MAX_CONCURRENT_STEPS,
      defaultStepTimeoutMs:
        config.defaultStepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
      allowInactiveWorkflows: config.allowInactiveWorkflows ?? false,
    };
  }

  // ===========================================================================
  // Definition Management
  // ===========================================================================

  /**
   * Register (or replace) a workflow definition.
   *
   * @param definition - The workflow definition to register.
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    this.definitions.set(definition.id, definition);
    this.logger.info(
      `Workflow registered: ${definition.id} (${definition.name} v${definition.version})`
    );
  }

  /**
   * Remove a workflow definition from the registry.
   *
   * Running executions are NOT cancelled; they will run to completion or
   * failure against their snapshot of the definition held at start time.
   *
   * @param workflowId - ID of the definition to remove.
   */
  unregisterWorkflow(workflowId: string): void {
    this.definitions.delete(workflowId);
    this.logger.info(`Workflow unregistered: ${workflowId}`);
  }

  /**
   * Retrieve a workflow definition by ID.
   *
   * @param workflowId - The workflow ID.
   * @returns The definition, or `undefined` if not registered.
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.definitions.get(workflowId);
  }

  /**
   * List all registered workflow definitions.
   *
   * @returns An array of definitions (order is insertion order).
   */
  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }

  // ===========================================================================
  // Execution Management
  // ===========================================================================

  /**
   * Start a new execution of the given workflow.
   *
   * Steps are executed in dependency order. Independent steps within the same
   * topological layer are executed concurrently up to `maxConcurrentSteps`.
   *
   * @param workflowId - The ID of the registered workflow to execute.
   * @param variables  - Optional variable overrides merged with the definition's defaults.
   * @returns The completed (or failed) execution record.
   * @throws {WorkflowNotFoundError}  If the workflow ID is not registered.
   * @throws {WorkflowInactiveError}  If the workflow is not ACTIVE and `allowInactiveWorkflows` is false.
   * @throws {WorkflowCircularDependencyError} If the step graph contains a cycle.
   */
  async execute(
    workflowId: string,
    variables?: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const definition = this.definitions.get(workflowId);
    if (!definition) {
      throw new WorkflowNotFoundError(workflowId);
    }

    if (!this.config.allowInactiveWorkflows && definition.status !== 'ACTIVE') {
      throw new WorkflowInactiveError(workflowId, definition.status);
    }

    // Build execution record
    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      workflowId,
      status: 'RUNNING',
      variables: { ...definition.variables, ...variables },
      stepResults: new Map(),
      startedAt: new Date(),
    };

    this.executions.set(execution.id, execution);
    this.logger.info(
      `Execution started: ${execution.id} for workflow ${workflowId}`
    );
    this.emit('execution:started', { execution });

    try {
      // Resolve dependency layers (topological sort). Each layer is a set of
      // steps that can run in parallel once all prior layers are complete.
      const layers = this.resolveDependencyOrder(definition.steps);

      for (const layer of layers) {
        // Check for cancellation at the start of each layer
        if (this.cancelledExecutions.has(execution.id)) {
          this.finaliseExecution(execution, 'CANCELLED');
          this.emit('execution:cancelled', { execution });
          return execution;
        }

        // Execute the layer, respecting the concurrency cap
        await this.executeLayer(layer, execution);
      }

      this.finaliseExecution(execution, 'COMPLETED');
      this.emit('execution:completed', { execution });
      this.logger.info(`Execution completed: ${execution.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      execution.error = errorMessage;
      this.finaliseExecution(execution, 'FAILED');
      this.emit('execution:failed', { execution, error: errorMessage });
      this.logger.error(`Execution failed: ${execution.id} - ${errorMessage}`);
    }

    return execution;
  }

  /**
   * Request cancellation of a running execution.
   *
   * Cancellation is cooperative: the engine checks the cancelled set at the
   * start of each layer boundary. In-flight steps are allowed to finish.
   *
   * @param executionId - The execution to cancel.
   * @throws {ExecutionNotFoundError} If the execution ID is not known.
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new ExecutionNotFoundError(executionId);
    }

    if (execution.status === 'RUNNING' || execution.status === 'PENDING') {
      this.cancelledExecutions.add(executionId);
      this.logger.info(`Cancellation requested for execution: ${executionId}`);
    }
  }

  /**
   * Retrieve a single execution by ID.
   *
   * @param executionId - The execution ID.
   * @returns The execution, or `undefined` if not found.
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List executions, optionally filtered by workflow ID.
   *
   * @param workflowId - When provided, only executions for this workflow are returned.
   * @returns Array of matching executions.
   */
  listExecutions(workflowId?: string): WorkflowExecution[] {
    const all = Array.from(this.executions.values());
    return workflowId ? all.filter(e => e.workflowId === workflowId) : all;
  }

  // ===========================================================================
  // Private: Layer Execution
  // ===========================================================================

  /**
   * Execute all steps in a single topological layer, respecting `maxConcurrentSteps`.
   * Steps whose conditions are not satisfied are skipped (recorded as COMPLETED with no output).
   */
  private async executeLayer(
    steps: WorkflowStep[],
    execution: WorkflowExecution
  ): Promise<void> {
    // Apply concurrency cap by batching steps
    const batches: WorkflowStep[][] = [];
    for (let i = 0; i < steps.length; i += this.config.maxConcurrentSteps) {
      batches.push(steps.slice(i, i + this.config.maxConcurrentSteps));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(step => this.runStep(step, execution)));
    }
  }

  /**
   * Evaluate a step's conditions, then dispatch to the appropriate type handler.
   * Any failure from the type handler is recorded and re-thrown to abort the execution.
   */
  private async runStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    // Evaluate entry conditions
    if (step.conditions && step.conditions.length > 0) {
      const conditionsMet = this.evaluateConditions(
        step.conditions,
        execution.variables
      );
      if (!conditionsMet) {
        this.logger.debug(`Step skipped (conditions not met): ${step.id}`);
        this.emit('step:skipped', { execution, stepId: step.id });
        // Record as a completed step with no output so dependants can proceed
        const skipped: StepResult = {
          stepId: step.id,
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
        };
        execution.stepResults.set(step.id, skipped);
        return;
      }
    }

    execution.currentStepId = step.id;
    this.emit('step:started', { execution, stepId: step.id });

    const result = await this.executeStep(step, execution);
    execution.stepResults.set(step.id, result);

    if (result.status === 'FAILED') {
      this.emit('step:failed', { execution, result });
      throw new WorkflowError(
        WorkflowErrorCode.STEP_FAILED,
        `Step ${step.id} failed: ${result.error ?? 'unknown error'}`,
        { stepId: step.id }
      );
    }

    this.emit('step:completed', { execution, result });
  }

  // ===========================================================================
  // Private: Step Execution by Type
  // ===========================================================================

  /**
   * Dispatch step execution to the handler matching `step.type`.
   * Wraps execution in a timeout promise when `step.timeout` or
   * `config.defaultStepTimeoutMs` is set.
   */
  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<StepResult> {
    const startedAt = new Date();
    const timeoutMs = step.timeout ?? this.config.defaultStepTimeoutMs;

    const doExecute = async (): Promise<StepResult> => {
      switch (step.type) {
        case 'task':
          return this.executeTaskStep(step, execution, startedAt);
        case 'decision':
          return this.executeDecisionStep(step, execution, startedAt);
        case 'parallel':
          return this.executeParallelStep(step, execution, startedAt);
        case 'loop':
          return this.executeLoopStep(step, execution, startedAt);
        case 'wait':
          return this.executeWaitStep(step, startedAt);
        default: {
          // TypeScript exhaustiveness guard
          const _exhaustive: never = step.type;
          throw new WorkflowError(
            WorkflowErrorCode.INVALID_STEP_TYPE,
            `Unknown step type: ${_exhaustive as string}`
          );
        }
      }
    };

    // Race step execution against a timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new StepTimeoutError(step.id, timeoutMs)),
        timeoutMs
      )
    );

    try {
      return await Promise.race([doExecute(), timeoutPromise]);
    } catch (err) {
      const completedAt = new Date();
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Step failed: ${step.id} - ${errorMessage}`);

      return {
        stepId: step.id,
        status: 'FAILED',
        error: errorMessage,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      };
    }
  }

  /**
   * `task` step handler.
   *
   * Executes an opaque unit of work. The actual implementation reads from
   * `step.config` to determine what to do. In a production system this would
   * dispatch to a registered task handler registry; here we model the common
   * contract: the step succeeds and may set an `outputVariable`.
   */
  private async executeTaskStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    startedAt: Date
  ): Promise<StepResult> {
    this.logger.debug(`Executing task step: ${step.id}`);

    // If step config declares an outputVariable, write it back to variables
    const outputVariable = step.config['outputVariable'] as string | undefined;
    const output = step.config['output'];
    if (outputVariable && output !== undefined) {
      execution.variables[outputVariable] = output;
    }

    const completedAt = new Date();
    return {
      stepId: step.id,
      status: 'COMPLETED',
      output,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * `decision` step handler.
   *
   * Evaluates `step.conditions` and sets `execution.variables['_decision_<stepId>']`
   * to `'true'` or `'false'` so downstream steps can branch on it.
   */
  private async executeDecisionStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    startedAt: Date
  ): Promise<StepResult> {
    this.logger.debug(`Executing decision step: ${step.id}`);

    const conditions = (step.conditions ?? []) as StepCondition[];
    const result = this.evaluateConditions(conditions, execution.variables);

    // Expose decision result for downstream branching
    execution.variables[`_decision_${step.id}`] = result;

    const completedAt = new Date();
    return {
      stepId: step.id,
      status: 'COMPLETED',
      output: result,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * `parallel` step handler.
   *
   * This step type acts as a synchronisation barrier: it has no direct work of
   * its own. The actual parallelism is managed at the layer level by
   * `executeLayer`. Recording COMPLETED here allows dependants to unblock.
   */
  private async executeParallelStep(
    step: WorkflowStep,
    _execution: WorkflowExecution,
    startedAt: Date
  ): Promise<StepResult> {
    this.logger.debug(`Parallel barrier step: ${step.id}`);
    const completedAt = new Date();
    return {
      stepId: step.id,
      status: 'COMPLETED',
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * `loop` step handler.
   *
   * Iterates as long as `step.config.condition` evaluates to `true`.
   * Guards against infinite loops with `step.config.maxIterations` (default 100).
   *
   * Config shape:
   * ```json
   * {
   *   "condition": [{ "field": "counter", "operator": "less_than", "value": 5 }],
   *   "maxIterations": 10,
   *   "iterationVariable": "counter"
   * }
   * ```
   */
  private async executeLoopStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    startedAt: Date
  ): Promise<StepResult> {
    this.logger.debug(`Executing loop step: ${step.id}`);

    const rawConditions = step.config['condition'] as
      | StepCondition[]
      | undefined;
    const maxIterations =
      (step.config['maxIterations'] as number | undefined) ??
      DEFAULT_LOOP_MAX_ITERATIONS;
    const iterationVariable = step.config['iterationVariable'] as
      | string
      | undefined;

    let iterations = 0;

    while (iterations < maxIterations) {
      // Check cancellation inside the loop
      if (this.cancelledExecutions.has(execution.id)) {
        break;
      }

      const conditions = rawConditions ?? [];
      const shouldContinue =
        conditions.length === 0
          ? false
          : this.evaluateConditions(conditions, execution.variables);

      if (!shouldContinue) {
        break;
      }

      iterations++;

      // Increment the iteration variable if configured
      if (iterationVariable) {
        const current = (execution.variables[iterationVariable] as number) || 0;
        execution.variables[iterationVariable] = current + 1;
      }
    }

    const completedAt = new Date();
    return {
      stepId: step.id,
      status: 'COMPLETED',
      output: { iterations },
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * `wait` step handler.
   *
   * Sleeps for `step.config.durationMs` milliseconds (default: 1000 ms).
   */
  private async executeWaitStep(
    step: WorkflowStep,
    startedAt: Date
  ): Promise<StepResult> {
    const durationMs =
      (step.config['durationMs'] as number | undefined) ?? 1000;
    this.logger.debug(`Wait step: ${step.id} sleeping for ${durationMs}ms`);

    await new Promise<void>(resolve => setTimeout(resolve, durationMs));

    const completedAt = new Date();
    return {
      stepId: step.id,
      status: 'COMPLETED',
      output: { sleptMs: durationMs },
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  // ===========================================================================
  // Private: Dependency Resolution (Topological Sort)
  // ===========================================================================

  /**
   * Compute execution layers from the step dependency graph using Kahn's
   * algorithm. Steps in the same layer have no ordering relationship and
   * can be executed concurrently.
   *
   * @param steps - All steps in the workflow definition.
   * @returns An ordered array of layers, where each layer is an array of
   *          steps that can run in parallel.
   * @throws {WorkflowCircularDependencyError} If a cycle is detected.
   */
  private resolveDependencyOrder(steps: WorkflowStep[]): WorkflowStep[][] {
    const stepMap = new Map<string, WorkflowStep>(steps.map(s => [s.id, s]));

    // Build in-degree map and adjacency list
    const inDegree = new Map<string, number>();
    const dependants = new Map<string, string[]>(); // stepId -> steps that depend on it

    for (const step of steps) {
      if (!inDegree.has(step.id)) {
        inDegree.set(step.id, 0);
      }
      if (!dependants.has(step.id)) {
        dependants.set(step.id, []);
      }
    }

    for (const step of steps) {
      for (const depId of step.dependencies) {
        if (!stepMap.has(depId)) {
          // Dependency references a step not in the workflow; skip gracefully
          continue;
        }
        inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
        dependants.get(depId)!.push(step.id);
      }
    }

    const layers: WorkflowStep[][] = [];
    let frontier = steps.filter(s => (inDegree.get(s.id) ?? 0) === 0);

    while (frontier.length > 0) {
      layers.push(frontier);

      const nextFrontier: WorkflowStep[] = [];
      for (const step of frontier) {
        for (const dependantId of dependants.get(step.id) ?? []) {
          const remaining = (inDegree.get(dependantId) ?? 0) - 1;
          inDegree.set(dependantId, remaining);
          if (remaining === 0) {
            nextFrontier.push(stepMap.get(dependantId)!);
          }
        }
      }

      frontier = nextFrontier;
    }

    // If any step still has a positive in-degree, there is a cycle
    const cycleNodes = steps.filter(s => (inDegree.get(s.id) ?? 0) > 0);
    if (cycleNodes.length > 0) {
      throw new WorkflowCircularDependencyError(cycleNodes.map(s => s.id));
    }

    return layers;
  }

  // ===========================================================================
  // Private: Condition Evaluation
  // ===========================================================================

  /**
   * Evaluate an array of conditions against the execution's variable map.
   * All conditions must be satisfied (AND semantics).
   *
   * Field resolution supports simple dot-notation paths into `variables`.
   *
   * @param conditions - Array of conditions to evaluate.
   * @param variables  - Current execution variable map.
   * @returns `true` if all conditions are satisfied, `false` otherwise.
   */
  private evaluateConditions(
    conditions: StepCondition[],
    variables: Record<string, unknown>
  ): boolean {
    return conditions.every(condition =>
      this.evaluateCondition(condition, variables)
    );
  }

  /**
   * Evaluate a single condition against the variable map.
   */
  private evaluateCondition(
    condition: StepCondition,
    variables: Record<string, unknown>
  ): boolean {
    const fieldValue = this.resolvePath(condition.field, variables);

    switch (condition.operator) {
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      case 'equals':
        return fieldValue === condition.value;

      case 'not_equals':
        return fieldValue !== condition.value;

      case 'contains':
        if (
          typeof fieldValue === 'string' &&
          typeof condition.value === 'string'
        ) {
          return fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return false;

      case 'not_contains':
        if (
          typeof fieldValue === 'string' &&
          typeof condition.value === 'string'
        ) {
          return !fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(condition.value);
        }
        return true;

      case 'greater_than':
        if (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number'
        ) {
          return fieldValue > condition.value;
        }
        return false;

      case 'less_than':
        if (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number'
        ) {
          return fieldValue < condition.value;
        }
        return false;

      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(fieldValue as string);
        }
        return false;

      case 'not_in':
        if (Array.isArray(condition.value)) {
          return !condition.value.includes(fieldValue as string);
        }
        return true;

      default: {
        const _exhaustive: never = condition.operator;
        this.logger.warn(
          `Unknown condition operator: ${_exhaustive as string}`
        );
        return false;
      }
    }
  }

  /**
   * Resolve a dot-notation field path against a variable map.
   *
   * @example
   * resolvePath('user.role', { user: { role: 'admin' } }) // => 'admin'
   */
  private resolvePath(
    path: string,
    variables: Record<string, unknown>
  ): unknown {
    const parts = path.split('.');
    let current: unknown = variables;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  // ===========================================================================
  // Private: Helpers
  // ===========================================================================

  /**
   * Set execution status and completedAt timestamp.
   */
  private finaliseExecution(
    execution: WorkflowExecution,
    status: ExecutionStatus
  ): void {
    execution.status = status;
    execution.completedAt = new Date();
    execution.currentStepId = undefined;
  }
}
