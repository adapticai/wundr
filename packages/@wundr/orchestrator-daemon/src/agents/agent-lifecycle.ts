/**
 * @wundr/orchestrator-daemon - Agent Lifecycle Manager
 *
 * Manages the full lifecycle of agent instances: spawn, monitor, cleanup.
 * Provides persistence across process restarts, output collection and
 * synthesis, agent-to-agent communication via mailbox, and resource
 * limit enforcement.
 *
 * Design reference: OpenClaw's subagent-registry.ts persistence model
 * extended with Wundr's tier hierarchy and team coordination.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type { AgentRegistry } from './agent-registry';
import type {
  AgentRunOutcome,
  AgentRunRecord,
  AgentTier,
  AgentType,
  CleanupMode,
  MailboxMessage,
  PersistedAgentRegistry,
  ResourceLimits,
  ResourceUsage,
  SpawnParams,
  SynthesisConflict,
  SynthesisStrategy,
  SynthesizedResult,
} from './agent-types';
import {
  DEFAULT_RESOURCE_LIMITS,
  REGISTRY_VERSION,
} from './agent-types';

// =============================================================================
// Types
// =============================================================================

export interface AgentLifecycleOptions {
  /** Agent registry for definition lookups */
  readonly registry: AgentRegistry;
  /** Path to the persistence file */
  readonly persistPath: string;
  /** Resource limits configuration */
  readonly resourceLimits?: Partial<ResourceLimits>;
  /** Logger function */
  readonly logger?: (message: string) => void;
  /** Archive check interval in ms. Default: 60_000 */
  readonly sweepIntervalMs?: number;
  /** Callback when an agent run completes */
  readonly onRunCompleted?: (record: AgentRunRecord) => void;
  /** Callback when an agent run fails */
  readonly onRunFailed?: (record: AgentRunRecord) => void;
}

// =============================================================================
// Agent Lifecycle Manager
// =============================================================================

export class AgentLifecycleManager {
  private readonly registry: AgentRegistry;
  private readonly persistPath: string;
  private readonly limits: ResourceLimits;
  private readonly logger: (message: string) => void;
  private readonly sweepIntervalMs: number;
  private readonly onRunCompleted?: (record: AgentRunRecord) => void;
  private readonly onRunFailed?: (record: AgentRunRecord) => void;

  private readonly runs: Map<string, AgentRunRecord> = new Map();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private restored = false;

  constructor(options: AgentLifecycleOptions) {
    this.registry = options.registry;
    this.persistPath = path.resolve(options.persistPath);
    this.limits = {
      ...DEFAULT_RESOURCE_LIMITS,
      ...options.resourceLimits,
    };
    this.logger = options.logger ?? console.warn;
    this.sweepIntervalMs = options.sweepIntervalMs ?? 60_000;
    this.onRunCompleted = options.onRunCompleted;
    this.onRunFailed = options.onRunFailed;
  }

  // ===========================================================================
  // Spawn
  // ===========================================================================

  /**
   * Spawns a new agent instance.
   * Validates resource limits, creates a run record, and persists state.
   *
   * @throws Error if resource limits would be exceeded
   * @throws Error if the agent definition is not found
   */
  spawn(params: SpawnParams): AgentRunRecord {
    // Validate agent exists
    const definition = this.registry.get(params.agentId);
    if (!definition) {
      throw new Error(
        `Agent "${params.agentId}" not found in registry`
      );
    }

    // Validate resource limits
    if (!this.canSpawn(definition.metadata.type)) {
      throw new Error(
        `Cannot spawn agent "${params.agentId}": resource limits exceeded`
      );
    }

    const now = Date.now();
    const runId = `run-${crypto.randomUUID()}`;
    const cleanup = params.cleanup ?? 'keep';

    // Compute archive time
    const archiveAfterMs = this.limits.archiveAfterMinutes * 60_000;
    const archiveAtMs = archiveAfterMs > 0
      ? now + archiveAfterMs
      : undefined;

    // Build child session key
    const childSessionKey = `agent:main:subagent:${params.agentId}-${runId.slice(4, 12)}`;

    const record: AgentRunRecord = {
      runId,
      agentId: params.agentId,
      childSessionKey,
      requesterSessionKey: params.requesterSessionKey,
      requesterDisplayKey: params.requesterDisplayKey,
      task: params.task,
      label: params.label,
      agentType: definition.metadata.type,
      agentTier: definition.metadata.tier,
      model: params.model ?? definition.metadata.model,
      createdAt: now,
      startedAt: now,
      cleanup,
      archiveAtMs,
      cleanupHandled: false,
    };

    this.runs.set(runId, record);
    this.persist();

    if (archiveAtMs) {
      this.startSweeper();
    }

    this.logger(
      `[Lifecycle] Spawned agent "${params.agentId}" as run ${runId.slice(0, 12)}`
    );

    return record;
  }

