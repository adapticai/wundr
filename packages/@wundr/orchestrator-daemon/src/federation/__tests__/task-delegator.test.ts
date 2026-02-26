/**
 * Tests for TaskDelegator
 */
import { TaskDelegator, InMemoryDelegationTracker } from '../task-delegator';

import type { Task } from '../../types';
import type { OrchestratorInfo, DelegationCallback } from '../types';

describe('TaskDelegator', () => {
  let delegator: TaskDelegator;
  let tracker: InMemoryDelegationTracker;

  beforeEach(() => {
    tracker = new InMemoryDelegationTracker();
    delegator = new TaskDelegator(tracker);
  });

  describe('selectBestOrchestrator', () => {
    it('should select orchestrator with best capability match', () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrators: OrchestratorInfo[] = [
        {
          id: 'orch-1',
          name: 'Orchestrator 1',
          tier: 1,
          capabilities: ['research', 'analysis'],
          currentLoad: 5,
          maxLoad: 10,
          available: true,
          lastSeen: new Date(),
        },
        {
          id: 'orch-2',
          name: 'Orchestrator 2',
          tier: 2,
          capabilities: ['code', 'testing'],
          currentLoad: 3,
          maxLoad: 10,
          available: true,
          lastSeen: new Date(),
        },
      ];

      const selected = delegator.selectBestOrchestrator(task, orchestrators);

      expect(selected).toBeDefined();
      expect(selected?.id).toBe('orch-2');
    });

    it('should return null if no orchestrators available', () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const selected = delegator.selectBestOrchestrator(task, []);

      expect(selected).toBeNull();
    });

    it('should exclude orchestrators based on context', () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrators: OrchestratorInfo[] = [
        {
          id: 'orch-1',
          name: 'Orchestrator 1',
          tier: 1,
          capabilities: ['code'],
          currentLoad: 5,
          maxLoad: 10,
          available: true,
          lastSeen: new Date(),
        },
        {
          id: 'orch-2',
          name: 'Orchestrator 2',
          tier: 2,
          capabilities: ['code'],
          currentLoad: 3,
          maxLoad: 10,
          available: true,
          lastSeen: new Date(),
        },
      ];

      const selected = delegator.selectBestOrchestrator(task, orchestrators, {
        excludedOrchestrators: ['orch-2'],
      });

      expect(selected).toBeDefined();
      expect(selected?.id).toBe('orch-1');
    });

    it('should prefer orchestrators with lower load', () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrators: OrchestratorInfo[] = [
        {
          id: 'orch-1',
          name: 'Orchestrator 1',
          tier: 1,
          capabilities: ['code'],
          currentLoad: 9,
          maxLoad: 10,
          available: true,
          lastSeen: new Date(),
        },
        {
          id: 'orch-2',
          name: 'Orchestrator 2',
          tier: 1,
          capabilities: ['code'],
          currentLoad: 2,
          maxLoad: 10,
          available: true,
          lastSeen: new Date(),
        },
      ];

      const selected = delegator.selectBestOrchestrator(task, orchestrators);

      expect(selected).toBeDefined();
      expect(selected?.id).toBe('orch-2');
    });
  });

  describe('delegate', () => {
    it('should create a delegation and return delegation ID', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrator: OrchestratorInfo = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        tier: 1,
        capabilities: ['code'],
        currentLoad: 5,
        maxLoad: 10,
        available: true,
        lastSeen: new Date(),
      };

      const delegationId = await delegator.delegate(
        task,
        orchestrator,
        {},
        'local'
      );

      expect(delegationId).toBeDefined();
      expect(typeof delegationId).toBe('string');

      const delegation = await delegator.getDelegationStatus(delegationId);
      expect(delegation).toBeDefined();
      expect(delegation?.status).toBe('in_progress');
    });
  });

  describe('handleCallback', () => {
    it('should update delegation status on callback', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrator: OrchestratorInfo = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        tier: 1,
        capabilities: ['code'],
        currentLoad: 5,
        maxLoad: 10,
        available: true,
        lastSeen: new Date(),
      };

      const delegationId = await delegator.delegate(
        task,
        orchestrator,
        {},
        'local'
      );

      const callback: DelegationCallback = {
        delegationId,
        status: 'completed',
        result: {
          success: true,
          timestamp: new Date(),
          metadata: { output: 'Task completed successfully' },
        },
        timestamp: new Date(),
      };

      await delegator.handleCallback(callback);

      const delegation = await delegator.getDelegationStatus(delegationId);
      expect(delegation?.status).toBe('completed');
      expect(delegation?.result?.success).toBe(true);
    });
  });

  describe('cancelDelegation', () => {
    it('should cancel a pending delegation', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrator: OrchestratorInfo = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        tier: 1,
        capabilities: ['code'],
        currentLoad: 5,
        maxLoad: 10,
        available: true,
        lastSeen: new Date(),
      };

      const delegationId = await delegator.delegate(
        task,
        orchestrator,
        {},
        'local'
      );
      await delegator.cancelDelegation(delegationId);

      const delegation = await delegator.getDelegationStatus(delegationId);
      expect(delegation?.status).toBe('cancelled');
    });

    it('should throw error when cancelling completed delegation', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrator: OrchestratorInfo = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        tier: 1,
        capabilities: ['code'],
        currentLoad: 5,
        maxLoad: 10,
        available: true,
        lastSeen: new Date(),
      };

      const delegationId = await delegator.delegate(
        task,
        orchestrator,
        {},
        'local'
      );

      // Complete the delegation
      const callback: DelegationCallback = {
        delegationId,
        status: 'completed',
        result: { success: true, timestamp: new Date() },
        timestamp: new Date(),
      };
      await delegator.handleCallback(callback);

      // Try to cancel
      await expect(delegator.cancelDelegation(delegationId)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove old completed delegations', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'code',
        description: 'Write a function',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orchestrator: OrchestratorInfo = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        tier: 1,
        capabilities: ['code'],
        currentLoad: 5,
        maxLoad: 10,
        available: true,
        lastSeen: new Date(),
      };

      const delegationId = await delegator.delegate(
        task,
        orchestrator,
        {},
        'local'
      );

      // Complete the delegation
      const callback: DelegationCallback = {
        delegationId,
        status: 'completed',
        result: { success: true, timestamp: new Date() },
        timestamp: new Date(),
      };
      await delegator.handleCallback(callback);

      // Cleanup with cutoff in the future (should delete this delegation)
      const futureDate = new Date(Date.now() + 1000000);
      const cleaned = await delegator.cleanup(futureDate);

      expect(cleaned).toBe(1);

      const delegation = await delegator.getDelegationStatus(delegationId);
      expect(delegation).toBeNull();
    });
  });
});
