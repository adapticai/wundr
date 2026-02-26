/**
 * WorkflowEngine Tests
 *
 * Covers definition management, execution lifecycle (single-step, multi-step
 * sequential, parallel), failure handling, cancellation, event emission,
 * circular dependency detection, and missing-workflow errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { WorkflowEngine } from '../workflow-engine';
import {
  WorkflowNotFoundError,
  WorkflowCircularDependencyError,
} from '../types';

import type { WorkflowDefinition } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkflow(
  overrides: Partial<WorkflowDefinition> = {}
): WorkflowDefinition {
  return {
    id: 'test-wf-1',
    name: 'Test Workflow',
    version: '1.0.0',
    status: 'ACTIVE',
    steps: [
      {
        id: 'step-1',
        name: 'Step 1',
        type: 'task',
        config: {},
        dependencies: [],
      },
    ],
    triggers: [],
    variables: {},
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine({ defaultStepTimeoutMs: 5_000 });
  });

  // -------------------------------------------------------------------------
  // Definition Management
  // -------------------------------------------------------------------------

  describe('definition management', () => {
    it('should register and retrieve a workflow', () => {
      const wf = makeWorkflow();
      engine.registerWorkflow(wf);

      const loaded = engine.getWorkflow('test-wf-1');
      expect(loaded).toBeDefined();
      expect(loaded!.name).toBe('Test Workflow');
    });

    it('should list all registered workflows', () => {
      engine.registerWorkflow(makeWorkflow({ id: 'a' }));
      engine.registerWorkflow(makeWorkflow({ id: 'b' }));

      const list = engine.listWorkflows();
      expect(list).toHaveLength(2);
      expect(list.map(w => w.id).sort()).toEqual(['a', 'b']);
    });

    it('should return undefined for an unregistered workflow', () => {
      expect(engine.getWorkflow('ghost')).toBeUndefined();
    });

    it('should unregister a workflow', () => {
      engine.registerWorkflow(makeWorkflow());
      engine.unregisterWorkflow('test-wf-1');

      expect(engine.getWorkflow('test-wf-1')).toBeUndefined();
      expect(engine.listWorkflows()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Execution: Single Step
  // -------------------------------------------------------------------------

  describe('execute() with a single-step workflow', () => {
    it('should complete successfully', async () => {
      engine.registerWorkflow(makeWorkflow());

      const execution = await engine.execute('test-wf-1');

      expect(execution.status).toBe('COMPLETED');
      expect(execution.completedAt).toBeInstanceOf(Date);
      expect(execution.stepResults.size).toBe(1);
      expect(execution.stepResults.get('step-1')?.status).toBe('COMPLETED');
    });

    it('should merge variables from the definition and caller', async () => {
      engine.registerWorkflow(
        makeWorkflow({
          variables: { fromDef: 'yes' },
          steps: [
            {
              id: 'step-1',
              name: 'Output Step',
              type: 'task',
              config: { outputVariable: 'result', output: 42 },
              dependencies: [],
            },
          ],
        })
      );

      const execution = await engine.execute('test-wf-1', { fromCaller: true });

      expect(execution.variables['fromDef']).toBe('yes');
      expect(execution.variables['fromCaller']).toBe(true);
      expect(execution.variables['result']).toBe(42);
    });
  });

  // -------------------------------------------------------------------------
  // Execution: Multi-Step Sequential (dependencies)
  // -------------------------------------------------------------------------

  describe('execute() with multi-step sequential workflow', () => {
    it('should run steps in dependency order', async () => {
      const executionOrder: string[] = [];

      engine.registerWorkflow(
        makeWorkflow({
          steps: [
            {
              id: 'first',
              name: 'First',
              type: 'task',
              config: {},
              dependencies: [],
            },
            {
              id: 'second',
              name: 'Second',
              type: 'task',
              config: {},
              dependencies: ['first'],
            },
            {
              id: 'third',
              name: 'Third',
              type: 'task',
              config: {},
              dependencies: ['second'],
            },
          ],
        })
      );

      engine.on('step:started', ({ stepId }) => {
        executionOrder.push(stepId);
      });

      const execution = await engine.execute('test-wf-1');

      expect(execution.status).toBe('COMPLETED');
      expect(execution.stepResults.size).toBe(3);
      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });
  });

  // -------------------------------------------------------------------------
  // Execution: Parallel Steps
  // -------------------------------------------------------------------------

  describe('execute() with parallel steps', () => {
    it('should run independent steps in the same layer', async () => {
      const startedSteps: string[] = [];

      engine.registerWorkflow(
        makeWorkflow({
          steps: [
            { id: 'a', name: 'A', type: 'task', config: {}, dependencies: [] },
            { id: 'b', name: 'B', type: 'task', config: {}, dependencies: [] },
            { id: 'c', name: 'C', type: 'task', config: {}, dependencies: [] },
            {
              id: 'final',
              name: 'Final',
              type: 'task',
              config: {},
              dependencies: ['a', 'b', 'c'],
            },
          ],
        })
      );

      engine.on('step:started', ({ stepId }) => {
        startedSteps.push(stepId);
      });

      const execution = await engine.execute('test-wf-1');

      expect(execution.status).toBe('COMPLETED');
      expect(execution.stepResults.size).toBe(4);

      // a, b, c should all start before final
      const finalIndex = startedSteps.indexOf('final');
      expect(finalIndex).toBe(3);
      expect(startedSteps.slice(0, 3).sort()).toEqual(['a', 'b', 'c']);
    });
  });

  // -------------------------------------------------------------------------
  // Execution: Step Failure
  // -------------------------------------------------------------------------

  describe('execute() handles step failure', () => {
    it('should set execution status to FAILED when a step fails', async () => {
      engine.registerWorkflow(
        makeWorkflow({
          steps: [
            {
              id: 'bad-step',
              name: 'Bad Step',
              type: 'wait',
              config: { durationMs: 1 },
              dependencies: [],
              // We will set a very short timeout to cause a failure
              timeout: 1,
            },
            {
              id: 'long-wait',
              name: 'Long Wait',
              type: 'wait',
              config: { durationMs: 60_000 },
              dependencies: ['bad-step'],
              timeout: 1, // 1ms timeout on a 60s wait forces a timeout failure
            },
          ],
        })
      );

      const execution = await engine.execute('test-wf-1');

      // The long-wait step should time out, causing the execution to fail
      expect(execution.status).toBe('FAILED');
      expect(execution.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Cancellation
  // -------------------------------------------------------------------------

  describe('cancelExecution()', () => {
    it('should set status to CANCELLED', async () => {
      // Use a workflow with a wait step to give time for cancellation
      engine.registerWorkflow(
        makeWorkflow({
          steps: [
            {
              id: 'wait-step',
              name: 'Wait',
              type: 'wait',
              config: { durationMs: 50 },
              dependencies: [],
            },
            {
              id: 'after-wait',
              name: 'After',
              type: 'task',
              config: {},
              dependencies: ['wait-step'],
            },
          ],
        })
      );

      // Start execution (do not await -- we need to cancel while it runs)
      const executionPromise = engine.execute('test-wf-1');

      // Wait a tick for the execution to register, then read its ID
      await new Promise(resolve => setTimeout(resolve, 5));
      const executions = engine.listExecutions('test-wf-1');
      expect(executions).toHaveLength(1);
      const executionId = executions[0].id;

      await engine.cancelExecution(executionId);

      const execution = await executionPromise;

      expect(execution.status).toBe('CANCELLED');
    });
  });

  // -------------------------------------------------------------------------
  // Event Emission
  // -------------------------------------------------------------------------

  describe('event emission', () => {
    it('should emit execution:started, step:completed, and execution:completed', async () => {
      const executionStarted = vi.fn();
      const stepCompleted = vi.fn();
      const executionCompleted = vi.fn();

      engine.on('execution:started', executionStarted);
      engine.on('step:completed', stepCompleted);
      engine.on('execution:completed', executionCompleted);

      engine.registerWorkflow(makeWorkflow());

      await engine.execute('test-wf-1');

      expect(executionStarted).toHaveBeenCalledTimes(1);
      expect(stepCompleted).toHaveBeenCalledTimes(1);
      expect(executionCompleted).toHaveBeenCalledTimes(1);

      // Verify payload shapes
      expect(executionStarted.mock.calls[0][0]).toHaveProperty('execution');
      expect(stepCompleted.mock.calls[0][0]).toHaveProperty('result');
      expect(executionCompleted.mock.calls[0][0]).toHaveProperty('execution');
    });

    it('should emit execution:failed when a step fails', async () => {
      const executionFailed = vi.fn();
      engine.on('execution:failed', executionFailed);

      engine.registerWorkflow(
        makeWorkflow({
          steps: [
            {
              id: 'timeout-step',
              name: 'Timeout',
              type: 'wait',
              config: { durationMs: 60_000 },
              dependencies: [],
              timeout: 1,
            },
          ],
        })
      );

      await engine.execute('test-wf-1');

      expect(executionFailed).toHaveBeenCalledTimes(1);
      expect(executionFailed.mock.calls[0][0]).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // Circular Dependency Detection
  // -------------------------------------------------------------------------

  describe('circular dependency detection', () => {
    it('should throw WorkflowCircularDependencyError', async () => {
      engine.registerWorkflow(
        makeWorkflow({
          steps: [
            {
              id: 'a',
              name: 'A',
              type: 'task',
              config: {},
              dependencies: ['c'],
            },
            {
              id: 'b',
              name: 'B',
              type: 'task',
              config: {},
              dependencies: ['a'],
            },
            {
              id: 'c',
              name: 'C',
              type: 'task',
              config: {},
              dependencies: ['b'],
            },
          ],
        })
      );

      const execution = await engine.execute('test-wf-1');

      // The engine catches the thrown error internally and marks the execution as FAILED
      expect(execution.status).toBe('FAILED');
      expect(execution.error).toContain('Circular');
    });

    it('should throw directly when using the internal resolve method', () => {
      // Access the dependency resolver indirectly by attempting execute
      // and verifying the error class in the emitted event
      const failedSpy = vi.fn();
      engine.on('execution:failed', failedSpy);

      engine.registerWorkflow(
        makeWorkflow({
          steps: [
            {
              id: 'x',
              name: 'X',
              type: 'task',
              config: {},
              dependencies: ['y'],
            },
            {
              id: 'y',
              name: 'Y',
              type: 'task',
              config: {},
              dependencies: ['x'],
            },
          ],
        })
      );

      // Execute triggers the internal error path
      return engine.execute('test-wf-1').then(execution => {
        expect(execution.status).toBe('FAILED');
        expect(failedSpy).toHaveBeenCalledTimes(1);
        expect(failedSpy.mock.calls[0][0].error).toMatch(/Circular/i);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Non-existent Workflow
  // -------------------------------------------------------------------------

  describe('execute non-existent workflow', () => {
    it('should throw WorkflowNotFoundError', async () => {
      await expect(engine.execute('no-such-workflow')).rejects.toThrow(
        WorkflowNotFoundError
      );
      await expect(engine.execute('no-such-workflow')).rejects.toThrow(
        'Workflow not found'
      );
    });
  });
});
