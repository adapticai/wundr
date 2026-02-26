/**
 * Workflow Engine Module
 *
 * Event-driven, dependency-aware workflow execution for the Wundr orchestrator
 * daemon. Provides definition management, topological step scheduling, and
 * pluggable storage backends.
 *
 * @example
 * ```typescript
 * import {
 *   WorkflowEngine,
 *   InMemoryWorkflowStore,
 * } from '@wundr/orchestrator-daemon';
 *
 * // Set up store and engine
 * const store = new InMemoryWorkflowStore();
 * const engine = new WorkflowEngine({ maxConcurrentSteps: 5 });
 *
 * // Register a workflow definition
 * const definition: WorkflowDefinition = {
 *   id: 'send-report',
 *   name: 'Send Daily Report',
 *   version: '1.0.0',
 *   status: 'ACTIVE',
 *   steps: [
 *     {
 *       id: 'fetch-data',
 *       name: 'Fetch report data',
 *       type: 'task',
 *       config: { outputVariable: 'reportData' },
 *       dependencies: [],
 *     },
 *     {
 *       id: 'send-email',
 *       name: 'Send email',
 *       type: 'task',
 *       config: {},
 *       dependencies: ['fetch-data'],
 *     },
 *   ],
 *   triggers: [{ type: 'scheduled', config: { cron: '0 9 * * *' } }],
 *   variables: {},
 *   metadata: {},
 * };
 *
 * engine.registerWorkflow(definition);
 *
 * // Subscribe to lifecycle events
 * engine.on('execution:completed', ({ execution }) => {
 *   console.log('Workflow completed:', execution.id);
 * });
 *
 * // Execute the workflow
 * const execution = await engine.execute('send-report', { recipientEmail: 'team@example.com' });
 * await store.saveExecution(execution);
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export {
  // Error classes
  WorkflowError,
  WorkflowNotFoundError,
  ExecutionNotFoundError,
  WorkflowInactiveError,
  WorkflowCircularDependencyError,
  StepTimeoutError,

  // Error code enum
  WorkflowErrorCode,
} from './types';

export type {
  // Status types
  WorkflowStatus,
  ExecutionStatus,
  StepType,
  ConditionOperator,

  // Domain interfaces
  WorkflowDefinition,
  WorkflowStep,
  WorkflowTrigger,
  WorkflowExecution,
  StepResult,
  StepCondition,
  TriggerCondition,
  RetryConfig,

  // Engine configuration
  WorkflowEngineConfig,

  // Event map
  WorkflowEventMap,
} from './types';

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export { WorkflowEngine } from './workflow-engine';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export { InMemoryWorkflowStore, throwStoreError } from './workflow-store';
export type { IWorkflowStore } from './workflow-store';
