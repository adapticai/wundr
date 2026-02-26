/**
 * Workflow Store - Persistence layer for workflow definitions and executions
 *
 * Provides two implementations of the `IWorkflowStore` interface:
 *
 * 1. `InMemoryWorkflowStore` – Map-backed, fast, suitable for tests and
 *    ephemeral daemon instances that do not require persistence across restarts.
 *
 * The interface is designed to be drop-in replaceable with a SQLite or
 * PostgreSQL-backed implementation without changing the engine layer.
 *
 * Note on `WorkflowExecution.stepResults`:
 * The `stepResults` field is a `Map<string, StepResult>`. Both implementations
 * clone this map on read/write to prevent external mutation of stored state.
 */

import { Logger } from '../utils/logger';
import { WorkflowError, WorkflowErrorCode } from './types';

import type { WorkflowDefinition, WorkflowExecution, StepResult } from './types';

// =============================================================================
// Store Interface
// =============================================================================

/**
 * Storage backend interface for workflow definitions and executions.
 *
 * All methods are async to allow seamless substitution with I/O-bound backends
 * (SQLite, Postgres, etc.) without changing callers.
 *
 * Implementations must be safe for sequential access. The `WorkflowEngine`
 * does not presently serialize concurrent writes to the store.
 */
export interface IWorkflowStore {
  // --- Definitions ---

  /** Persist or replace a workflow definition. */
  saveDefinition(definition: WorkflowDefinition): Promise<void>;

  /** Retrieve a workflow definition by ID. Returns `null` if not found. */
  getDefinition(id: string): Promise<WorkflowDefinition | null>;

  /** List all stored workflow definitions. */
  listDefinitions(): Promise<WorkflowDefinition[]>;

  /** Delete a workflow definition by ID. No-op if not found. */
  deleteDefinition(id: string): Promise<void>;

  // --- Executions ---

  /** Persist or replace an execution record. */
  saveExecution(execution: WorkflowExecution): Promise<void>;

  /** Retrieve an execution record by ID. Returns `null` if not found. */
  getExecution(id: string): Promise<WorkflowExecution | null>;

  /**
   * List execution records.
   *
   * @param workflowId - When provided, filter to executions belonging to this workflow.
   */
  listExecutions(workflowId?: string): Promise<WorkflowExecution[]>;

  /** Delete an execution record by ID. No-op if not found. */
  deleteExecution(id: string): Promise<void>;
}

// =============================================================================
// Serialisation Helpers
// =============================================================================

/**
 * Produce a shallow clone of a `WorkflowDefinition` to prevent external
 * mutation of stored state. Step and trigger arrays are shallow-cloned too.
 */
function cloneDefinition(def: WorkflowDefinition): WorkflowDefinition {
  return {
    ...def,
    steps: def.steps.map((s) => ({ ...s, dependencies: [...s.dependencies] })),
    triggers: def.triggers.map((t) => ({ ...t })),
    variables: { ...def.variables },
    metadata: { ...def.metadata },
  };
}

/**
 * Produce a shallow clone of a `WorkflowExecution`.
 * `stepResults` Map is cloned to prevent shared-reference mutations.
 */
function cloneExecution(exec: WorkflowExecution): WorkflowExecution {
  const clonedResults = new Map<string, StepResult>();
  for (const [key, value] of exec.stepResults) {
    clonedResults.set(key, { ...value });
  }

  return {
    ...exec,
    variables: { ...exec.variables },
    stepResults: clonedResults,
  };
}

// =============================================================================
// InMemoryWorkflowStore
// =============================================================================

/**
 * In-memory workflow store backed by `Map` instances.
 *
 * Suitable for tests and transient daemon instances. All data is lost on
 * process restart.
 *
 * @example
 * ```typescript
 * const store = new InMemoryWorkflowStore();
 *
 * await store.saveDefinition(myWorkflow);
 * const loaded = await store.getDefinition(myWorkflow.id);
 *
 * await store.saveExecution(execution);
 * const executions = await store.listExecutions(myWorkflow.id);
 * ```
 */
