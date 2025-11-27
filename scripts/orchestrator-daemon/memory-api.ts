/**
 * VP-Daemon Memory API
 *
 * High-level API for VP-Daemon memory operations with intelligent caching,
 * query optimization, and integration helpers.
 */

import type {
  DecisionMemory,
  MemorySearchQuery,
  MemorySearchResult,
  PatternMemory,
  PolicyMemory,
  SessionSnapshot,
  TaskMemory,
  TriageMemory,
  VPMemoryConfig,
  VPMemorySystem,
} from './memory-system.js';
import { createVPMemorySystem } from './memory-system.js';

/**
 * Memory query builder for fluent API
 */
export class MemoryQuery {
  private query: Partial<MemorySearchQuery> = {};

  /**
   * Set the search query text
   */
  withQuery(query: string): this {
    this.query.query = query;
    return this;
  }

  /**
   * Filter by memory types
   */
  withTypes(...types: MemorySearchQuery['types']): this {
    this.query.types = types;
    return this;
  }

  /**
   * Filter by session ID
   */
  inSession(sessionId: string): this {
    this.query.sessionId = sessionId;
    return this;
  }

  /**
   * Filter by agent ID
   */
  byAgent(agentId: string): this {
    this.query.agentId = agentId;
    return this;
  }

  /**
   * Filter by date range
   */
  betweenDates(start: Date, end: Date): this {
    this.query.startDate = start;
    this.query.endDate = end;
    return this;
  }

  /**
   * Limit number of results
   */
  limit(count: number): this {
    this.query.limit = count;
    return this;
  }

  /**
   * Build the query object
   */
  build(): MemorySearchQuery {
    if (!this.query.query) {
      throw new Error('Query text is required');
    }
    return this.query as MemorySearchQuery;
  }
}

/**
 * Memory API - High-level interface for VP-Daemon memory operations
 */
export class MemoryAPI {
  private memorySystem: VPMemorySystem | null = null;
  private initialized: boolean = false;

  constructor(private config?: Partial<VPMemoryConfig>) {}

  /**
   * Initialize the memory API
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.memorySystem = await createVPMemorySystem(this.config);
    this.initialized = true;
  }

  /**
   * Shutdown the memory API
   */
  async shutdown(): Promise<void> {
    if (!this.initialized || !this.memorySystem) {
      return;
    }

    await this.memorySystem.shutdown();
    this.memorySystem = null;
    this.initialized = false;
  }

  // ============================================================================
  // Task Operations
  // ============================================================================