  // ===========================================================================
  // Monitor
  // ===========================================================================

  /**
   * Gets the current status of a run.
   */
  getRunStatus(
    runId: string
  ): 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'unknown' {
    const record = this.runs.get(runId);
    if (!record) {
      return 'unknown';
    }

    if (!record.startedAt) {
      return 'pending';
    }

    if (!record.endedAt) {
      return 'running';
    }

    const status = record.outcome?.status;
    if (status === 'ok') return 'completed';
    if (status === 'error') return 'failed';
    if (status === 'timeout') return 'timeout';
    return 'completed';
  }

  /**
   * Gets a run record by ID.
   */
  getRun(runId: string): AgentRunRecord | undefined {
    return this.runs.get(runId);
  }

  /**
   * Lists all currently active (not yet ended) runs.
   */
  listActiveRuns(): AgentRunRecord[] {
    const active: AgentRunRecord[] = [];
    for (const record of this.runs.values()) {
      if (!record.endedAt) {
        active.push(record);
      }
    }
    return active;
  }

  /**
   * Lists all runs (active and completed) for a given requester.
   */
  listRunsForRequester(requesterSessionKey: string): AgentRunRecord[] {
    const key = requesterSessionKey.trim();
    if (!key) {
      return [];
    }

    const results: AgentRunRecord[] = [];
    for (const record of this.runs.values()) {
      if (record.requesterSessionKey === key) {
        results.push(record);
      }
    }
    return results;
  }

  /**
   * Lists all runs for a specific agent definition.
   */
  listRunsForAgent(agentId: string): AgentRunRecord[] {
    const id = agentId.toLowerCase().trim();
    const results: AgentRunRecord[] = [];
    for (const record of this.runs.values()) {
      if (record.agentId === id) {
        results.push(record);
      }
    }
    return results;
  }

