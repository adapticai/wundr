/**
 * Test suite for Swarm Intelligence
 */

import { SwarmIntelligence } from '../../src/core/SwarmIntelligence';
import { SwarmConfig, Agent, Task, MemoryContext } from '../../src/types';

describe('SwarmIntelligence', () => {
  let swarmIntelligence: SwarmIntelligence;
  let mockConfig: SwarmConfig;
  let mockAgents: Agent[];
  let mockTask: Task;
  let mockMemoryContext: MemoryContext;

  beforeEach(() => {
    mockConfig = {
      defaultTopology: 'mesh',
      maxSwarmSize: 10,
      consensusThreshold: 0.7,
      faultTolerance: 'high',
      adaptiveScaling: true
    };

    mockAgents = [
      {
        id: 'agent-1',
        type: 'coder',
        category: 'core',
        capabilities: ['coding', 'implementation'],
        status: 'active',
        topology: 'mesh',
        sessionId: 'test-session',
        createdAt: new Date(),
        metrics: { tasksCompleted: 5, successRate: 0.8, averageResponseTime: 1500 }
      },
      {
        id: 'agent-2',
        type: 'reviewer',
        category: 'core',
        capabilities: ['code-review', 'quality-assurance'],
        status: 'active',
        topology: 'mesh',
        sessionId: 'test-session',
        createdAt: new Date(),
        metrics: { tasksCompleted: 3, successRate: 0.9, averageResponseTime: 2000 }
      }
    ];

    mockTask = {
      id: 'test-task',
      title: 'Test Task',
      description: 'A complex test task requiring multiple agents',
      type: 'coding',
      priority: 'high',
      status: 'pending',
      assignedAgents: [],
      requiredCapabilities: ['coding', 'code-review'],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockMemoryContext = {
      sessionMemory: [],
      agentMemory: new Map(),
      taskMemory: new Map(),
      patterns: []
    };

    swarmIntelligence = new SwarmIntelligence(mockConfig);
  });

  afterEach(async () => {
    if (swarmIntelligence) {
      await swarmIntelligence.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await swarmIntelligence.initialize();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized successfully');
    });

    it('should initialize topology templates', async () => {
      await swarmIntelligence.initialize();
      
      const metrics = await swarmIntelligence.getMetrics();
      expect(metrics.availableTopologies).toBeGreaterThan(0);
    });
  });

  describe('Topology Selection', () => {
    beforeEach(async () => {
      await swarmIntelligence.initialize();
    });

    it('should select optimal topology for simple tasks', async () => {
      const agentTypes = ['coder', 'tester'];
      const simpleTask = 'Fix a small bug';
      
      const topology = await swarmIntelligence.selectOptimalTopology(agentTypes, simpleTask);
      
      expect(topology).toBeDefined();
      expect(topology.type).toBeDefined();
      expect(['mesh', 'hierarchical', 'adaptive', 'ring', 'star']).toContain(topology.type);
    });

    it('should select mesh topology for consensus-critical tasks', async () => {
      const agentTypes = ['byzantine-coordinator', 'consensus-builder'];
      const consensusTask = 'Reach consensus on critical system decision';
      
      const topology = await swarmIntelligence.selectOptimalTopology(agentTypes, consensusTask);
      
      expect(topology.type).toBe('mesh');
      expect(topology.faultTolerance).toBe('high');
    });

    it('should select hierarchical topology for large-scale tasks', async () => {
      const agentTypes = Array.from({ length: 15 }, (_, i) => 'coder');
      const largeTask = 'Refactor large monorepo codebase';
      
      const topology = await swarmIntelligence.selectOptimalTopology(agentTypes, largeTask);
      
      expect(topology.type).toBe('hierarchical');
      expect(topology.maxAgents).toBeGreaterThanOrEqual(15);
    });

    it('should customize topology based on requirements', async () => {
      const agentTypes = ['coder', 'reviewer', 'tester'];
      const task = 'Complex integration task';
      
      const topology = await swarmIntelligence.selectOptimalTopology(agentTypes, task);
      
      expect(topology.metadata).toBeDefined();
      expect(topology.metadata.customizedFor).toBeDefined();
      expect(topology.metadata.createdAt).toBeDefined();
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await swarmIntelligence.initialize();
    });

    it('should execute task successfully with swarm coordination', async () => {
      const tools: any[] = [];
      
      const result = await swarmIntelligence.executeTask(
        mockTask,
        mockAgents,
        tools,
        mockMemoryContext
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.swarmId).toBeDefined();
      expect(result.data.agentCount).toBe(mockAgents.length);
    });

    it('should handle task decomposition correctly', async () => {
      const complexTask = {
        ...mockTask,
        type: 'coding' as const,
        description: 'Complex multi-step implementation task'
      };
      
      const result = await swarmIntelligence.executeTask(
        complexTask,
        mockAgents,
        [],
        mockMemoryContext
      );
      
      expect(result.success).toBe(true);
      expect(result.data.subResults).toBeDefined();
    });

    it('should reach consensus on results', async () => {
      const result = await swarmIntelligence.executeTask(
        mockTask,
        mockAgents,
        [],
        mockMemoryContext
      );
      
      expect(result.success).toBe(true);
      expect(result.data.consensus).toBeDefined();
      expect(result.data.consensus.agreement).toBeGreaterThanOrEqual(0);
      expect(result.data.consensus.agreement).toBeLessThanOrEqual(1);
    });

    it('should generate quality scores', async () => {
      const result = await swarmIntelligence.executeTask(
        mockTask,
        mockAgents,
        [],
        mockMemoryContext
      );
      
      expect(result.success).toBe(true);
      expect(result.data.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.data.qualityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Pattern Learning', () => {
    beforeEach(async () => {
      await swarmIntelligence.initialize();
    });

    it('should update patterns based on successful executions', async () => {
      const successfulPattern = {
        topology: 'mesh',
        agentTypes: ['coder', 'reviewer'],
        taskType: 'coding',
        qualityScore: 0.9,
        executionTime: 2000,
        success: true
      };
      
      await swarmIntelligence.updatePatterns(successfulPattern);
      
      const metrics = await swarmIntelligence.getMetrics();
      expect(metrics.patterns.successful).toBeGreaterThan(0);
    });

    it('should learn from task completions', async () => {
      // Execute a task to generate learning data
      await swarmIntelligence.executeTask(
        mockTask,
        mockAgents,
        [],
        mockMemoryContext
      );
      
      const metrics = await swarmIntelligence.getMetrics();
      expect(metrics.collectiveMemorySize).toBeGreaterThan(0);
    });
  });

  describe('Optimization', () => {
    beforeEach(async () => {
      await swarmIntelligence.initialize();
    });

    it('should optimize topology based on bottlenecks', async () => {
      const mockBottleneck = {
        type: 'memory' as const,
        severity: 'high' as const,
        description: 'High memory usage detected',
        affectedComponents: ['agents'],
        suggestedActions: ['Enable compression'],
        detectedAt: new Date()
      };
      
      await swarmIntelligence.optimizeTopology(mockBottleneck);
      
      // Should emit optimization event
      const optimizationPromise = new Promise((resolve) => {
        swarmIntelligence.on('topology-optimized', resolve);
      });
      
      await swarmIntelligence.optimizeTopology(mockBottleneck);
      await optimizationPromise;
    });
  });

  describe('Collective Memory', () => {
    beforeEach(async () => {
      await swarmIntelligence.initialize();
    });

    it('should maintain collective memory', async () => {
      const pattern = {
        type: 'successful',
        topology: 'mesh',
        taskType: 'coding',
        confidence: 0.85
      };
      
      await swarmIntelligence.updatePatterns(pattern);
      
      const metrics = await swarmIntelligence.getMetrics();
      expect(metrics.collectiveMemorySize).toBeGreaterThan(0);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await swarmIntelligence.initialize();
    });

    it('should provide comprehensive metrics', async () => {
      const metrics = await swarmIntelligence.getMetrics();
      
      expect(metrics).toHaveProperty('activeSwarms');
      expect(metrics).toHaveProperty('availableTopologies');
      expect(metrics).toHaveProperty('collectiveMemorySize');
      expect(metrics).toHaveProperty('patterns');
      expect(metrics.patterns).toHaveProperty('successful');
      expect(metrics.patterns).toHaveProperty('failure');
      expect(metrics.patterns).toHaveProperty('performance');
    });
  });

  describe('Fault Tolerance', () => {
    beforeEach(async () => {
      await swarmIntelligence.initialize();
    });

    it('should handle agent failures gracefully', async () => {
      const faultyAgents = mockAgents.map(agent => ({
        ...agent,
        status: 'error' as const
      }));
      
      const result = await swarmIntelligence.executeTask(
        mockTask,
        faultyAgents,
        [],
        mockMemoryContext
      );
      
      // Should still attempt execution even with faulty agents
      expect(result).toBeDefined();
    });

    it('should maintain fault tolerance settings', async () => {
      const topology = await swarmIntelligence.selectOptimalTopology(
        ['byzantine-coordinator'],
        'Critical consensus task'
      );
      
      expect(topology.faultTolerance).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await swarmIntelligence.initialize();
      
      const result = await swarmIntelligence.shutdown();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('shutdown completed');
    });

    it('should cleanup active swarms on shutdown', async () => {
      await swarmIntelligence.initialize();
      
      // Start a task execution
      const taskPromise = swarmIntelligence.executeTask(
        mockTask,
        mockAgents,
        [],
        mockMemoryContext
      );
      
      // Shutdown while task is running
      const shutdownResult = await swarmIntelligence.shutdown();
      
      expect(shutdownResult.success).toBe(true);
      
      // Wait for task to complete/cancel
      await taskPromise.catch(() => {}); // Ignore errors from cancelled task
    });
  });
});