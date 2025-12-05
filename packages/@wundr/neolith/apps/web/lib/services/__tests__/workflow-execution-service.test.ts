/**
 * Workflow Execution Service Tests
 *
 * @module lib/services/__tests__/workflow-execution-service.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  registerActionHandler,
  executeWorkflowActions,
  createExecutionRecord,
  completeExecution,
  cancelExecution,
} from '../workflow-execution-service';

import type { ExecutionContext } from '../workflow-execution-service';
import type { WorkflowAction } from '@/lib/validations/workflow';

// Mock Prisma
vi.mock('@neolith/database', () => ({
  prisma: {
    workflowExecution: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    workflow: {
      update: vi.fn(),
    },
    task: {
      create: vi.fn(),
    },
  },
}));

describe('Workflow Execution Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeWorkflowActions', () => {
    it('should execute all actions successfully', async () => {
      const actions: WorkflowAction[] = [
        { type: 'wait', config: { durationMs: 10 } },
        { type: 'send_notification', config: { message: 'Test' } },
      ];

      const context = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const result = await executeWorkflowActions(actions, context);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].status).toBe('success');
      expect(result.steps[1].status).toBe('success');
      expect(result.error).toBeUndefined();
    });

    it('should handle action failures with stop behavior', async () => {
      const actions: WorkflowAction[] = [
        { type: 'success_action', config: {} },
        {
          type: 'failing_action',
          config: {},
          onError: 'stop',
        },
        { type: 'should_not_execute', config: {} },
      ];

      // Register failing action handler
      registerActionHandler('failing_action', async () => ({
        success: false,
        error: 'Action failed',
      }));

      const context = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const result = await executeWorkflowActions(actions, context);

      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[1].status).toBe('failed');
      expect(result.error).toBe('Action failed');
    });

    it('should continue execution when onError is continue', async () => {
      const actions: WorkflowAction[] = [
        {
          type: 'failing_action',
          config: {},
          onError: 'continue',
        },
        { type: 'success_action', config: {} },
      ];

      registerActionHandler('failing_action', async () => ({
        success: false,
        error: 'Action failed',
      }));

      const context = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const result = await executeWorkflowActions(actions, context);

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].status).toBe('failed');
      expect(result.steps[1].status).toBe('success');
    });

    it('should call progress callback for each step', async () => {
      const actions: WorkflowAction[] = [
        { type: 'action1', config: {} },
        { type: 'action2', config: {} },
      ];

      const context = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const progressCallback = vi.fn();
      await executeWorkflowActions(actions, context, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle cancellation signal', async () => {
      const actions: WorkflowAction[] = [
        { type: 'action1', config: {} },
        { type: 'action2', config: {} },
        { type: 'action3', config: {} },
      ];

      const context = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const cancellationSignal = { isCancelled: false };

      // Cancel after first step
      const progressCallback = vi.fn(async () => {
        cancellationSignal.isCancelled = true;
      });

      const result = await executeWorkflowActions(
        actions,
        context,
        progressCallback,
        cancellationSignal,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution cancelled by user');
      expect(result.steps.length).toBeLessThan(3);
    });
  });

  describe('Custom Action Handlers', () => {
    it('should execute wait action', async () => {
      const action: WorkflowAction = {
        type: 'wait',
        config: { durationMs: 10 },
      };

      const context: ExecutionContext = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        previousStepResults: [],
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const result = await executeWorkflowActions([action], context);

      expect(result.success).toBe(true);
      expect(result.steps[0].output).toMatchObject({
        waited: true,
        durationMs: 10,
      });
    });

    it('should execute condition action', async () => {
      const action: WorkflowAction = {
        type: 'condition',
        config: {
          field: 'trigger.value',
          operator: 'equals',
          value: 42,
        },
      };

      const context: ExecutionContext = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: { value: 42 },
        previousStepResults: [],
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const result = await executeWorkflowActions([action], context);

      expect(result.success).toBe(true);
      expect(result.steps[0].output).toMatchObject({
        conditionMet: true,
        field: 'trigger.value',
        operator: 'equals',
        value: 42,
        actualValue: 42,
      });
    });

    it('should execute send_notification action', async () => {
      const action: WorkflowAction = {
        type: 'send_notification',
        config: {
          message: 'Test notification',
          recipient: 'user_123',
        },
      };

      const context: ExecutionContext = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        previousStepResults: [],
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const result = await executeWorkflowActions([action], context);

      expect(result.success).toBe(true);
      expect(result.steps[0].output).toMatchObject({
        notificationSent: true,
        message: 'Test notification',
        recipient: 'user_123',
      });
    });
  });

  describe('createExecutionRecord', () => {
    it('should create an execution record', async () => {
      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.create).mockResolvedValue({
        id: 'exec_new',
      } as never);

      const executionId = await createExecutionRecord({
        workflowId: 'wf_test',
        workspaceId: 'ws_test',
        triggeredBy: 'user_test',
        triggerType: 'manual',
        triggerData: { test: true },
      });

      expect(executionId).toBe('exec_new');
      expect(prisma.workflowExecution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workflowId: 'wf_test',
            workspaceId: 'ws_test',
            status: 'RUNNING',
            triggeredBy: 'user_test',
            triggerType: 'manual',
          }),
        }),
      );
    });
  });

  describe('completeExecution', () => {
    it('should complete execution successfully', async () => {
      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue({
        id: 'exec_test',
        workflowId: 'wf_test',
        startedAt: new Date('2024-01-01T00:00:00Z'),
      } as never);
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);
      vi.mocked(prisma.workflow.update).mockResolvedValue({} as never);

      await completeExecution({
        executionId: 'exec_test',
        success: true,
        steps: [],
      });

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exec_test' },
          data: expect.objectContaining({
            status: 'COMPLETED',
          }),
        }),
      );

      expect(prisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            successCount: { increment: 1 },
          }),
        }),
      );
    });

    it('should mark execution as failed', async () => {
      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue({
        id: 'exec_test',
        workflowId: 'wf_test',
        startedAt: new Date('2024-01-01T00:00:00Z'),
      } as never);
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);
      vi.mocked(prisma.workflow.update).mockResolvedValue({} as never);

      await completeExecution({
        executionId: 'exec_test',
        success: false,
        steps: [],
        error: 'Execution failed',
      });

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exec_test' },
          data: expect.objectContaining({
            status: 'FAILED',
            error: 'Execution failed',
          }),
        }),
      );

      expect(prisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureCount: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe('cancelExecution', () => {
    it('should cancel an execution', async () => {
      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      await cancelExecution('exec_test');

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exec_test' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            error: 'Cancelled by user',
          }),
        }),
      );
    });
  });

  describe('Custom Action Handler Registration', () => {
    it('should allow registering custom action handlers', async () => {
      const customHandler = vi.fn(async () => ({
        success: true,
        output: { custom: true },
      }));

      registerActionHandler('custom_action', customHandler);

      const action: WorkflowAction = {
        type: 'custom_action',
        config: { test: true },
      };

      const context: ExecutionContext = {
        workspaceId: 'ws_test',
        workflowId: 'wf_test',
        executionId: 'exec_test',
        triggerData: {},
        previousStepResults: [],
        userId: 'user_test',
      };

      const { prisma } = await import('@neolith/database');
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      const result = await executeWorkflowActions([action], context);

      expect(result.success).toBe(true);
      expect(customHandler).toHaveBeenCalled();
      expect(result.steps[0].output).toMatchObject({ custom: true });
    });
  });
});
