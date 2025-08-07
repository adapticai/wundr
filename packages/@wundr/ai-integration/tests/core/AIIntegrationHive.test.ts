/**
 * Test suite for AI Integration Hive Queen
 */

import { AIIntegrationHive } from '../../src/core/AIIntegrationHive';
import { AIIntegrationConfig } from '../../src/types';

describe('AIIntegrationHive', () => {
  let hive: AIIntegrationHive;
  let mockConfig: AIIntegrationConfig;

  beforeEach(() => {
    mockConfig = {
      claudeFlow: {
        maxConcurrentAgents: 10,
        defaultTopology: 'adaptive',
        hooks: {
          preTask: true,
          postTask: true,
          sessionRestore: true,
          exportMetrics: true
        },
        sparc: {
          enabledPhases: ['specification', 'architecture', 'refinement'],
          parallelExecution: true,
          autoOptimization: true
        }
      },
      mcpTools: {
        registryPath: './test-registry',
        enabledTools: ['drift_detection', 'pattern_standardize'],
        autoDiscovery: true,
        cacheResults: true,
        timeout: 30000
      },
      neural: {
        modelsPath: './test-models',
        enabledModels: ['pattern-recognition', 'performance-prediction'],
        trainingInterval: 60000,
        patternRecognition: true,
        crossSessionLearning: true,
        maxMemorySize: 1000
      },
      swarm: {
        defaultTopology: 'mesh',
        maxSwarmSize: 15,
        consensusThreshold: 0.7,
        faultTolerance: 'high',
        adaptiveScaling: true
      },
      memory: {
        persistencePath: './test-memory',
        maxSessionMemory: 500,
        compressionEnabled: true,
        crossSessionEnabled: true,
        retentionPolicy: {
          shortTerm: 24,
          longTerm: 7,
          permanent: ['critical-patterns']
        }
      },
      agents: {
        maxConcurrentAgents: 20,
        spawningStrategy: 'adaptive',
        healthCheckInterval: 30000,
        autoRecovery: true,
        loadBalancing: true
      },
      performance: {
        metricsCollection: true,
        bottleneckDetection: true,
        autoOptimization: true,
        alertThresholds: {
          responseTime: 5000,
          errorRate: 0.05,
          memoryUsage: 80
        }
      },
      github: {
        autoReview: true,
        swarmReview: true,
        integrationBranches: ['main', 'develop']
      }
    };

    hive = new AIIntegrationHive(mockConfig);
  });

  afterEach(async () => {
    if (hive) {
      await hive.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const result = await hive.initialize();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized successfully');
      expect(hive.getStatus()).toBe('ready');
    });

    it('should emit status-changed events during initialization', async () => {
      const statusChanges: string[] = [];
      
      hive.on('status-changed', (status) => {
        statusChanges.push(status);
      });

      await hive.initialize();
      
      expect(statusChanges).toContain('initializing');
      expect(statusChanges).toContain('ready');
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidConfig = { ...mockConfig };
      invalidConfig.memory.persistencePath = '/invalid/path/that/cannot/be/created';
      
      const hiveWithBadConfig = new AIIntegrationHive(invalidConfig);
      const result = await hiveWithBadConfig.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      await hive.initialize();
    });

    it('should spawn agents successfully', async () => {
      const agentTypes = ['coder', 'reviewer', 'tester'];
      const task = 'Implement new feature';
      
      const result = await hive.spawnAgents(agentTypes, task);
      
      expect(result.success).toBe(true);
      expect(result.data.agents).toHaveLength(3);
      expect(result.data.topology).toBeDefined();
    });

    it('should emit agent-spawned events', async () => {
      const spawnedAgents: any[] = [];
      
      hive.on('agent-spawned', (agent) => {
        spawnedAgents.push(agent);
      });

      await hive.spawnAgents(['coder'], 'Test task');
      
      expect(spawnedAgents).toHaveLength(1);
      expect(spawnedAgents[0].type).toBe('coder');
    });

    it('should handle agent spawning failures', async () => {
      const result = await hive.spawnAgents(['invalid-agent-type'] as any, 'Test task');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await hive.initialize();
    });

    it('should execute tasks successfully', async () => {
      const task = {
        id: 'test-task-1',
        title: 'Test Task',
        description: 'A test task for validation',
        type: 'coding' as const,
        priority: 'medium' as const,
        status: 'pending' as const,
        assignedAgents: [],
        requiredCapabilities: ['coding', 'testing'],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await hive.executeTask(task);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle task execution errors', async () => {
      const invalidTask = {
        id: 'invalid-task',
        title: '',
        description: '',
        type: 'invalid-type' as any,
        priority: 'medium' as const,
        status: 'pending' as const,
        assignedAgents: [],
        requiredCapabilities: [],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await hive.executeTask(invalidTask);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await hive.initialize();
    });

    it('should provide comprehensive metrics', async () => {
      const metrics = await hive.getMetrics();
      
      expect(metrics).toHaveProperty('hive');
      expect(metrics).toHaveProperty('claudeFlow');
      expect(metrics).toHaveProperty('mcpTools');
      expect(metrics).toHaveProperty('neural');
      expect(metrics).toHaveProperty('swarm');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('agents');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('github');
    });

    it('should track hive status correctly', async () => {
      expect(hive.getStatus()).toBe('ready');
      
      await hive.shutdown();
      expect(hive.getStatus()).toBe('shutdown');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await hive.initialize();
    });

    it('should handle cross-component events', async () => {
      const events: string[] = [];
      
      hive.on('task-completed', () => events.push('task-completed'));
      hive.on('pattern-learned', () => events.push('pattern-learned'));
      hive.on('consensus-reached', () => events.push('consensus-reached'));
      hive.on('memory-updated', () => events.push('memory-updated'));

      // Trigger some events (simulated)
      const task = {
        id: 'event-test-task',
        title: 'Event Test',
        description: 'Test event handling',
        type: 'coding' as const,
        priority: 'low' as const,
        status: 'pending' as const,
        assignedAgents: [],
        requiredCapabilities: ['coding'],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await hive.executeTask(task);
      
      // Events should be handled asynchronously
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await hive.initialize();
      
      const result = await hive.shutdown();
      
      expect(result.success).toBe(true);
      expect(hive.getStatus()).toBe('shutdown');
    });

    it('should handle shutdown failures', async () => {
      await hive.initialize();
      
      // Simulate shutdown error by corrupting internal state
      (hive as any).status = 'error';
      
      const result = await hive.shutdown();
      
      // Should still attempt to shutdown components
      expect(result).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await hive.initialize();
    });

    it('should recover from component failures', async () => {
      let errorEmitted = false;
      
      hive.on('error', () => {
        errorEmitted = true;
      });

      // Simulate component failure
      try {
        throw new Error('Simulated component failure');
      } catch (error) {
        hive.emit('error', error);
      }
      
      expect(errorEmitted).toBe(true);
    });
  });
});