export class InMemoryWorkflowStore implements IWorkflowStore {
  private readonly definitions: Map<string, WorkflowDefinition> = new Map();
  private readonly executions: Map<string, WorkflowExecution> = new Map();
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('InMemoryWorkflowStore');
  }

  // ---------------------------------------------------------------------------
  // Definitions
  // ---------------------------------------------------------------------------

  /**
   * Save (upsert) a workflow definition.
   *
   * @param definition - The definition to persist.
   */
  async saveDefinition(definition: WorkflowDefinition): Promise<void> {
    this.definitions.set(definition.id, cloneDefinition(definition));
    this.logger.debug(`Definition saved: ${definition.id}`);
  }

  /**
   * Retrieve a workflow definition by ID.
   *
   * @param id - The workflow ID.
   * @returns A clone of the stored definition, or `null` if not found.
   */
  async getDefinition(id: string): Promise<WorkflowDefinition | null> {
    const def = this.definitions.get(id);
    return def ? cloneDefinition(def) : null;
  }

  /**
   * List all stored workflow definitions.
   *
   * @returns An array of cloned definitions (insertion order).
   */
  async listDefinitions(): Promise<WorkflowDefinition[]> {
    return Array.from(this.definitions.values()).map(cloneDefinition);
  }

  /**
   * Delete a workflow definition by ID.
   *
   * @param id - The workflow ID to delete.
   */
  async deleteDefinition(id: string): Promise<void> {
    const existed = this.definitions.delete(id);
    if (existed) {
      this.logger.debug(`Definition deleted: ${id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Executions
  // ---------------------------------------------------------------------------

  /**
   * Save (upsert) an execution record.
   *
   * @param execution - The execution to persist.
   */
  async saveExecution(execution: WorkflowExecution): Promise<void> {
    this.executions.set(execution.id, cloneExecution(execution));
    this.logger.debug(`Execution saved: ${execution.id} (status: ${execution.status})`);
  }

  /**
   * Retrieve an execution record by ID.
   *
   * @param id - The execution ID.
   * @returns A clone of the stored execution, or `null` if not found.
   */
  async getExecution(id: string): Promise<WorkflowExecution | null> {
    const exec = this.executions.get(id);
    return exec ? cloneExecution(exec) : null;
  }

  /**
   * List execution records.
   *
   * @param workflowId - When provided, only executions for this workflow are returned.
   * @returns An array of cloned execution records.
   */
  async listExecutions(workflowId?: string): Promise<WorkflowExecution[]> {
    let all = Array.from(this.executions.values());
    if (workflowId !== undefined) {
      all = all.filter((e) => e.workflowId === workflowId);
    }
    return all.map(cloneExecution);
  }

  /**
   * Delete an execution record by ID.
   *
   * @param id - The execution ID to delete.
   */
  async deleteExecution(id: string): Promise<void> {
    const existed = this.executions.delete(id);
    if (existed) {
      this.logger.debug(`Execution deleted: ${id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Return the number of stored workflow definitions.
   */
  get definitionCount(): number {
    return this.definitions.size;
  }

  /**
   * Return the number of stored execution records.
   */
  get executionCount(): number {
    return this.executions.size;
  }

  /**
   * Wipe all definitions and executions. Useful for test teardown.
   */
  clear(): void {
    this.definitions.clear();
    this.executions.clear();
    this.logger.debug('Store cleared');
  }
}

// =============================================================================
// Error Helpers
// =============================================================================

/**
 * Throw a `WorkflowError` with `STORE_ERROR` code, wrapping any underlying cause.
 *
 * @internal
 */
export function throwStoreError(message: string, cause?: unknown): never {
  throw new WorkflowError(
    WorkflowErrorCode.STORE_ERROR,
    message,
    { cause: cause instanceof Error ? cause.message : String(cause) },
  );
}