  /**
   * Create a new task
   */
  async createTask(params: {
    taskId: string;
    description: string;
    priority?: number;
    assignedSlot?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TaskMemory> {
    this.assertInitialized();

    const task: Omit<TaskMemory, 'createdAt' | 'updatedAt'> = {
      taskId: params.taskId,
      description: params.description,
      status: 'pending',
      priority: params.priority ?? 5,
      assignedSlot: params.assignedSlot,
      metadata: params.metadata ?? {},
    };

    await this.memorySystem!.storeTask(task);
    return this.memorySystem!.getTask(params.taskId)!;
  }

  /**
   * Start a task (mark as in progress)
   */
  async startTask(taskId: string, slotId: string): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.updateTask(taskId, {
      status: 'in_progress',
      assignedSlot: slotId,
    });
  }

  /**
   * Complete a task
   */
  async completeTask(
    taskId: string,
    result?: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.updateTask(taskId, {
      status: 'completed',
      completedAt: new Date(),
      result,
      metadata,
    });
  }

  /**
   * Fail a task
   */
  async failTask(taskId: string, error: unknown): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.updateTask(taskId, {
      status: 'failed',
      completedAt: new Date(),
      result: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): TaskMemory[] {
    this.assertInitialized();
    return this.memorySystem!.getActiveTasks();
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TaskMemory | undefined {
    this.assertInitialized();
    return this.memorySystem!.getTask(taskId);
  }

  // ============================================================================
  // Decision Operations
  // ============================================================================

  /**
   * Record a decision
   */
  async recordDecision(params: {
    sessionId: string;
    agentId: string;
    action: string;
    rationale: string;
    outcome: 'approved' | 'rejected' | 'escalated';
    context: string;
    rewardScores?: Record<string, number>;
    policyChecks?: Record<string, boolean>;
    escalationTriggers?: string[];
  }): Promise<void> {
    this.assertInitialized();

    const decision: DecisionMemory = {
      timestamp: new Date(),
      sessionId: params.sessionId,
      agentId: params.agentId,
      action: params.action,
      rationale: params.rationale,
      rewardScores: params.rewardScores ?? {},
      policyChecks: params.policyChecks ?? {},
      escalationTriggers: params.escalationTriggers ?? [],
      outcome: params.outcome,
      context: params.context,
    };

    await this.memorySystem!.storeDecision(decision);
  }

  /**
   * Get recent decisions by agent
   */
  async getRecentDecisions(agentId: string, limit: number = 10) {
    this.assertInitialized();
    return this.memorySystem!.getDecisionsByAgent(agentId, limit);
  }

  // ============================================================================
  // Policy Operations
  // ============================================================================

  /**
   * Add or update a policy
   */
  async addPolicy(params: {
    policyId: string;
    name: string;
    rule: string;
    examples?: Array<{ description: string; outcome: 'pass' | 'fail' }>;
  }): Promise<void> {
    this.assertInitialized();

    const policy: PolicyMemory = {
      policyId: params.policyId,
      name: params.name,
      rule: params.rule,
      violationCount: 0,
      examples: params.examples ?? [],
    };

    await this.memorySystem!.storePolicy(policy);
  }

  /**
   * Record a policy violation
   */
  async recordViolation(policyId: string): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.recordPolicyViolation(policyId);
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): PolicyMemory | undefined {
    this.assertInitialized();
    return this.memorySystem!.getPolicy(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): PolicyMemory[] {
    this.assertInitialized();
    return this.memorySystem!.getAllPolicies();
  }

  /**
   * Get frequently violated policies
   */
  getViolatedPolicies(minViolations: number = 1): PolicyMemory[] {
    this.assertInitialized();
    return this.memorySystem!
      .getAllPolicies()
      .filter(p => p.violationCount >= minViolations)
      .sort((a, b) => b.violationCount - a.violationCount);
  }

  // ============================================================================
  // Pattern Operations
  // ============================================================================

  /**
   * Learn a new pattern
   */
  async learnPattern(params: {
    patternId: string;
    name: string;
    description: string;
    confidence?: number;
    tags?: string[];
  }): Promise<void> {
    this.assertInitialized();

    const pattern: PatternMemory = {
      patternId: params.patternId,
      name: params.name,
      description: params.description,
      occurrenceCount: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
      confidence: params.confidence ?? 0.5,
      tags: params.tags ?? [],
    };

    await this.memorySystem!.storePattern(pattern);
  }

  /**
   * Reinforce a pattern (increase confidence)
   */
  async reinforcePattern(patternId: string): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.recordPatternOccurrence(patternId);
  }

  /**
   * Get pattern by ID
   */
  getPattern(patternId: string): PatternMemory | undefined {
    this.assertInitialized();
    return this.memorySystem!.getPattern(patternId);
  }

  /**
   * Get high-confidence patterns
   */
  getHighConfidencePatterns(minConfidence: number = 0.8): PatternMemory[] {
    this.assertInitialized();
    return this.memorySystem!
      .getAllPatterns()
      .filter(p => p.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  /**
   * Record a session snapshot
   */
  async recordSession(params: {
    sessionId: string;
    slot: any;
    taskCount: number;
    decisionsCount: number;
    escalationsCount: number;
    summary: string;
    endTime?: Date;
  }): Promise<void> {
    this.assertInitialized();

    const snapshot: SessionSnapshot = {
      sessionId: params.sessionId,
      slot: params.slot,
      startTime: new Date(),
      endTime: params.endTime,
      taskCount: params.taskCount,
      decisionsCount: params.decisionsCount,
      escalationsCount: params.escalationsCount,
      summary: params.summary,
    };

    await this.memorySystem!.storeSessionSnapshot(snapshot);
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Create a fluent query builder
   */
  query(): MemoryQuery {
    return new MemoryQuery();
  }

  /**
   * Search memory
   */
  async search(query: MemorySearchQuery): Promise<MemorySearchResult> {
    this.assertInitialized();
    return this.memorySystem!.search(query);
  }

  /**
   * Search for tasks by description
   */
  async searchTasks(keyword: string, limit: number = 10): Promise<TaskMemory[]> {
    this.assertInitialized();

    const allTasks = this.memorySystem!.getActiveTasks();
    return allTasks
      .filter(
        t =>
          t.description.toLowerCase().includes(keyword.toLowerCase()) ||
          t.taskId.toLowerCase().includes(keyword.toLowerCase()),
      )
      .slice(0, limit);
  }

  // ============================================================================
  // Context Operations
  // ============================================================================

  /**
   * Compile Orchestrator context for decision making
   */
  async compileVPContext(params: {
    systemPrompt: string;
    maxTokens: number;
    currentTaskId?: string;
  }) {
    this.assertInitialized();

    return this.memorySystem!.compileContext({
      systemPrompt: params.systemPrompt,
      maxTokens: params.maxTokens,
      includeActiveTasks: true,
      includePolicies: true,
      includePatterns: true,
    });
  }

  // ============================================================================
  // Maintenance Operations
  // ============================================================================

  /**
   * Run memory consolidation
   */
  async consolidate(): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.consolidate();
  }

  /**
   * Run memory compaction
   */
  async compact(): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.compact();
  }

  /**
   * Prune old memories
   */
  async pruneOldMemories(params?: {
    scratchpadMaxAgeDays?: number;
    episodicMaxAgeDays?: number;
  }): Promise<{ pruned: number; preserved: number }> {
    this.assertInitialized();

    return this.memorySystem!.prune({
      scratchpadMaxAge: (params?.scratchpadMaxAgeDays ?? 1) * 24 * 60 * 60 * 1000,
      episodicMaxAge: (params?.episodicMaxAgeDays ?? 30) * 24 * 60 * 60 * 1000,
    });
  }

  /**
   * Archive old memories
   */
  async archiveOldMemories(olderThanDays: number = 90) {
    this.assertInitialized();
    return this.memorySystem!.archiveOldMemories(olderThanDays);
  }

  /**
   * Get memory statistics
   */
  getStats() {
    this.assertInitialized();
    return this.memorySystem!.getStatistics();
  }

  /**
   * Save memory to disk
   */
  async save(): Promise<void> {
    this.assertInitialized();
    await this.memorySystem!.saveToDisk();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate a summary of active work
   */
  async getActiveSummary(): Promise<{
    activeTasks: number;
    policies: number;
    patterns: number;
    recentDecisions: number;
    memoryUtilization: number;
  }> {
    this.assertInitialized();

    const tasks = this.getActiveTasks();
    const policies = this.getAllPolicies();
    const patterns = this.getHighConfidencePatterns();
    const stats = this.getStats();

    return {
      activeTasks: tasks.length,
      policies: policies.length,
      patterns: patterns.length,
      recentDecisions: stats.tiers.episodic.memoryCount,
      memoryUtilization:
        stats.totalTokens /
        (stats.tiers.scratchpad.maxTokens +
          stats.tiers.episodic.maxTokens +
          stats.tiers.semantic.maxTokens),
    };
  }

  /**
   * Check if memory needs maintenance
   */
  needsMaintenance(): {
    needsConsolidation: boolean;
    needsCompaction: boolean;
    needsPruning: boolean;
    reason: string;
  } {
    this.assertInitialized();

    const stats = this.getStats();
    const scratchpadUtil = stats.tiers.scratchpad.utilization;
    const episodicUtil = stats.tiers.episodic.utilization;

    if (scratchpadUtil > 0.9) {
      return {
        needsConsolidation: false,
        needsCompaction: true,
        needsPruning: true,
        reason: 'Scratchpad near capacity',
      };
    }

    if (episodicUtil > 0.8) {
      return {
        needsConsolidation: true,
        needsCompaction: true,
        needsPruning: false,
        reason: 'Episodic memory high, consolidation recommended',
      };
    }

    return {
      needsConsolidation: false,
      needsCompaction: false,
      needsPruning: false,
      reason: 'Memory healthy',
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private assertInitialized(): void {
    if (!this.initialized || !this.memorySystem) {
      throw new Error('MemoryAPI not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create and initialize a Memory API instance
 */
export async function createMemoryAPI(
  config?: Partial<VPMemoryConfig>,
): Promise<MemoryAPI> {
  const api = new MemoryAPI(config);
  await api.initialize();
  return api;
}
