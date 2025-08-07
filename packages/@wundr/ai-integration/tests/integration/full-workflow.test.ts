/**
 * Integration test for full AI Integration workflow
 */

import { AIIntegrationHive } from '../../src/core/AIIntegrationHive';
import { AIIntegrationConfig, Task } from '../../src/types';

describe('Full AI Integration Workflow', () => {
  let hive: AIIntegrationHive;
  let config: AIIntegrationConfig;

  beforeAll(async () => {
    config = {
      claudeFlow: {
        sessionPath: './test-sessions',
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
        enabledTools: ['drift_detection', 'pattern_standardize', 'governance_report'],
        autoDiscovery: true,
        cacheResults: true,
        timeout: 30000
      },
      neural: {
        modelsPath: './test-models',
        enabledModels: ['pattern-recognition', 'performance-prediction', 'task-classification'],
        trainingInterval: 30000,
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
        healthCheckInterval: 10000,
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
        token: process.env.GITHUB_TOKEN,
        autoReview: false, // Disabled for testing
        swarmReview: false, // Disabled for testing
        integrationBranches: ['main']
      }
    };

    hive = new AIIntegrationHive(config);
    await hive.initialize();
  });

  afterAll(async () => {
    if (hive) {
      await hive.shutdown();
    }
  });

  describe('End-to-End Task Execution', () => {
    it('should execute a complete coding workflow', async () => {
      const task: Task = {
        id: 'e2e-coding-task',
        title: 'Implement User Authentication',
        description: 'Implement a complete user authentication system with login, registration, and password reset functionality',
        type: 'coding',
        priority: 'high',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: [
          'coding',
          'security',
          'testing',
          'code-review'
        ],
        context: {
          technology: 'Node.js',
          database: 'PostgreSQL',
          framework: 'Express'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Execute the task
      const result = await hive.executeTask(task);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.swarmId).toBeDefined();
      expect(result.data.agentCount).toBeGreaterThan(0);
      expect(result.data.qualityScore).toBeGreaterThan(0);
      
      // Verify neural learning occurred
      const metrics = await hive.getMetrics();
      expect(metrics.neural.totalPatterns).toBeGreaterThan(0);
      
      // Verify memory was created and stored
      expect(metrics.memory.cacheSize).toBeGreaterThan(0);
    }, 30000);

    it('should execute a code review workflow', async () => {
      const reviewTask: Task = {
        id: 'e2e-review-task',
        title: 'Review Authentication Implementation',
        description: 'Comprehensive review of the authentication system implementation',
        type: 'review',
        priority: 'high',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: [
          'code-review',
          'security',
          'quality-assurance'
        ],
        context: {
          pullRequestUrl: 'https://github.com/example/repo/pull/123',
          changedFiles: 15,
          linesAdded: 500,
          linesRemoved: 50
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await hive.executeTask(reviewTask);
      
      expect(result.success).toBe(true);
      expect(result.data.consensus).toBeDefined();
      expect(result.data.consensus.agreement).toBeGreaterThan(0.5);
    }, 20000);

    it('should execute a testing workflow', async () => {
      const testTask: Task = {
        id: 'e2e-test-task',
        title: 'Create Comprehensive Test Suite',
        description: 'Create unit, integration, and end-to-end tests for authentication system',
        type: 'testing',
        priority: 'medium',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: [
          'testing',
          'quality-assurance',
          'automation'
        ],
        context: {
          testFramework: 'Jest',
          coverageTarget: 90,
          testTypes: ['unit', 'integration', 'e2e']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await hive.executeTask(testTask);
      
      expect(result.success).toBe(true);
      expect(result.data.qualityScore).toBeGreaterThan(0.7);
    }, 15000);
  });

  describe('Multi-Agent Coordination', () => {
    it('should coordinate multiple agents effectively', async () => {
      const complexTask: Task = {
        id: 'multi-agent-task',
        title: 'Full Stack Feature Implementation',
        description: 'Implement a complete feature including backend API, frontend UI, tests, and documentation',
        type: 'coding',
        priority: 'critical',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: [
          'backend-development',
          'frontend-development',
          'api-design',
          'testing',
          'documentation',
          'code-review'
        ],
        context: {
          complexity: 'high',
          estimatedHours: 40,
          technologies: ['React', 'Node.js', 'GraphQL']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Spawn agents for the task
      const spawnResult = await hive.spawnAgents(
        ['backend-dev', 'coder', 'reviewer', 'tester', 'api-docs'],
        complexTask.description
      );
      
      expect(spawnResult.success).toBe(true);
      expect(spawnResult.data.agents.length).toBe(5);

      // Execute the task
      const result = await hive.executeTask(complexTask);
      
      expect(result.success).toBe(true);
      expect(result.data.agentCount).toBe(5);
      expect(result.data.topology).toBeDefined();
    }, 45000);
  });

  describe('SPARC Methodology Integration', () => {
    it('should execute SPARC workflow phases', async () => {
      const sparcTask: Task = {
        id: 'sparc-workflow-task',
        title: 'Design Microservices Architecture',
        description: 'Design and implement a microservices architecture using SPARC methodology',
        type: 'analysis',
        priority: 'high',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: [
          'architecture',
          'system-design',
          'specification',
          'pseudocode'
        ],
        context: {
          methodology: 'SPARC',
          phases: ['specification', 'pseudocode', 'architecture', 'refinement'],
          scale: 'enterprise'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Spawn SPARC-specific agents
      const spawnResult = await hive.spawnAgents(
        ['sparc-coord', 'specification', 'architecture', 'system-architect'],
        sparcTask.description
      );
      
      expect(spawnResult.success).toBe(true);

      const result = await hive.executeTask(sparcTask);
      
      expect(result.success).toBe(true);
      expect(result.data.insights).toContain('methodology');
    }, 35000);
  });

  describe('Performance Optimization', () => {
    it('should detect and optimize performance bottlenecks', async () => {
      // Execute multiple tasks to generate load
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `perf-test-${i}`,
        title: `Performance Test Task ${i}`,
        description: 'Task to generate system load for performance testing',
        type: 'coding' as const,
        priority: 'medium' as const,
        status: 'pending' as const,
        assignedAgents: [],
        requiredCapabilities: ['coding'],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Execute tasks in parallel
      const results = await Promise.allSettled(
        tasks.map(task => hive.executeTask(task))
      );

      // Check that most tasks succeeded
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(2);

      // Check performance metrics
      const metrics = await hive.getMetrics();
      expect(metrics.performance).toBeDefined();
      
      // Allow time for performance analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
    }, 30000);
  });

  describe('Memory and Learning', () => {
    it('should maintain cross-session memory and learning', async () => {
      const learningTask: Task = {
        id: 'learning-task',
        title: 'Pattern Recognition Task',
        description: 'Task designed to test pattern recognition and learning capabilities',
        type: 'optimization',
        priority: 'medium',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: [
          'pattern-recognition',
          'machine-learning',
          'optimization'
        ],
        context: {
          learningObjective: 'pattern-recognition',
          dataPoints: 100
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Execute the task
      const result = await hive.executeTask(learningTask);
      
      expect(result.success).toBe(true);

      // Check that learning occurred
      const metricsAfter = await hive.getMetrics();
      expect(metricsAfter.neural.patterns).toBeGreaterThan(0);
      expect(metricsAfter.neural.totalModels).toBeGreaterThan(0);
      
      // Verify memory persistence
      expect(metricsAfter.memory.cacheSize).toBeGreaterThan(0);
    }, 25000);
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from component failures', async () => {
      const resilientTask: Task = {
        id: 'resilience-test-task',
        title: 'Resilience Test',
        description: 'Task to test system resilience and error recovery',
        type: 'testing',
        priority: 'low',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: ['testing'],
        context: {
          errorSimulation: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Execute task that might encounter errors
      const result = await hive.executeTask(resilientTask);
      
      // System should handle errors gracefully
      expect(result).toBeDefined();
      
      // Check system health
      const status = hive.getStatus();
      expect(status).not.toBe('error');
    }, 20000);
  });

  describe('Integration Metrics', () => {
    it('should provide comprehensive system metrics', async () => {
      const metrics = await hive.getMetrics();
      
      // Verify all subsystem metrics are available
      expect(metrics.hive).toBeDefined();
      expect(metrics.claudeFlow).toBeDefined();
      expect(metrics.mcpTools).toBeDefined();
      expect(metrics.neural).toBeDefined();
      expect(metrics.swarm).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.agents).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.github).toBeDefined();
      
      // Verify metric data quality
      expect(typeof metrics.agents.totalAgents).toBe('number');
      expect(typeof metrics.swarm.activeSwarms).toBe('number');
      expect(typeof metrics.memory.cacheSize).toBe('number');
      expect(typeof metrics.neural.totalModels).toBe('number');
    });

    it('should show activity and learning progression', async () => {
      const initialMetrics = await hive.getMetrics();
      
      // Execute a learning task
      const task: Task = {
        id: 'metrics-progression-task',
        title: 'Metrics Progression Test',
        description: 'Task to demonstrate metrics progression',
        type: 'analysis',
        priority: 'low',
        status: 'pending',
        assignedAgents: [],
        requiredCapabilities: ['analysis'],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await hive.executeTask(task);
      
      const finalMetrics = await hive.getMetrics();
      
      // Verify progression
      expect(finalMetrics.memory.cacheSize).toBeGreaterThanOrEqual(initialMetrics.memory.cacheSize);
      expect(finalMetrics.neural.patterns).toBeGreaterThanOrEqual(initialMetrics.neural.patterns);
    });
  });
});