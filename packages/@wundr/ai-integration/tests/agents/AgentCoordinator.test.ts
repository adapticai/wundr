/**
 * Test suite for Agent Coordinator
 */

import { AgentCoordinator } from '../../src/agents/AgentCoordinator';
import { AgentConfig, Agent, Task } from '../../src/types';

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator;
  let mockConfig: AgentConfig;
  let mockAgent: Agent;
  let mockTask: Task;

  beforeEach(() => {
    mockConfig = {
      maxConcurrentAgents: 20,
      spawningStrategy: 'adaptive',
      healthCheckInterval: 5000, // Faster for testing
      autoRecovery: true,
      loadBalancing: true,
    };

    mockAgent = {
      id: 'test-agent-1',
      type: 'coder',
      category: 'core',
      capabilities: ['coding', 'implementation', 'refactoring'],
      status: 'idle',
      topology: 'adaptive',
      sessionId: 'test-session',
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 0,
        averageResponseTime: 0,
      },
    };

    mockTask = {
      id: 'test-task-1',
      title: 'Test Task',
      description: 'A test coding task',
      type: 'coding',
      priority: 'medium',
      status: 'pending',
      assignedAgents: [],
      requiredCapabilities: ['coding'],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    coordinator = new AgentCoordinator(mockConfig);
  });

  afterEach(async () => {
    if (coordinator) {
      await coordinator.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await coordinator.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized successfully');
    });

    it('should initialize agent pools', async () => {
      await coordinator.initialize();

      const metrics = await coordinator.getMetrics();
      expect(metrics.agentsByType).toBeDefined();
    });

    it('should start health monitoring', async () => {
      await coordinator.initialize();

      // Health monitoring should be active
      expect((coordinator as any).healthCheckTimer).toBeDefined();
    });
  });

  describe('Agent Registration', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should register agent successfully', async () => {
      await coordinator.registerAgent(mockAgent);

      const metrics = await coordinator.getMetrics();
      expect(metrics.totalAgents).toBe(1);
      expect(metrics.agentsByStatus.idle).toBe(1);
    });

    it('should emit agent-registered event', async () => {
      let eventEmitted = false;

      coordinator.on('agent-registered', agent => {
        expect(agent.id).toBe(mockAgent.id);
        eventEmitted = true;
      });

      await coordinator.registerAgent(mockAgent);

      expect(eventEmitted).toBe(true);
    });

    it('should reject invalid agents', async () => {
      const invalidAgent = { ...mockAgent, id: '' };

      await expect(
        coordinator.registerAgent(invalidAgent as Agent)
      ).rejects.toThrow();
    });

    it('should track agent in appropriate pools', async () => {
      await coordinator.registerAgent(mockAgent);

      const metrics = await coordinator.getMetrics();
      expect(metrics.agentsByCategory.core).toBe(1);
      expect(metrics.agentsByType.coder).toBe(1);
    });
  });

  describe('Agent Selection', () => {
    beforeEach(async () => {
      await coordinator.initialize();

      // Register multiple agents
      const agents = [
        {
          ...mockAgent,
          id: 'coder-1',
          type: 'coder',
          capabilities: ['coding'],
        },
        {
          ...mockAgent,
          id: 'reviewer-1',
          type: 'reviewer',
          capabilities: ['code-review'],
        },
        {
          ...mockAgent,
          id: 'tester-1',
          type: 'tester',
          capabilities: ['testing'],
        },
        {
          ...mockAgent,
          id: 'ml-dev-1',
          type: 'ml-developer',
          capabilities: ['machine-learning'],
        },
      ] as Agent[];

      for (const agent of agents) {
        await coordinator.registerAgent(agent);
      }
    });

    it('should select appropriate agents for coding tasks', async () => {
      const codingTask = {
        ...mockTask,
        type: 'coding' as const,
        requiredCapabilities: ['coding'],
      };

      const selectedAgents = await coordinator.selectAgentsForTask(codingTask);

      expect(selectedAgents.length).toBeGreaterThan(0);
      expect(
        selectedAgents.some(agent => agent.capabilities.includes('coding'))
      ).toBe(true);
    });

    it('should select agents with matching capabilities', async () => {
      const reviewTask = {
        ...mockTask,
        type: 'review' as const,
        requiredCapabilities: ['code-review'],
      };

      const selectedAgents = await coordinator.selectAgentsForTask(reviewTask);

      expect(selectedAgents.length).toBeGreaterThan(0);
      expect(
        selectedAgents.some(agent => agent.capabilities.includes('code-review'))
      ).toBe(true);
    });

    it('should prefer idle agents over busy ones', async () => {
      // Make one agent busy
      const busyAgent = await coordinator.selectAgentsForTask(mockTask);
      if (busyAgent.length > 0) {
        await coordinator.assignTask(mockTask, busyAgent);
      }

      const newTask = {
        ...mockTask,
        id: 'new-task',
        requiredCapabilities: ['coding'],
      };

      const selectedAgents = await coordinator.selectAgentsForTask(newTask);

      // Should prefer idle agents
      expect(selectedAgents.some(agent => agent.status === 'idle')).toBe(true);
    });

    it('should ensure agent diversity for complex tasks', async () => {
      const complexTask = {
        ...mockTask,
        type: 'coding' as const,
        requiredCapabilities: ['coding', 'testing', 'code-review'],
        description: 'Complex task requiring multiple skills',
      };

      const selectedAgents = await coordinator.selectAgentsForTask(complexTask);

      // Should select diverse agents
      const categories = [
        ...new Set(selectedAgents.map(agent => agent.category)),
      ];
      expect(categories.length).toBeGreaterThan(1);
    });
  });

  describe('Task Assignment', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      await coordinator.registerAgent(mockAgent);
    });

    it('should assign task to agents', async () => {
      const agents = [mockAgent];

      await coordinator.assignTask(mockTask, agents);

      expect(mockTask.assignedAgents).toContain(mockAgent.id);
      expect(mockAgent.status).toBe('active');
    });

    it('should emit task-assigned event', async () => {
      let eventEmitted = false;

      coordinator.on('task-assigned', ({ task, agents }) => {
        expect(task.id).toBe(mockTask.id);
        expect(agents).toContain(mockAgent);
        eventEmitted = true;
      });

      await coordinator.assignTask(mockTask, [mockAgent]);

      expect(eventEmitted).toBe(true);
    });

    it('should track agent assignments', async () => {
      await coordinator.assignTask(mockTask, [mockAgent]);

      const metrics = await coordinator.getMetrics();
      expect(metrics.activeTasks).toBe(1);
      expect(metrics.totalAssignments).toBe(1);
    });
  });

  describe('Task Completion', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      await coordinator.registerAgent(mockAgent);
      await coordinator.assignTask(mockTask, [mockAgent]);
    });

    it('should complete task successfully', async () => {
      const result = {
        success: true,
        executionTime: 2000,
        qualityScore: 0.85,
      };

      await coordinator.completeTask(mockTask.id, result);

      expect(mockAgent.status).toBe('idle');
      expect(mockAgent.metrics.tasksCompleted).toBe(1);
      expect(mockAgent.metrics.successRate).toBeGreaterThan(0);
    });

    it('should emit task-completed event', async () => {
      let eventEmitted = false;

      coordinator.on('task-completed', ({ taskId, result }) => {
        expect(taskId).toBe(mockTask.id);
        expect(result.success).toBe(true);
        eventEmitted = true;
      });

      await coordinator.completeTask(mockTask.id, { success: true });

      expect(eventEmitted).toBe(true);
    });

    it('should update agent metrics on completion', async () => {
      const initialCompleted = mockAgent.metrics.tasksCompleted;

      await coordinator.completeTask(mockTask.id, {
        success: true,
        executionTime: 1500,
      });

      expect(mockAgent.metrics.tasksCompleted).toBe(initialCompleted + 1);
      expect(mockAgent.metrics.averageResponseTime).toBe(1500);
    });

    it('should handle task failures', async () => {
      await coordinator.completeTask(mockTask.id, {
        success: false,
        error: 'Task failed',
      });

      expect(mockAgent.metrics.successRate).toBe(0);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      await coordinator.registerAgent(mockAgent);
    });

    it('should monitor agent health', async () => {
      // Wait for at least one health check cycle
      await new Promise(resolve => setTimeout(resolve, 100));

      // Health score should be calculated
      expect(mockAgent.metrics.healthScore).toBeDefined();
    });

    it('should detect unhealthy agents', async () => {
      // Make agent unhealthy
      mockAgent.metrics.successRate = 0.1;
      mockAgent.metrics.averageResponseTime = 15000;

      // Trigger health check
      await (coordinator as any).performHealthChecks();

      expect(mockAgent.metrics.healthScore).toBeLessThan(0.5);
    });

    it('should recover unhealthy agents when auto-recovery is enabled', async () => {
      // Make agent unhealthy
      mockAgent.metrics.healthScore = 0.2;
      mockAgent.status = 'error';

      let recoveryStarted = false;
      coordinator.on('agent-recovery-started', () => {
        recoveryStarted = true;
      });

      // Trigger health check
      await (coordinator as any).performHealthChecks();

      // Should attempt recovery
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(recoveryStarted).toBe(true);
    });
  });

  describe('Load Balancing', () => {
    beforeEach(async () => {
      await coordinator.initialize();

      // Register multiple similar agents
      const agents = Array.from({ length: 3 }, (_, i) => ({
        ...mockAgent,
        id: `agent-${i}`,
        metrics: { ...mockAgent.metrics },
      }));

      for (const agent of agents) {
        await coordinator.registerAgent(agent);
      }
    });

    it('should distribute tasks across available agents', async () => {
      const tasks = Array.from({ length: 3 }, (_, i) => ({
        ...mockTask,
        id: `task-${i}`,
      }));

      for (const task of tasks) {
        const selectedAgents = await coordinator.selectAgentsForTask(task);
        await coordinator.assignTask(task, selectedAgents.slice(0, 1));
      }

      const metrics = await coordinator.getMetrics();
      expect(metrics.agentsByStatus.active).toBeGreaterThan(0);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should provide comprehensive metrics', async () => {
      const metrics = await coordinator.getMetrics();

      expect(metrics).toHaveProperty('totalAgents');
      expect(metrics).toHaveProperty('agentsByStatus');
      expect(metrics).toHaveProperty('agentsByCategory');
      expect(metrics).toHaveProperty('agentsByType');
      expect(metrics).toHaveProperty('activeTasks');
      expect(metrics).toHaveProperty('totalAssignments');
    });

    it('should track agent statistics correctly', async () => {
      await coordinator.registerAgent(mockAgent);

      const metrics = await coordinator.getMetrics();
      expect(metrics.totalAgents).toBe(1);
      expect(metrics.agentsByStatus.idle).toBe(1);
      expect(metrics.agentsByCategory.core).toBe(1);
      expect(metrics.agentsByType.coder).toBe(1);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await coordinator.initialize();
      await coordinator.registerAgent(mockAgent);

      const result = await coordinator.shutdown();

      expect(result.success).toBe(true);
      expect(result.message).toContain('shutdown completed');
    });

    it('should cleanup all agents on shutdown', async () => {
      await coordinator.initialize();
      await coordinator.registerAgent(mockAgent);

      await coordinator.shutdown();

      const metrics = await coordinator.getMetrics();
      expect(metrics.totalAgents).toBe(0);
    });

    it('should stop health monitoring on shutdown', async () => {
      await coordinator.initialize();

      expect((coordinator as any).healthCheckTimer).toBeDefined();

      await coordinator.shutdown();

      expect((coordinator as any).healthCheckTimer).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should handle invalid task assignments', async () => {
      const invalidTask = { ...mockTask, id: '' };

      // Should not throw, but handle gracefully
      await coordinator.assignTask(invalidTask, [mockAgent]);
    });

    it('should handle agent registration errors', async () => {
      const duplicateAgent = { ...mockAgent };

      await coordinator.registerAgent(mockAgent);

      // Registering same agent again should not cause issues
      await coordinator.registerAgent(duplicateAgent);
    });
  });
});
