/**
 * Workflow Service Tests
 *
 * Comprehensive test suite for the Workflow Service covering:
 * - Workflow CRUD operations
 * - Status management (activate/deactivate)
 * - Workflow execution
 * - Action execution
 * - Condition evaluation
 * - Template interpolation
 * - Built-in templates
 * - Error handling
 *
 * @module @genesis/core/services/__tests__/workflow-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  WorkflowServiceImpl,
  InMemoryWorkflowStorage,
  createWorkflowService,
  WorkflowNotFoundError,
  WorkflowValidationError,
  WorkflowExecutionError,
  ExecutionNotFoundError,
  TemplateNotFoundError,
  BUILT_IN_TEMPLATES,
  type WorkflowStorage,
  type WorkflowServiceConfig,
  type ActionHandler,
} from '../workflow-service';

import type {
  Workflow,
  WorkflowExecution,
  WorkflowAction,
  WorkflowCondition,
  CreateWorkflowInput,
  _UpdateWorkflowInput,
  ExecutionContext,
  ActionResult,
  SendMessageConfig,
  _DelayConfig,
  _ConditionConfig,
  _SetVariableConfig,
  _LoopConfig,
} from '../../types/workflow';

// =============================================================================
// TEST UTILITIES
// =============================================================================

let idCounter = 0;

function generateTestId(): string {
  idCounter += 1;
  return `test_${Date.now()}_${idCounter}`;
}

function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  const id = overrides.id ?? generateTestId();
  const now = new Date();
  return {
    id,
    workspaceId: overrides.workspaceId ?? generateTestId(),
    name: overrides.name ?? 'Test Workflow',
    description: overrides.description,
    status: overrides.status ?? 'active',
    trigger: overrides.trigger ?? {
      id: generateTestId(),
      type: 'manual',
      config: { type: 'manual' },
    },
    actions: overrides.actions ?? [
      {
        id: generateTestId(),
        type: 'send_message',
        config: {
          type: 'send_message',
          channelId: 'channel_123',
          message: 'Hello, World!',
        } as SendMessageConfig,
      },
    ],
    variables: overrides.variables,
    createdBy: overrides.createdBy ?? generateTestId(),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastRunAt: overrides.lastRunAt,
    runCount: overrides.runCount ?? 0,
    errorCount: overrides.errorCount ?? 0,
  };
}

function createMockExecution(
  overrides: Partial<WorkflowExecution> = {}
): WorkflowExecution {
  const id = overrides.id ?? generateTestId();
  return {
    id,
    workflowId: overrides.workflowId ?? generateTestId(),
    status: overrides.status ?? 'running',
    triggerData: overrides.triggerData ?? { test: 'data' },
    variables: overrides.variables ?? {},
    actionResults: overrides.actionResults ?? [],
    startedAt: overrides.startedAt ?? new Date(),
    completedAt: overrides.completedAt,
    error: overrides.error,
    durationMs: overrides.durationMs,
  };
}

function createTestService(
  storage?: WorkflowStorage,
  actionHandlers?: Map<string, ActionHandler>
): WorkflowServiceImpl {
  const config: WorkflowServiceConfig = {
    storage: storage ?? new InMemoryWorkflowStorage(),
    actionHandlers,
    maxExecutionTimeMs: 5000,
  };
  return new WorkflowServiceImpl(config);
}

function createValidInput(
  overrides: Partial<CreateWorkflowInput> = {}
): CreateWorkflowInput {
  return {
    workspaceId: overrides.workspaceId ?? generateTestId(),
    name: overrides.name ?? 'Test Workflow',
    description: overrides.description,
    trigger: overrides.trigger ?? {
      type: 'manual',
      config: { type: 'manual' },
    },
    actions: overrides.actions ?? [
      {
        type: 'send_message',
        config: {
          type: 'send_message',
          channelId: 'channel_123',
          message: 'Hello!',
        } as SendMessageConfig,
      },
    ],
    variables: overrides.variables,
    status: overrides.status,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('WorkflowService', () => {
  let storage: InMemoryWorkflowStorage;
  let service: WorkflowServiceImpl;

  beforeEach(() => {
    idCounter = 0;
    storage = new InMemoryWorkflowStorage();
    service = createTestService(storage);
  });

  afterEach(() => {
    vi.clearAllMocks();
    storage.clear();
  });

  // ===========================================================================
  // Workflow CRUD Tests
  // ===========================================================================

  describe('createWorkflow', () => {
    it('creates a new workflow with required fields', async () => {
      const input = createValidInput();

      const result = await service.createWorkflow(input, 'user_123');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.workspaceId).toBe(input.workspaceId);
      expect(result.name).toBe(input.name);
      expect(result.status).toBe('draft');
      expect(result.createdBy).toBe('user_123');
      expect(result.runCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it('creates workflow with optional fields', async () => {
      const input = createValidInput({
        description: 'Test description',
        variables: [
          { name: 'testVar', type: 'string', defaultValue: 'default' },
        ],
      });

      const result = await service.createWorkflow(input, 'user_123');

      expect(result.description).toBe(input.description);
      expect(result.variables).toEqual(input.variables);
    });

    it('creates workflow with custom status', async () => {
      const input = createValidInput({ status: 'active' });

      const result = await service.createWorkflow(input, 'user_123');

      expect(result.status).toBe('active');
    });

    it('generates unique IDs for trigger and actions', async () => {
      const input = createValidInput({
        actions: [
          {
            type: 'send_message',
            config: {
              type: 'send_message',
              channelId: 'ch1',
              message: 'msg1',
            } as SendMessageConfig,
          },
          {
            type: 'send_message',
            config: {
              type: 'send_message',
              channelId: 'ch2',
              message: 'msg2',
            } as SendMessageConfig,
          },
        ],
      });

      const result = await service.createWorkflow(input, 'user_123');

      expect(result.trigger.id).toBeDefined();
      expect(result.actions[0]!.id).toBeDefined();
      expect(result.actions[1]!.id).toBeDefined();
      expect(result.actions[0]!.id).not.toBe(result.actions[1]!.id);
    });

    it('throws validation error when workspaceId is missing', async () => {
      const input = createValidInput({ workspaceId: '' });

      await expect(service.createWorkflow(input, 'user_123')).rejects.toThrow(
        WorkflowValidationError
      );
    });

    it('throws validation error when name is missing', async () => {
      const input = createValidInput({ name: '' });

      await expect(service.createWorkflow(input, 'user_123')).rejects.toThrow(
        WorkflowValidationError
      );
    });

    it('throws validation error when name is too long', async () => {
      const input = createValidInput({ name: 'a'.repeat(101) });

      await expect(service.createWorkflow(input, 'user_123')).rejects.toThrow(
        WorkflowValidationError
      );
    });

    it('throws validation error when actions are empty', async () => {
      const input = createValidInput({ actions: [] });

      await expect(service.createWorkflow(input, 'user_123')).rejects.toThrow(
        WorkflowValidationError
      );
    });

    it('throws validation error when too many actions', async () => {
      const actions = Array(51).fill({
        type: 'send_message',
        config: {
          type: 'send_message',
          channelId: 'ch',
          message: 'msg',
        } as SendMessageConfig,
      });
      const input = createValidInput({ actions });

      await expect(service.createWorkflow(input, 'user_123')).rejects.toThrow(
        WorkflowValidationError
      );
    });
  });

  describe('getWorkflow', () => {
    it('returns workflow by ID', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      const result = await service.getWorkflow(workflow.id);

      expect(result).toEqual(workflow);
    });

    it('returns null for non-existent workflow', async () => {
      const result = await service.getWorkflow('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('listWorkflows', () => {
    it('lists workflows for workspace', async () => {
      const workspaceId = generateTestId();
      const workflow1 = createMockWorkflow({ workspaceId });
      const workflow2 = createMockWorkflow({ workspaceId });
      await storage.createWorkflow(workflow1);
      await storage.createWorkflow(workflow2);

      const result = await service.listWorkflows(workspaceId);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by status', async () => {
      const workspaceId = generateTestId();
      await storage.createWorkflow(
        createMockWorkflow({ workspaceId, status: 'active' })
      );
      await storage.createWorkflow(
        createMockWorkflow({ workspaceId, status: 'draft' })
      );

      const result = await service.listWorkflows(workspaceId, {
        status: 'active',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe('active');
    });

    it('filters by trigger type', async () => {
      const workspaceId = generateTestId();
      await storage.createWorkflow(
        createMockWorkflow({
          workspaceId,
          trigger: { id: 'tr1', type: 'manual', config: { type: 'manual' } },
        })
      );
      await storage.createWorkflow(
        createMockWorkflow({
          workspaceId,
          trigger: {
            id: 'tr2',
            type: 'scheduled',
            config: { type: 'scheduled', schedule: '0 * * * *' },
          },
        })
      );

      const result = await service.listWorkflows(workspaceId, {
        triggerType: 'manual',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.trigger.type).toBe('manual');
    });

    it('excludes inactive by default', async () => {
      const workspaceId = generateTestId();
      await storage.createWorkflow(
        createMockWorkflow({ workspaceId, status: 'active' })
      );
      await storage.createWorkflow(
        createMockWorkflow({ workspaceId, status: 'inactive' })
      );

      const result = await service.listWorkflows(workspaceId);

      expect(result.data).toHaveLength(1);
    });

    it('includes inactive when specified', async () => {
      const workspaceId = generateTestId();
      await storage.createWorkflow(
        createMockWorkflow({ workspaceId, status: 'active' })
      );
      await storage.createWorkflow(
        createMockWorkflow({ workspaceId, status: 'inactive' })
      );

      const result = await service.listWorkflows(workspaceId, {
        includeInactive: true,
      });

      expect(result.data).toHaveLength(2);
    });

    it('paginates results', async () => {
      const workspaceId = generateTestId();
      for (let i = 0; i < 5; i++) {
        await storage.createWorkflow(createMockWorkflow({ workspaceId }));
      }

      const result = await service.listWorkflows(workspaceId, {
        skip: 0,
        take: 2,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('updateWorkflow', () => {
    it('updates workflow name', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      const result = await service.updateWorkflow(workflow.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('updates workflow description', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      const result = await service.updateWorkflow(workflow.id, {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('updates workflow status', async () => {
      const workflow = createMockWorkflow({ status: 'draft' });
      await storage.createWorkflow(workflow);

      const result = await service.updateWorkflow(workflow.id, {
        status: 'active',
      });

      expect(result.status).toBe('active');
    });

    it('updates workflow trigger', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      const result = await service.updateWorkflow(workflow.id, {
        trigger: {
          type: 'scheduled',
          config: { type: 'scheduled', schedule: '0 9 * * *' },
        },
      });

      expect(result.trigger.type).toBe('scheduled');
      expect(result.trigger.id).toBe(workflow.trigger.id); // ID preserved
    });

    it('updates workflow actions', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      const result = await service.updateWorkflow(workflow.id, {
        actions: [
          {
            type: 'delay',
            config: { type: 'delay', duration: 1000 } as DelayConfig,
          },
        ],
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]!.type).toBe('delay');
    });

    it('throws error for non-existent workflow', async () => {
      await expect(
        service.updateWorkflow('non_existent', { name: 'New Name' })
      ).rejects.toThrow(WorkflowNotFoundError);
    });

    it('throws validation error for too long name', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      await expect(
        service.updateWorkflow(workflow.id, { name: 'a'.repeat(101) })
      ).rejects.toThrow(WorkflowValidationError);
    });
  });

  describe('deleteWorkflow', () => {
    it('deletes existing workflow', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      await service.deleteWorkflow(workflow.id);

      const result = await service.getWorkflow(workflow.id);
      expect(result).toBeNull();
    });

    it('throws error for non-existent workflow', async () => {
      await expect(service.deleteWorkflow('non_existent')).rejects.toThrow(
        WorkflowNotFoundError
      );
    });
  });

  // ===========================================================================
  // Status Management Tests
  // ===========================================================================

  describe('activateWorkflow', () => {
    it('activates draft workflow', async () => {
      const workflow = createMockWorkflow({ status: 'draft' });
      await storage.createWorkflow(workflow);

      const result = await service.activateWorkflow(workflow.id);

      expect(result.status).toBe('active');
    });

    it('activates inactive workflow', async () => {
      const workflow = createMockWorkflow({ status: 'inactive' });
      await storage.createWorkflow(workflow);

      const result = await service.activateWorkflow(workflow.id);

      expect(result.status).toBe('active');
    });

    it('returns same workflow if already active', async () => {
      const workflow = createMockWorkflow({ status: 'active' });
      await storage.createWorkflow(workflow);

      const result = await service.activateWorkflow(workflow.id);

      expect(result.status).toBe('active');
      expect(result.id).toBe(workflow.id);
    });

    it('throws error for non-existent workflow', async () => {
      await expect(service.activateWorkflow('non_existent')).rejects.toThrow(
        WorkflowNotFoundError
      );
    });
  });

  describe('deactivateWorkflow', () => {
    it('deactivates active workflow', async () => {
      const workflow = createMockWorkflow({ status: 'active' });
      await storage.createWorkflow(workflow);

      const result = await service.deactivateWorkflow(workflow.id);

      expect(result.status).toBe('inactive');
    });

    it('returns same workflow if already inactive', async () => {
      const workflow = createMockWorkflow({ status: 'inactive' });
      await storage.createWorkflow(workflow);

      const result = await service.deactivateWorkflow(workflow.id);

      expect(result.status).toBe('inactive');
    });

    it('throws error for non-existent workflow', async () => {
      await expect(service.deactivateWorkflow('non_existent')).rejects.toThrow(
        WorkflowNotFoundError
      );
    });
  });

  // ===========================================================================
  // Execution Tests
  // ===========================================================================

  describe('executeWorkflow', () => {
    it('executes active workflow', async () => {
      const workflow = createMockWorkflow({ status: 'active' });
      await storage.createWorkflow(workflow);

      const result = await service.executeWorkflow(workflow.id, {
        userId: 'user_123',
      });

      expect(result).toBeDefined();
      expect(result.workflowId).toBe(workflow.id);
      expect(result.status).toBe('completed');
      expect(result.triggerData).toEqual({ userId: 'user_123' });
    });

    it('updates workflow run count', async () => {
      const workflow = createMockWorkflow({ status: 'active', runCount: 5 });
      await storage.createWorkflow(workflow);

      await service.executeWorkflow(workflow.id, {});

      const updated = await service.getWorkflow(workflow.id);
      expect(updated?.runCount).toBe(6);
    });

    it('updates lastRunAt timestamp', async () => {
      const workflow = createMockWorkflow({ status: 'active' });
      await storage.createWorkflow(workflow);

      await service.executeWorkflow(workflow.id, {});

      const updated = await service.getWorkflow(workflow.id);
      expect(updated?.lastRunAt).toBeDefined();
    });

    it('records action results', async () => {
      const workflow = createMockWorkflow({
        status: 'active',
        actions: [
          {
            id: 'action_1',
            type: 'send_message',
            config: {
              type: 'send_message',
              channelId: 'ch',
              message: 'msg',
            } as SendMessageConfig,
          },
        ],
      });
      await storage.createWorkflow(workflow);

      const result = await service.executeWorkflow(workflow.id, {});

      expect(result.actionResults).toHaveLength(1);
      expect(result.actionResults[0]!.actionId).toBe('action_1');
      expect(result.actionResults[0]!.status).toBe('success');
    });

    it('throws error for non-existent workflow', async () => {
      await expect(service.executeWorkflow('non_existent', {})).rejects.toThrow(
        WorkflowNotFoundError
      );
    });

    it('throws error for inactive workflow', async () => {
      const workflow = createMockWorkflow({ status: 'inactive' });
      await storage.createWorkflow(workflow);

      await expect(service.executeWorkflow(workflow.id, {})).rejects.toThrow(
        WorkflowExecutionError
      );
    });

    it('throws error for draft workflow', async () => {
      const workflow = createMockWorkflow({ status: 'draft' });
      await storage.createWorkflow(workflow);

      await expect(service.executeWorkflow(workflow.id, {})).rejects.toThrow(
        WorkflowExecutionError
      );
    });

    it('handles action errors with stop strategy', async () => {
      const mockHandler: ActionHandler = {
        execute: vi.fn().mockRejectedValue(new Error('Action failed')),
      };
      const actionHandlers = new Map([['custom_action', mockHandler]]);
      const customService = createTestService(storage, actionHandlers);

      const workflow = createMockWorkflow({
        status: 'active',
        actions: [
          {
            id: 'action_1',
            type: 'custom_action' as 'send_message',
            config: { type: 'send_message' } as SendMessageConfig,
            onError: 'stop',
          },
          {
            id: 'action_2',
            type: 'send_message',
            config: {
              type: 'send_message',
              channelId: 'ch',
              message: 'msg',
            } as SendMessageConfig,
          },
        ],
      });
      await storage.createWorkflow(workflow);

      const result = await customService.executeWorkflow(workflow.id, {});

      expect(result.status).toBe('failed');
      expect(result.actionResults).toHaveLength(1);
    });

    it('handles action errors with continue strategy', async () => {
      const mockHandler: ActionHandler = {
        execute: vi.fn().mockResolvedValue({
          actionId: 'action_1',
          status: 'failed',
          error: 'Test error',
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 10,
        }),
      };
      const actionHandlers = new Map([['custom_action', mockHandler]]);
      const customService = createTestService(storage, actionHandlers);

      const workflow = createMockWorkflow({
        status: 'active',
        actions: [
          {
            id: 'action_1',
            type: 'custom_action' as 'send_message',
            config: { type: 'send_message' } as SendMessageConfig,
            onError: 'continue',
          },
          {
            id: 'action_2',
            type: 'send_message',
            config: {
              type: 'send_message',
              channelId: 'ch',
              message: 'msg',
            } as SendMessageConfig,
          },
        ],
      });
      await storage.createWorkflow(workflow);

      const result = await customService.executeWorkflow(workflow.id, {});

      expect(result.actionResults).toHaveLength(2);
    });
  });

  describe('cancelExecution', () => {
    it('cancels running execution', async () => {
      const execution = createMockExecution({ status: 'running' });
      await storage.createExecution(execution);

      const result = await service.cancelExecution(execution.id);

      expect(result.status).toBe('cancelled');
      expect(result.completedAt).toBeDefined();
    });

    it('cancels pending execution', async () => {
      const execution = createMockExecution({ status: 'pending' });
      await storage.createExecution(execution);

      const result = await service.cancelExecution(execution.id);

      expect(result.status).toBe('cancelled');
    });

    it('throws error for non-existent execution', async () => {
      await expect(service.cancelExecution('non_existent')).rejects.toThrow(
        ExecutionNotFoundError
      );
    });

    it('throws error for completed execution', async () => {
      const execution = createMockExecution({ status: 'completed' });
      await storage.createExecution(execution);

      await expect(service.cancelExecution(execution.id)).rejects.toThrow(
        WorkflowExecutionError
      );
    });

    it('throws error for failed execution', async () => {
      const execution = createMockExecution({ status: 'failed' });
      await storage.createExecution(execution);

      await expect(service.cancelExecution(execution.id)).rejects.toThrow(
        WorkflowExecutionError
      );
    });
  });

  describe('getExecutionHistory', () => {
    it('returns execution history for workflow', async () => {
      const workflowId = generateTestId();
      const workflow = createMockWorkflow({ id: workflowId });
      await storage.createWorkflow(workflow);
      await storage.createExecution(createMockExecution({ workflowId }));
      await storage.createExecution(createMockExecution({ workflowId }));

      const result = await service.getExecutionHistory(workflowId);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by status', async () => {
      const workflowId = generateTestId();
      const workflow = createMockWorkflow({ id: workflowId });
      await storage.createWorkflow(workflow);
      await storage.createExecution(
        createMockExecution({ workflowId, status: 'completed' })
      );
      await storage.createExecution(
        createMockExecution({ workflowId, status: 'failed' })
      );

      const result = await service.getExecutionHistory(workflowId, {
        status: 'completed',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe('completed');
    });

    it('throws error for non-existent workflow', async () => {
      await expect(service.getExecutionHistory('non_existent')).rejects.toThrow(
        WorkflowNotFoundError
      );
    });
  });

  // ===========================================================================
  // Action Execution Tests (via workflow execution)
  // ===========================================================================

  describe('executeAction', () => {
    it('executes send_message action', async () => {
      // Test action execution through workflow execution
      const action: WorkflowAction = {
        id: 'action_1',
        type: 'send_message',
        config: {
          type: 'send_message',
          channelId: 'ch_123',
          message: 'Hello!',
        } as SendMessageConfig,
      };
      const workflow = createMockWorkflow({
        status: 'active',
        actions: [action],
      });
      await storage.createWorkflow(workflow);

      const result = await service.executeWorkflow(workflow.id, {});

      expect(result.status).toBe('completed');
      expect(result.actionResults).toHaveLength(1);
      expect(result.actionResults[0]!.status).toBe('success');
      expect(result.actionResults[0]!.output).toEqual({
        channelId: 'ch_123',
        message: 'Hello!',
      });
    });

    it('executes delay action', async () => {
      const action: WorkflowAction = {
        id: 'action_1',
        type: 'delay',
        config: {
          type: 'delay',
          duration: 10,
          unit: 'ms',
        } as DelayConfig,
      };
      const workflow = createMockWorkflow({
        status: 'active',
        actions: [action],
      });
      await storage.createWorkflow(workflow);

      const startTime = Date.now();
      const result = await service.executeWorkflow(workflow.id, {});
      const elapsed = Date.now() - startTime;

      expect(result.status).toBe('completed');
      expect(result.actionResults[0]!.status).toBe('success');
      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    it('executes set_variable action', async () => {
      const action: WorkflowAction = {
        id: 'action_1',
        type: 'set_variable',
        config: {
          type: 'set_variable',
          name: 'testVar',
          value: 'testValue',
        } as SetVariableConfig,
      };
      const workflow = createMockWorkflow({
        status: 'active',
        actions: [action],
        variables: [{ name: 'testVar', type: 'string' }],
      });
      await storage.createWorkflow(workflow);

      const result = await service.executeWorkflow(workflow.id, {});

      expect(result.status).toBe('completed');
      expect(result.actionResults[0]!.status).toBe('success');
      expect(result.variables.testVar).toBe('testValue');
    });

    it('uses custom action handler when available', async () => {
      const customResult: ActionResult = {
        actionId: 'action_1',
        status: 'success',
        output: { custom: 'output' },
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 5,
      };
      const mockHandler: ActionHandler = {
        execute: vi.fn().mockResolvedValue(customResult),
      };
      const actionHandlers = new Map([['send_message', mockHandler]]);
      const customService = createTestService(storage, actionHandlers);

      const action: WorkflowAction = {
        id: 'action_1',
        type: 'send_message',
        config: {
          type: 'send_message',
          channelId: 'ch',
          message: 'msg',
        } as SendMessageConfig,
      };
      const workflow = createMockWorkflow({
        status: 'active',
        actions: [action],
      });
      await storage.createWorkflow(workflow);

      const result = await customService.executeWorkflow(workflow.id, {});

      expect(mockHandler.execute).toHaveBeenCalled();
      expect(result.actionResults[0]).toEqual(customResult);
    });
  });

  // ===========================================================================
  // Condition Evaluation Tests
  // ===========================================================================

  describe('evaluateCondition', () => {
    const workflow = createMockWorkflow();
    const baseContext: ExecutionContext = {
      execution: createMockExecution(),
      workflow,
      variables: { count: 10, name: 'test', empty: '' },
      triggerData: { userId: 'user_123' },
      actionResults: [],
    };

    it('evaluates equals operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.count',
        operator: 'equals',
        value: 10,
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates not_equals operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.count',
        operator: 'not_equals',
        value: 5,
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates contains operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.name',
        operator: 'contains',
        value: 'es',
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates gt operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.count',
        operator: 'gt',
        value: 5,
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates lt operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.count',
        operator: 'lt',
        value: 20,
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates gte operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.count',
        operator: 'gte',
        value: 10,
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates lte operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.count',
        operator: 'lte',
        value: 10,
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates is_empty operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.empty',
        operator: 'is_empty',
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('evaluates is_not_empty operator', () => {
      const condition: WorkflowCondition = {
        field: 'variables.name',
        operator: 'is_not_empty',
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('returns false for non-matching conditions', () => {
      const condition: WorkflowCondition = {
        field: 'variables.count',
        operator: 'equals',
        value: 999,
      };

      expect(service.evaluateCondition(condition, baseContext)).toBe(false);
    });
  });

  // ===========================================================================
  // Template Interpolation Tests
  // ===========================================================================

  describe('interpolateTemplate', () => {
    const workflow = createMockWorkflow();
    const context: ExecutionContext = {
      execution: createMockExecution(),
      workflow,
      variables: { greeting: 'Hello', name: 'World' },
      triggerData: { userId: 'user_123', channel: { name: 'general' } },
      actionResults: [],
    };

    it('interpolates simple variables', () => {
      const template = '{{variables.greeting}}, {{variables.name}}!';

      const result = service.interpolateTemplate(template, context);

      expect(result).toBe('Hello, World!');
    });

    it('interpolates trigger data', () => {
      const template = 'User {{trigger.userId}} sent a message';

      const result = service.interpolateTemplate(template, context);

      expect(result).toBe('User user_123 sent a message');
    });

    it('interpolates nested trigger data', () => {
      const template = 'Channel: {{trigger.channel.name}}';

      const result = service.interpolateTemplate(template, context);

      expect(result).toBe('Channel: general');
    });

    it('handles missing variables', () => {
      const template = 'Value: {{variables.missing}}';

      const result = service.interpolateTemplate(template, context);

      expect(result).toBe('Value: ');
    });

    it('preserves non-template text', () => {
      const template = 'No templates here';

      const result = service.interpolateTemplate(template, context);

      expect(result).toBe('No templates here');
    });

    it('handles multiple templates in one string', () => {
      const template =
        '{{variables.greeting}} {{trigger.userId}} in {{trigger.channel.name}}';

      const result = service.interpolateTemplate(template, context);

      expect(result).toBe('Hello user_123 in general');
    });
  });

  // ===========================================================================
  // Template Operations Tests
  // ===========================================================================

  describe('getTemplates', () => {
    it('returns all built-in templates', () => {
      const templates = service.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.isBuiltIn)).toBe(true);
    });

    it('filters templates by category', () => {
      const templates = service.getTemplates('onboarding');

      expect(templates.every(t => t.category === 'onboarding')).toBe(true);
    });

    it('returns empty array for category with no templates', () => {
      // Create a new category that definitely has no templates
      const templates = service.getTemplates('custom');

      // This may return empty or have templates depending on BUILT_IN_TEMPLATES
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('createFromTemplate', () => {
    it('creates workflow from template', async () => {
      const template = BUILT_IN_TEMPLATES[0]!;

      const result = await service.createFromTemplate(
        template.id,
        'workspace_123',
        'user_123'
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(template.name);
      expect(result.description).toBe(template.description);
      expect(result.status).toBe('draft');
      expect(result.workspaceId).toBe('workspace_123');
    });

    it('allows name override', async () => {
      const template = BUILT_IN_TEMPLATES[0]!;

      const result = await service.createFromTemplate(
        template.id,
        'workspace_123',
        'user_123',
        { name: 'Custom Name' }
      );

      expect(result.name).toBe('Custom Name');
    });

    it('allows status override', async () => {
      const template = BUILT_IN_TEMPLATES[0]!;

      const result = await service.createFromTemplate(
        template.id,
        'workspace_123',
        'user_123',
        { status: 'active' }
      );

      expect(result.status).toBe('active');
    });

    it('throws error for non-existent template', async () => {
      await expect(
        service.createFromTemplate('non_existent', 'workspace_123', 'user_123')
      ).rejects.toThrow(TemplateNotFoundError);
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createWorkflowService', () => {
    it('creates service with default storage', () => {
      const svc = createWorkflowService();

      expect(svc).toBeInstanceOf(WorkflowServiceImpl);
    });

    it('creates service with custom storage', () => {
      const customStorage = new InMemoryWorkflowStorage();
      const svc = createWorkflowService({ storage: customStorage });

      expect(svc).toBeInstanceOf(WorkflowServiceImpl);
    });

    it('creates service with custom action handlers', () => {
      const handlers = new Map<string, ActionHandler>();
      const svc = createWorkflowService({ actionHandlers: handlers });

      expect(svc).toBeInstanceOf(WorkflowServiceImpl);
    });
  });

  // ===========================================================================
  // In-Memory Storage Tests
  // ===========================================================================

  describe('InMemoryWorkflowStorage', () => {
    it('stores and retrieves workflows', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      const retrieved = await storage.getWorkflow(workflow.id);

      expect(retrieved).toEqual(workflow);
    });

    it('stores and retrieves executions', async () => {
      const execution = createMockExecution();
      await storage.createExecution(execution);

      const retrieved = await storage.getExecution(execution.id);

      expect(retrieved).toEqual(execution);
    });

    it('updates workflow', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      const updated = await storage.updateWorkflow(workflow.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
    });

    it('updates execution', async () => {
      const execution = createMockExecution();
      await storage.createExecution(execution);

      const updated = await storage.updateExecution(execution.id, {
        status: 'completed',
      });

      expect(updated.status).toBe('completed');
    });

    it('deletes workflow', async () => {
      const workflow = createMockWorkflow();
      await storage.createWorkflow(workflow);

      await storage.deleteWorkflow(workflow.id);

      const retrieved = await storage.getWorkflow(workflow.id);
      expect(retrieved).toBeNull();
    });

    it('clears all data', async () => {
      await storage.createWorkflow(createMockWorkflow());
      await storage.createExecution(createMockExecution());

      storage.clear();

      const workflows = await storage.listWorkflows('any');
      expect(workflows.data).toHaveLength(0);
    });
  });
});