  /**
   * Marks a run as started. Updates the startedAt timestamp.
   */
  markStarted(runId: string, startedAt?: number): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    record.startedAt = startedAt ?? Date.now();
    this.persist();
  }

  /**
   * Marks a run as completed with an outcome.
   */
  markCompleted(
    runId: string,
    outcome: AgentRunOutcome,
    endedAt?: number
  ): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    record.endedAt = endedAt ?? Date.now();
    record.outcome = outcome;
    this.persist();

    if (outcome.status === 'ok' || outcome.status === 'timeout') {
      this.onRunCompleted?.(record);
    } else {
      this.onRunFailed?.(record);
    }

    this.logger(
      `[Lifecycle] Run ${runId.slice(0, 12)} completed: ${outcome.status}`
    );
  }

  /**
   * Updates token usage for a run.
   */
  updateTokenUsage(
    runId: string,
    tokensUsed: number,
    costEstimate?: number
  ): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    record.tokensUsed = tokensUsed;
    if (costEstimate !== undefined) {
      record.costEstimate = costEstimate;
    }
    this.persist();
  }

  // ===========================================================================
  // Communication (Mailbox)
  // ===========================================================================

  /**
   * Sends a message to a running agent's mailbox.
   */
  sendMessage(
    toRunId: string,
    fromAgentId: string,
    fromRunId: string,
    content: string,
    replyTo?: string
  ): MailboxMessage {
    const record = this.runs.get(toRunId);
    if (!record) {
      throw new Error(`Run "${toRunId}" not found`);
    }

    const message: MailboxMessage = {
      id: crypto.randomUUID(),
      fromAgentId,
      fromRunId,
      toAgentId: record.agentId,
      content,
      timestamp: Date.now(),
      read: false,
      replyTo,
    };

    if (!record.mailbox) {
      record.mailbox = [];
    }
    record.mailbox.push(message);
    this.persist();

    return message;
  }

  /**
   * Gets unread messages for a run.
   */
  getUnreadMessages(runId: string): MailboxMessage[] {
    const record = this.runs.get(runId);
    if (!record || !record.mailbox) {
      return [];
    }

    return record.mailbox.filter(msg => !msg.read);
  }

  /**
   * Gets all messages for a run.
   */
  getMailbox(runId: string): MailboxMessage[] {
    const record = this.runs.get(runId);
    return record?.mailbox ?? [];
  }

  /**
   * Marks a message as read.
   */
  markMessageRead(runId: string, messageId: string): void {
    const record = this.runs.get(runId);
    if (!record || !record.mailbox) {
      return;
    }

    const message = record.mailbox.find(msg => msg.id === messageId);
    if (message) {
      message.read = true;
      this.persist();
    }
  }

  // ===========================================================================
  // Output Collection & Synthesis
  // ===========================================================================

  /**
   * Synthesizes outputs from multiple completed runs.
   * Delegates to the appropriate synthesis strategy.
   */
  synthesizeOutputs(
    runIds: string[],
    strategy: SynthesisStrategy = 'merge'
  ): SynthesizedResult {
    const startTime = Date.now();
    const records = runIds
      .map(id => this.runs.get(id))
      .filter((r): r is AgentRunRecord => r !== undefined);

    if (records.length === 0) {
      return {
        id: crypto.randomUUID(),
        strategy,
        inputRunIds: runIds,
        synthesizedOutput: null,
        confidence: 0,
        conflicts: [],
        duration: Date.now() - startTime,
      };
    }

    // Collect outcomes as output objects
    const outputs = records.map(r => ({
      agentId: r.agentId,
      runId: r.runId,
      status: r.outcome?.status ?? 'unknown',
      task: r.task,
      label: r.label,
      tokensUsed: r.tokensUsed,
    }));

    let synthesizedOutput: unknown;
    let confidence = 1;
    const conflicts: SynthesisConflict[] = [];

    switch (strategy) {
      case 'merge':
        synthesizedOutput = this.mergeSynthesis(outputs);
        confidence = 1;
        break;

      case 'vote': {
        const voteResult = this.voteSynthesis(outputs);
        synthesizedOutput = voteResult.output;
        confidence = voteResult.confidence;
        break;
      }

      case 'best_pick': {
        const bestResult = this.bestPickSynthesis(records);
        synthesizedOutput = bestResult.output;
        confidence = bestResult.confidence;
        break;
      }

      case 'chain':
        synthesizedOutput = this.chainSynthesis(records);
        confidence = records.filter(r => r.outcome?.status === 'ok').length / records.length;
        break;

      case 'consensus':
      case 'weighted_average':
      default:
        // Fall back to merge for unsupported strategies
        synthesizedOutput = this.mergeSynthesis(outputs);
        break;
    }

    return {
      id: crypto.randomUUID(),
      strategy,
      inputRunIds: runIds,
      synthesizedOutput,
      confidence,
      conflicts,
      duration: Date.now() - startTime,
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Stops a running agent instance.
   */
  stopRun(runId: string): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    if (record.endedAt) {
      return; // Already ended
    }

    record.endedAt = Date.now();
    record.outcome = { status: 'error', error: 'Stopped by user' };
    this.persist();

    this.logger(`[Lifecycle] Stopped run ${runId.slice(0, 12)}`);
  }

  /**
   * Stops all active runs for a given requester.
   * Returns the number of runs stopped.
   */
  stopAllForRequester(requesterSessionKey: string): number {
    const key = requesterSessionKey.trim();
    let stopped = 0;

    for (const record of this.runs.values()) {
      if (record.requesterSessionKey === key && !record.endedAt) {
        record.endedAt = Date.now();
        record.outcome = { status: 'error', error: 'Stopped by user (bulk)' };
        stopped++;
      }
    }

    if (stopped > 0) {
      this.persist();
    }

    return stopped;
  }

  /**
   * Releases a completed run record from the registry.
   */
  releaseRun(runId: string): void {
    const deleted = this.runs.delete(runId);
    if (deleted) {
      this.persist();
    }

    if (this.runs.size === 0) {
      this.stopSweeper();
    }
  }

  /**
   * Marks cleanup as handled for a run.
   * Returns false if the run is not found or cleanup was already handled.
   */
  beginCleanup(runId: string): boolean {
    const record = this.runs.get(runId);
    if (!record) {
      return false;
    }
    if (record.cleanupCompletedAt) {
      return false;
    }
    if (record.cleanupHandled) {
      return false;
    }

    record.cleanupHandled = true;
    this.persist();
    return true;
  }

  /**
   * Finalizes cleanup for a run.
   * If cleanup mode is "delete", removes the run record.
   * If "keep", marks cleanupCompletedAt.
   */
  finalizeCleanup(runId: string, success: boolean): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    if (!success) {
      // Allow retry on next wake
      record.cleanupHandled = false;
      this.persist();
      return;
    }

    if (record.cleanup === 'delete') {
      this.runs.delete(runId);
      this.persist();
      return;
    }

    record.cleanupCompletedAt = Date.now();
    this.persist();
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Persists all run records to disk.
   */
  persist(): void {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const serialized: Record<string, AgentRunRecord> = {};
      for (const [runId, record] of this.runs) {
        serialized[runId] = record;
      }

      const data: PersistedAgentRegistry = {
        version: REGISTRY_VERSION,
        runs: serialized,
      };

      fs.writeFileSync(
        this.persistPath,
        JSON.stringify(data, null, 2) + '\n',
        'utf-8'
      );
    } catch (err) {
      this.logger(
        `[Lifecycle] Persist failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Restores run records from disk.
   * Only runs once per instance; subsequent calls are no-ops.
   */
  restore(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;

    try {
      if (!fs.existsSync(this.persistPath)) {
        return;
      }

      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedAgentRegistry>;

      if (parsed.version !== REGISTRY_VERSION) {
        this.logger(
          `[Lifecycle] Unknown persistence version: ${parsed.version}, expected ${REGISTRY_VERSION}`
        );
        return;
      }

      const runs = parsed.runs;
      if (!runs || typeof runs !== 'object') {
        return;
      }

      let restoredCount = 0;
      for (const [runId, record] of Object.entries(runs)) {
        if (!record || typeof record !== 'object') {
          continue;
        }
        if (!record.runId || typeof record.runId !== 'string') {
          continue;
        }

        // Keep any newer in-memory entries
        if (!this.runs.has(runId)) {
          this.runs.set(runId, record);
          restoredCount++;
        }
      }

      // Start sweeper if any archived runs exist
      if ([...this.runs.values()].some(r => r.archiveAtMs)) {
        this.startSweeper();
      }

      this.logger(
        `[Lifecycle] Restored ${restoredCount} run records from disk`
      );
    } catch (err) {
      this.logger(
        `[Lifecycle] Restore failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ===========================================================================
  // Resource Limits
  // ===========================================================================

  /**
   * Returns current resource usage statistics.
   */
  getResourceUsage(): ResourceUsage {
    const activeByType: Record<string, number> = {};
    const activeByTier: Record<number, number> = {};
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const record of this.runs.values()) {
      if (!record.endedAt) {
        totalActive++;

        const type = record.agentType ?? 'unknown';
        activeByType[type] = (activeByType[type] ?? 0) + 1;

        if (record.agentTier !== undefined) {
          activeByTier[record.agentTier] =
            (activeByTier[record.agentTier] ?? 0) + 1;
        }
      } else {
        if (
          record.outcome?.status === 'error' ||
          record.outcome?.status === 'timeout'
        ) {
          totalFailed++;
        } else {
          totalCompleted++;
        }
      }
    }

    return {
      totalActive,
      activeByType,
      activeByTier,
      totalCompleted,
      totalFailed,
    };
  }

  /**
   * Checks whether a new agent of the given type can be spawned
   * within current resource limits.
   */
  canSpawn(agentType?: AgentType): boolean {
    const usage = this.getResourceUsage();

    // Check total concurrent limit
    if (usage.totalActive >= this.limits.maxConcurrentAgents) {
      return false;
    }

    // Check per-type limit
    if (agentType) {
      const typeCount = usage.activeByType[agentType] ?? 0;
      if (typeCount >= this.limits.maxConcurrentPerType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks whether a new agent at the given tier can be spawned.
   */
  canSpawnAtTier(tier: AgentTier): boolean {
    const usage = this.getResourceUsage();
    const tierCount = usage.activeByTier[tier] ?? 0;
    const tierLimit = this.limits.maxConcurrentPerTier[tier] ?? this.limits.maxConcurrentAgents;
    return tierCount < tierLimit;
  }

  /**
   * Returns the effective timeout for a run, clamped to configured limits.
   */
  resolveTimeout(requestedMs?: number): number {
    if (!requestedMs || requestedMs <= 0) {
      return this.limits.defaultTimeoutMs;
    }
    return Math.min(requestedMs, this.limits.maxTimeoutMs);
  }

  // ===========================================================================
  // Shutdown
  // ===========================================================================

  /**
   * Gracefully shuts down the lifecycle manager.
   * Stops the sweeper and persists final state.
   */
  shutdown(): void {
    this.stopSweeper();
    this.persist();
    this.logger('[Lifecycle] Shutdown complete');
  }

  /**
   * Resets all state. Primarily for testing.
   */
  resetForTests(): void {
    this.runs.clear();
    this.stopSweeper();
    this.restored = false;
    this.persist();
  }

  // ===========================================================================
  // Private: Sweeper
  // ===========================================================================

  private startSweeper(): void {
    if (this.sweeper) {
      return;
    }

    this.sweeper = setInterval(() => {
      this.sweepArchived();
    }, this.sweepIntervalMs);

    // Allow process to exit even if sweeper is running
    if (this.sweeper && typeof this.sweeper === 'object' && 'unref' in this.sweeper) {
      (this.sweeper as { unref: () => void }).unref();
    }
  }

  private stopSweeper(): void {
    if (!this.sweeper) {
      return;
    }
    clearInterval(this.sweeper);
    this.sweeper = null;
  }

  /**
   * Removes runs that have passed their archive time.
   */
  private sweepArchived(): void {
    const now = Date.now();
    let mutated = false;

    for (const [runId, record] of this.runs) {
      if (!record.archiveAtMs || record.archiveAtMs > now) {
        continue;
      }

      this.runs.delete(runId);
      mutated = true;
      this.logger(
        `[Lifecycle] Archived run ${runId.slice(0, 12)} (agent: ${record.agentId})`
      );
    }

    if (mutated) {
      this.persist();
    }

    if (this.runs.size === 0) {
      this.stopSweeper();
    }
  }

  // ===========================================================================
  // Private: Synthesis Strategies
  // ===========================================================================

  private mergeSynthesis(
    outputs: Array<{
      agentId: string;
      runId: string;
      status: string;
      task: string;
      label?: string;
    }>
  ): unknown {
    return {
      agents: outputs.map(o => ({
        agentId: o.agentId,
        runId: o.runId,
        status: o.status,
        task: o.task,
        label: o.label,
      })),
      totalAgents: outputs.length,
      successCount: outputs.filter(o => o.status === 'ok').length,
      failureCount: outputs.filter(o => o.status !== 'ok').length,
    };
  }

  private voteSynthesis(
    outputs: Array<{ status: string }>
  ): { output: unknown; confidence: number } {
    const statusCounts: Record<string, number> = {};

    for (const output of outputs) {
      const status = output.status;
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }

    let winner = 'unknown';
    let maxCount = 0;
    for (const [status, count] of Object.entries(statusCounts)) {
      if (count > maxCount) {
        winner = status;
        maxCount = count;
      }
    }

    return {
      output: { consensusStatus: winner, votes: statusCounts },
      confidence: outputs.length > 0 ? maxCount / outputs.length : 0,
    };
  }

  private bestPickSynthesis(
    records: AgentRunRecord[]
  ): { output: unknown; confidence: number } {
    // Pick the run with the best outcome and shortest duration
    const completed = records.filter(r => r.outcome?.status === 'ok');
    if (completed.length === 0) {
      return { output: null, confidence: 0 };
    }

    const sorted = [...completed].sort((a, b) => {
      const durationA = (a.endedAt ?? 0) - (a.startedAt ?? 0);
      const durationB = (b.endedAt ?? 0) - (b.startedAt ?? 0);
      return durationA - durationB;
    });

    const best = sorted[0];
    return {
      output: {
        agentId: best.agentId,
        runId: best.runId,
        task: best.task,
        label: best.label,
        duration: (best.endedAt ?? 0) - (best.startedAt ?? 0),
      },
      confidence: completed.length / records.length,
    };
  }

  private chainSynthesis(records: AgentRunRecord[]): unknown {
    // Return the last completed run's info
    const sorted = [...records]
      .filter(r => r.endedAt)
      .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));

    const last = sorted[sorted.length - 1];
    if (!last) {
      return null;
    }

    return {
      finalAgent: last.agentId,
      finalRunId: last.runId,
      task: last.task,
      label: last.label,
      chainLength: sorted.length,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an AgentLifecycleManager with standard configuration.
 */
export function createAgentLifecycleManager(
  registry: AgentRegistry,
  stateDir: string,
  limits?: Partial<ResourceLimits>
): AgentLifecycleManager {
  return new AgentLifecycleManager({
    registry,
    persistPath: path.join(stateDir, 'agents', 'runs.json'),
    resourceLimits: limits,
  });
}
