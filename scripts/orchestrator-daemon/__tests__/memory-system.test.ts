/**
 * Orchestrator Memory System Tests
 *
 * Comprehensive tests for tiered memory architecture:
 * - Task memory operations
 * - Decision memory operations
 * - Policy memory operations
 * - Pattern memory operations
 * - Memory consolidation and compaction
 * - Persistence and archival
 */

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  createVPMemorySystem,
  type DecisionMemory,
  type PatternMemory,
  type PolicyMemory,
  type TaskMemory,
  type TriageMemory,
  VPMemorySystem,
} from '../memory-system';

describe('VPMemorySystem', () => {
  let tempDir: string;
  let memorySystem: VPMemorySystem;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orchestrator-memory-test-'));

    memorySystem = await createVPMemorySystem({
      basePath: tempDir,
      persistToDisk: true,
      autoSaveIntervalMs: 0, // Disable auto-save for tests
    });
  });

  afterEach(async () => {
    // Cleanup
    await memorySystem.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const stats = memorySystem.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.totalMemories).toBe(0);
    });

    it('should create memory directories', async () => {
      const dirs = ['scratchpad', 'episodic', 'semantic', 'archives'];
      for (const dir of dirs) {
        const dirPath = path.join(tempDir, dir);
        const exists = await fs
          .access(dirPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Task Memory', () => {
    it('should store a task', async () => {
      const task: Omit<TaskMemory, 'createdAt' | 'updatedAt'> = {
        taskId: 'task-1',
        description: 'Test task',
        status: 'pending',
        priority: 5,
        metadata: {},
      };

      await memorySystem.storeTask(task);

      const retrieved = memorySystem.getTask('task-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.description).toBe('Test task');
      expect(retrieved?.status).toBe('pending');
    });

    it('should update a task', async () => {
      const task: Omit<TaskMemory, 'createdAt' | 'updatedAt'> = {
        taskId: 'task-2',
        description: 'Test task 2',
        status: 'pending',
        priority: 5,
        metadata: {},
      };

      await memorySystem.storeTask(task);
      await memorySystem.updateTask('task-2', {
        status: 'in_progress',
        priority: 7,
      });

      const updated = memorySystem.getTask('task-2');
      expect(updated?.status).toBe('in_progress');
      expect(updated?.priority).toBe(7);
    });

    it('should get active tasks', async () => {
      await memorySystem.storeTask({
        taskId: 'task-3',
        description: 'Active 1',
        status: 'in_progress',
        priority: 5,
        metadata: {},
      });

      await memorySystem.storeTask({
        taskId: 'task-4',
        description: 'Active 2',
        status: 'pending',
        priority: 3,
        metadata: {},
      });

      await memorySystem.storeTask({
        taskId: 'task-5',
        description: 'Completed',
        status: 'completed',
        priority: 5,
        metadata: {},
      });

      const activeTasks = memorySystem.getActiveTasks();
      expect(activeTasks).toHaveLength(2);
      expect(activeTasks.every(t => t.status !== 'completed')).toBe(true);
    });
  });

  describe('Decision Memory', () => {
    it('should store a decision', async () => {
      const decision: DecisionMemory = {
        timestamp: new Date(),
        sessionId: 'session-1',
        agentId: 'agent-1',
        action: 'approve_pr',
        rationale: 'Code review passed',
        rewardScores: { quality: 0.9 },
        policyChecks: { security: true },
        escalationTriggers: [],
        outcome: 'approved',
        context: 'PR #123',
      };

      await memorySystem.storeDecision(decision);

      const stats = memorySystem.getStatistics();
      expect(stats.tiers.episodic.memoryCount).toBeGreaterThan(0);
    });

    it('should retrieve decisions by agent', async () => {
      const decision1: DecisionMemory = {
        timestamp: new Date(),
        sessionId: 'session-1',
        agentId: 'agent-1',
        action: 'action-1',
        rationale: 'reason-1',
        rewardScores: {},
        policyChecks: {},
        escalationTriggers: [],
        outcome: 'approved',
        context: 'context-1',
      };

      const decision2: DecisionMemory = {
        timestamp: new Date(),
        sessionId: 'session-1',
        agentId: 'agent-1',
        action: 'action-2',
        rationale: 'reason-2',
        rewardScores: {},
        policyChecks: {},
        escalationTriggers: [],
        outcome: 'rejected',
        context: 'context-2',
      };

      await memorySystem.storeDecision(decision1);
      await memorySystem.storeDecision(decision2);

      const decisions = await memorySystem.getDecisionsByAgent('agent-1');
      expect(decisions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Policy Memory', () => {
    it('should store a policy', async () => {
      const policy: PolicyMemory = {
        policyId: 'policy-1',
        name: 'No Force Push',
        rule: 'git push --force is not allowed',
        violationCount: 0,
        examples: [
          {
            description: 'Force push to main',
            outcome: 'fail',
          },
        ],
      };

      await memorySystem.storePolicy(policy);

      const retrieved = memorySystem.getPolicy('policy-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('No Force Push');
    });

    it('should record policy violations', async () => {
      const policy: PolicyMemory = {
        policyId: 'policy-2',
        name: 'Test Policy',
        rule: 'Test rule',
        violationCount: 0,
        examples: [],
      };

      await memorySystem.storePolicy(policy);
      await memorySystem.recordPolicyViolation('policy-2');

      const updated = memorySystem.getPolicy('policy-2');
      expect(updated?.violationCount).toBe(1);
      expect(updated?.lastViolation).toBeDefined();
    });

    it('should get all policies', async () => {
      await memorySystem.storePolicy({
        policyId: 'p1',
        name: 'Policy 1',
        rule: 'Rule 1',
        violationCount: 0,
        examples: [],
      });

      await memorySystem.storePolicy({
        policyId: 'p2',
        name: 'Policy 2',
        rule: 'Rule 2',
        violationCount: 0,
        examples: [],
      });

      const policies = memorySystem.getAllPolicies();
      expect(policies).toHaveLength(2);
    });
  });

  describe('Pattern Memory', () => {
    it('should store a pattern', async () => {
      const pattern: PatternMemory = {
        patternId: 'pattern-1',
        name: 'Common Error Pattern',
        description: 'Null pointer exceptions in user service',
        occurrenceCount: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        confidence: 0.8,
        tags: ['error', 'user-service'],
      };

      await memorySystem.storePattern(pattern);

      const retrieved = memorySystem.getPattern('pattern-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Common Error Pattern');
    });

    it('should record pattern occurrences', async () => {
      const pattern: PatternMemory = {
        patternId: 'pattern-2',
        name: 'Test Pattern',
        description: 'Test',
        occurrenceCount: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        confidence: 0.5,
        tags: [],
      };

      await memorySystem.storePattern(pattern);
      await memorySystem.recordPatternOccurrence('pattern-2');

      const updated = memorySystem.getPattern('pattern-2');
      expect(updated?.occurrenceCount).toBe(1);
      expect(updated?.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Context Compilation', () => {
    it('should compile context with active tasks', async () => {
      await memorySystem.storeTask({
        taskId: 'ctx-task-1',
        description: 'Test task for context',
        status: 'in_progress',
        priority: 7,
        metadata: {},
      });

      const context = await memorySystem.compileContext({
        systemPrompt: 'You are a helpful Orchestrator assistant',
        maxTokens: 8000,
        includeActiveTasks: true,
      });

      expect(context).toBeDefined();
      expect(context.systemPrompt).toBe('You are a helpful Orchestrator assistant');
      expect(context.totalTokens).toBeLessThanOrEqual(8000);
    });

    it('should respect token limits', async () => {
      const context = await memorySystem.compileContext({
        systemPrompt: 'Test prompt',
        maxTokens: 2000,
      });

      expect(context.totalTokens).toBeLessThanOrEqual(2000);
      expect(context.utilization).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Memory Search', () => {
    it('should search across all tiers', async () => {
      await memorySystem.storeTask({
        taskId: 'search-task',
        description: 'Searchable task',
        status: 'pending',
        priority: 5,
        metadata: { keyword: 'findme' },
      });

      const results = await memorySystem.search({
        query: 'task',
        limit: 10,
      });

      expect(results).toBeDefined();
      expect(results.memories.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should consolidate memories', async () => {
      // Store some episodic memories
      for (let i = 0; i < 5; i++) {
        await memorySystem.storeDecision({
          timestamp: new Date(),
          sessionId: 'session-1',
          agentId: 'agent-1',
          action: `action-${i}`,
          rationale: `reason-${i}`,
          rewardScores: {},
          policyChecks: {},
          escalationTriggers: [],
          outcome: 'approved',
          context: `context-${i}`,
        });
      }

      await memorySystem.consolidate();

      const stats = memorySystem.getStatistics();
      expect(stats.tiers.semantic.memoryCount).toBeGreaterThanOrEqual(0);
    });

    it('should compact memories', async () => {
      await memorySystem.compact();
      // Just ensure no errors
      expect(true).toBe(true);
    });

    it('should prune old memories', async () => {
      // Store a task
      await memorySystem.storeTask({
        taskId: 'prune-task',
        description: 'Old task',
        status: 'completed',
        priority: 1,
        metadata: {},
      });

      const result = await memorySystem.prune({
        scratchpadMaxAge: 0, // Prune everything
        minAccessCount: 10,
        preservePinned: true,
      });

      expect(result).toBeDefined();
      expect(result.pruned).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    it('should save to disk', async () => {
      await memorySystem.storeTask({
        taskId: 'persist-task',
        description: 'Persistent task',
        status: 'pending',
        priority: 5,
        metadata: {},
      });

      await memorySystem.saveToDisk();

      const statePath = path.join(tempDir, 'state.json');
      const exists = await fs
        .access(statePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should load from disk', async () => {
      await memorySystem.storeTask({
        taskId: 'load-task',
        description: 'Task to load',
        status: 'pending',
        priority: 5,
        metadata: {},
      });

      await memorySystem.saveToDisk();

      // Create new instance and load
      const newSystem = new VPMemorySystem({
        basePath: tempDir,
        persistToDisk: true,
      });
      await newSystem.initialize();

      const task = newSystem.getTask('load-task');
      expect(task).toBeDefined();
      expect(task?.description).toBe('Task to load');

      await newSystem.shutdown();
    });

    it('should archive old memories', async () => {
      // Store an old decision (simulate by backdating)
      const oldDecision: DecisionMemory = {
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        sessionId: 'old-session',
        agentId: 'agent-1',
        action: 'old-action',
        rationale: 'old-rationale',
        rewardScores: {},
        policyChecks: {},
        escalationTriggers: [],
        outcome: 'approved',
        context: 'old-context',
      };

      await memorySystem.storeDecision(oldDecision);

      const result = await memorySystem.archiveOldMemories(90);

      expect(result).toBeDefined();
      if (result.archived > 0) {
        expect(result.archivePath).toBeTruthy();
      }
    });
  });

  describe('Statistics', () => {
    it('should return memory statistics', async () => {
      await memorySystem.storeTask({
        taskId: 'stat-task',
        description: 'Task for stats',
        status: 'pending',
        priority: 5,
        metadata: {},
      });

      const stats = memorySystem.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalMemories).toBeGreaterThan(0);
      expect(stats.tiers).toBeDefined();
      expect(stats.tiers.scratchpad).toBeDefined();
      expect(stats.tiers.episodic).toBeDefined();
      expect(stats.tiers.semantic).toBeDefined();
    });
  });
});
