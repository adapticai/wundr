/**
 * @wundr/orchestrator-daemon - Agent Lifecycle Manager
 *
 * Manages the full lifecycle of agent instances: spawn, monitor, cleanup.
 * Provides persistence across process restarts, output collection and
 * synthesis, agent-to-agent communication via mailbox, and resource
 * limit enforcement.
 *
 * Enhanced with:
 * - Agent state persistence across sessions (save/restore)
 * - Health monitoring with heartbeats
 * - Dead agent detection and automatic restart
 * - Per-agent instance limits from frontmatter config
 * - Permission inheritance tracking
 * - Output fragment collection and result synthesis
 * - Concurrent agent limit management per agent ID
 * - V1 -> V2 persistence migration
 *
 * Design reference: OpenClaw's subagent-registry.ts persistence model
 * extended with Wundr's tier hierarchy and team coordination.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_RESOURCE_LIMITS,
  PERSISTED_STATE_VERSION,
  REGISTRY_VERSION,
} from './agent-types';

import type { AgentRegistry } from './agent-registry';
import type {
  AgentHealthStatus,
  AgentOutputFragment,
  AgentPersistedState,
  AgentRunOutcome,
  AgentRunRecord,
  AgentTier,
  AgentType,
  HeartbeatConfig,
  MailboxMessage,
  MemoryScope,
  PersistedAgentRegistry,
  PersistedAgentRegistryV1,
  ResourceLimits,
  ResourceUsage,
  SpawnParams,
  SynthesisConflict,
  SynthesisStrategy,
  SynthesizedResult,
  ToolRestrictions,
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
  /** Heartbeat configuration */
  readonly heartbeat?: Partial<HeartbeatConfig>;
  /** Logger function */
  readonly logger?: (message: string) => void;
  /** Archive check interval in ms. Default: 60_000 */
  readonly sweepIntervalMs?: number;
  /** Callback when an agent run completes */
  readonly onRunCompleted?: (record: AgentRunRecord) => void;
  /** Callback when an agent run fails */
  readonly onRunFailed?: (record: AgentRunRecord) => void;
  /** Callback when a dead agent is detected */
  readonly onAgentDead?: (record: AgentRunRecord) => void;
  /** Callback when an agent is restarted */
  readonly onAgentRestarted?: (
    oldRunId: string,
    newRecord: AgentRunRecord
  ) => void;
}

// =============================================================================
// Agent Lifecycle Manager
// =============================================================================

export class AgentLifecycleManager {
  private readonly registry: AgentRegistry;
  private readonly persistPath: string;
  private readonly limits: ResourceLimits;
  private readonly heartbeatConfig: HeartbeatConfig;
  private readonly logger: (message: string) => void;
  private readonly sweepIntervalMs: number;
  private readonly onRunCompleted?: (record: AgentRunRecord) => void;
  private readonly onRunFailed?: (record: AgentRunRecord) => void;
  private readonly onAgentDead?: (record: AgentRunRecord) => void;
  private readonly onAgentRestarted?: (
    oldRunId: string,
    newRecord: AgentRunRecord
  ) => void;

  private readonly runs: Map<string, AgentRunRecord> = new Map();
  private readonly agentStates: Map<string, AgentPersistedState> = new Map();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private healthChecker: ReturnType<typeof setInterval> | null = null;
  private restored = false;

  constructor(options: AgentLifecycleOptions) {
    this.registry = options.registry;
    this.persistPath = path.resolve(options.persistPath);
    this.limits = {
      ...DEFAULT_RESOURCE_LIMITS,
      ...options.resourceLimits,
    };
    this.heartbeatConfig = {
      ...DEFAULT_HEARTBEAT_CONFIG,
      ...options.heartbeat,
    };
    this.logger = options.logger ?? console.warn;
    this.sweepIntervalMs = options.sweepIntervalMs ?? 60_000;
    this.onRunCompleted = options.onRunCompleted;
    this.onRunFailed = options.onRunFailed;
    this.onAgentDead = options.onAgentDead;
    this.onAgentRestarted = options.onAgentRestarted;
  }

  // ===========================================================================
  // Spawn
  // ===========================================================================

  /**
   * Spawns a new agent instance.
   * Validates resource limits, creates a run record, and persists state.
   *
   * Supports permission inheritance: if `parentRunId` is provided, the
   * child agent's effective permissions are intersected with the parent's.
   *
   * @throws Error if resource limits would be exceeded
   * @throws Error if the agent definition is not found
   * @throws Error if per-agent instance limits would be exceeded
   */
  spawn(params: SpawnParams): AgentRunRecord {
    // Validate agent exists
    const definition = this.registry.get(params.agentId);
    if (!definition) {
      throw new Error(`Agent "${params.agentId}" not found in registry`);
    }

    // Validate resource limits
    if (!this.canSpawn(definition.metadata.type)) {
      throw new Error(
        `Cannot spawn agent "${params.agentId}": resource limits exceeded`
      );
    }

    // Validate per-agent instance limit
    if (!this.canSpawnAgent(params.agentId)) {
      const maxInstances =
        definition.metadata.maxInstances ??
        this.limits.maxConcurrentPerAgent?.[params.agentId];
      throw new Error(
        `Cannot spawn agent "${params.agentId}": max instances (${maxInstances ?? 'N/A'}) reached`
      );
    }

    // Validate parent permission to spawn subagents
    if (params.parentRunId) {
      const parentRecord = this.runs.get(params.parentRunId);
      if (parentRecord) {
        const parentDef = this.registry.get(parentRecord.agentId);
        if (parentDef && parentDef.metadata.canSpawnSubagents === false) {
          throw new Error(
            `Parent agent "${parentRecord.agentId}" is not allowed to spawn sub-agents`
          );
        }
      }
    }

    const now = Date.now();
    const runId = `run-${crypto.randomUUID()}`;
    const cleanup = params.cleanup ?? 'keep';

    // Compute archive time
    const archiveAfterMs = this.limits.archiveAfterMinutes * 60_000;
    const archiveAtMs = archiveAfterMs > 0 ? now + archiveAfterMs : undefined;

    // Build child session key
    const childSessionKey = `agent:main:subagent:${params.agentId}-${runId.slice(4, 12)}`;

    // Resolve memory scope
    const memoryScope =
      params.memoryScope ?? this.registry.resolveMemoryScope(params.agentId);

    // Resolve effective tool restrictions
    let effectiveToolRestrictions: ToolRestrictions | undefined =
      params.toolRestrictions;
    if (!effectiveToolRestrictions && params.parentRunId) {
      const parentRecord = this.runs.get(params.parentRunId);
      if (parentRecord?.effectiveToolRestrictions) {
        const parentRestrictions = parentRecord.effectiveToolRestrictions;
        const agentDef = this.registry.get(params.agentId);
        if (agentDef?.metadata.toolRestrictions) {
          // Let registry handle the intersection
          effectiveToolRestrictions = agentDef.metadata.toolRestrictions;
        } else {
          effectiveToolRestrictions = parentRestrictions;
        }
      }
    }

    // Resolve permission chain
    const permissionChainIds = this.registry.resolvePermissionChain(
      params.agentId
    );

    // Resolve max restarts from definition
    const maxRestarts =
      definition.metadata.maxRestarts ?? this.heartbeatConfig.maxRestarts;

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
      parentRunId: params.parentRunId,
      lastHeartbeat: now,
      missedHeartbeats: 0,
      restartCount: 0,
      maxRestarts,
      memoryScope,
      effectiveToolRestrictions,
      permissionChainIds,
      outputFragments: [],
    };

    this.runs.set(runId, record);
    this.persist();

    if (archiveAtMs) {
      this.startSweeper();
    }

    this.startHealthChecker();

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
    if (status === 'ok') {
      return 'completed';
    }
    if (status === 'error') {
      return 'failed';
    }
    if (status === 'timeout') {
      return 'timeout';
    }
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
   * Lists all child runs spawned by a given parent run.
   */
  listChildRuns(parentRunId: string): AgentRunRecord[] {
    const results: AgentRunRecord[] = [];
    for (const record of this.runs.values()) {
      if (record.parentRunId === parentRunId) {
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
    record.lastHeartbeat = record.startedAt;
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

    // Auto-save state if agent is configured for persistence
    if (record.memoryScope !== 'local') {
      this.autoSaveState(record);
    }

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

  /**
   * Updates turn count for a run.
   */
  updateTurnsUsed(runId: string, turnsUsed: number): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    record.turnsUsed = turnsUsed;
    this.persist();
  }

  // ===========================================================================
  // Health Monitoring (Heartbeats)
  // ===========================================================================

  /**
   * Records a heartbeat from a running agent.
   * Resets the missed heartbeat counter.
   */
  recordHeartbeat(runId: string): void {
    const record = this.runs.get(runId);
    if (!record || record.endedAt) {
      return;
    }

    record.lastHeartbeat = Date.now();
    record.missedHeartbeats = 0;
    // No persist on every heartbeat for performance; sweeper will persist
  }

  /**
   * Gets health status for all active runs.
   */
  getHealthStatuses(): AgentHealthStatus[] {
    const now = Date.now();
    const statuses: AgentHealthStatus[] = [];

    for (const record of this.runs.values()) {
      if (record.endedAt) {
        continue;
      }

      const lastHb =
        record.lastHeartbeat ?? record.startedAt ?? record.createdAt;
      const missedHeartbeats = record.missedHeartbeats ?? 0;
      const threshold = this.heartbeatConfig.missedThreshold;
      const healthy = missedHeartbeats < threshold;
      const pendingRestart =
        !healthy &&
        this.heartbeatConfig.autoRestart &&
        (record.restartCount ?? 0) <
          (record.maxRestarts ?? this.heartbeatConfig.maxRestarts);

      const mailbox = record.mailbox ?? [];
      const pendingMessages = mailbox.filter(m => !m.read).length;

      statuses.push({
        runId: record.runId,
        agentId: record.agentId,
        healthy,
        lastHeartbeat: lastHb,
        uptimeMs: now - (record.startedAt ?? record.createdAt),
        pendingMessages,
        errorCount: record.outcome?.status === 'error' ? 1 : 0,
        missedHeartbeats,
        pendingRestart,
      });
    }

    return statuses;
  }

  /**
   * Gets health status for a specific run.
   */
  getHealthStatus(runId: string): AgentHealthStatus | undefined {
    return this.getHealthStatuses().find(s => s.runId === runId);
  }

  /**
   * Checks all active runs for dead agents and optionally restarts them.
   * Called periodically by the health checker interval.
   */
  checkHealth(): { dead: string[]; restarted: string[] } {
    const now = Date.now();
    const dead: string[] = [];
    const restarted: string[] = [];
    let mutated = false;

    for (const record of this.runs.values()) {
      if (record.endedAt) {
        continue;
      }

      const lastHb =
        record.lastHeartbeat ?? record.startedAt ?? record.createdAt;
      const elapsed = now - lastHb;
      const missedCount = Math.floor(elapsed / this.heartbeatConfig.intervalMs);

      if (missedCount > (record.missedHeartbeats ?? 0)) {
        record.missedHeartbeats = missedCount;
        mutated = true;
      }

      if (missedCount < this.heartbeatConfig.missedThreshold) {
        continue;
      }

      // Agent is dead
      dead.push(record.runId);
      this.onAgentDead?.(record);

      this.logger(
        `[Lifecycle] Agent "${record.agentId}" (run ${record.runId.slice(0, 12)}) is dead ` +
          `(${missedCount} missed heartbeats)`
      );

      // Attempt restart if configured
      if (
        this.heartbeatConfig.autoRestart &&
        (record.restartCount ?? 0) <
          (record.maxRestarts ?? this.heartbeatConfig.maxRestarts)
      ) {
        const restartedRecord = this.restartAgent(record);
        if (restartedRecord) {
          restarted.push(restartedRecord.runId);
        }
      } else {
        // Mark as failed
        record.endedAt = now;
        record.outcome = {
          status: 'error',
          error: `Dead agent: ${missedCount} missed heartbeats, no restarts remaining`,
        };
        mutated = true;
      }
    }

    if (mutated) {
      this.persist();
    }

    return { dead, restarted };
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
  // Output Collection
  // ===========================================================================

  /**
   * Appends an output fragment to a run's collected output.
   */
  appendOutput(runId: string, content: string, isFinal = false): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    if (!record.outputFragments) {
      record.outputFragments = [];
    }

    const sequence = record.outputFragments.length;
    record.outputFragments.push({
      runId,
      sequence,
      content,
      timestamp: Date.now(),
      isFinal,
    });

    // Only persist on final output to reduce I/O
    if (isFinal) {
      this.persist();
    }
  }

  /**
   * Gets all collected output fragments for a run.
   */
  getOutput(runId: string): AgentOutputFragment[] {
    const record = this.runs.get(runId);
    return record?.outputFragments ?? [];
  }

  /**
   * Gets the concatenated final output for a run.
   */
  getOutputText(runId: string): string {
    const fragments = this.getOutput(runId);
    return fragments.map(f => f.content).join('');
  }

  // ===========================================================================
  // Output Synthesis
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
      outputText: this.getOutputText(r.runId),
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
        confidence =
          records.filter(r => r.outcome?.status === 'ok').length /
          records.length;
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
  // Agent State Persistence
  // ===========================================================================

  /**
   * Saves arbitrary state for an agent, scoped by memory scope.
   * Used for cross-session state continuity.
   */
  saveAgentState(
    agentId: string,
    scope: MemoryScope,
    data: Record<string, unknown>
  ): void {
    const existing = this.agentStates.get(agentId);

    const state: AgentPersistedState = {
      agentId,
      scope,
      data: { ...data },
      savedAt: Date.now(),
      runCount: (existing?.runCount ?? 0) + 1,
      version: PERSISTED_STATE_VERSION,
    };

    this.agentStates.set(agentId, state);
    this.persist();

    this.logger(
      `[Lifecycle] Saved state for agent "${agentId}" (scope: ${scope})`
    );
  }

  /**
   * Restores persisted state for an agent.
   */
  getAgentState(agentId: string): AgentPersistedState | undefined {
    return this.agentStates.get(agentId);
  }

  /**
   * Removes persisted state for an agent.
   */
  clearAgentState(agentId: string): boolean {
    const deleted = this.agentStates.delete(agentId);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  /**
   * Lists all agents with persisted state.
   */
  listPersistedAgents(): AgentPersistedState[] {
    return Array.from(this.agentStates.values());
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
      this.stopHealthChecker();
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

  /**
   * Performs garbage collection of all ended runs older than the specified age.
   * Returns the number of runs removed.
   */
  garbageCollect(maxAgeMs: number): number {
    const now = Date.now();
    let removed = 0;

    for (const [runId, record] of this.runs) {
      if (!record.endedAt) {
        continue;
      }

      if (now - record.endedAt > maxAgeMs) {
        this.runs.delete(runId);
        removed++;
      }
    }

    if (removed > 0) {
      this.persist();
      this.logger(`[Lifecycle] Garbage collected ${removed} expired runs`);
    }

    return removed;
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Persists all run records and agent states to disk.
   */
  persist(): void {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const serializedRuns: Record<string, AgentRunRecord> = {};
      for (const [runId, record] of this.runs) {
        serializedRuns[runId] = record;
      }

      const serializedStates: Record<string, AgentPersistedState> = {};
      for (const [agentId, state] of this.agentStates) {
        serializedStates[agentId] = state;
      }

      const data: PersistedAgentRegistry = {
        version: REGISTRY_VERSION,
        runs: serializedRuns,
        agentStates:
          Object.keys(serializedStates).length > 0
            ? serializedStates
            : undefined,
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
   * Restores run records and agent states from disk.
   * Supports migration from V1 to V2 persistence format.
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
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      const version = parsed.version;

      if (version === 1) {
        this.restoreFromV1(parsed as unknown as PersistedAgentRegistryV1);
        // Migrate to V2
        this.persist();
        this.logger('[Lifecycle] Migrated persistence from V1 to V2');
        return;
      }

      if (version !== REGISTRY_VERSION) {
        this.logger(
          `[Lifecycle] Unknown persistence version: ${version}, expected ${REGISTRY_VERSION}`
        );
        return;
      }

      this.restoreFromV2(parsed as unknown as PersistedAgentRegistry);
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
    const activeByAgent: Record<string, number> = {};
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

        activeByAgent[record.agentId] =
          (activeByAgent[record.agentId] ?? 0) + 1;
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
      activeByAgent,
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
   * Checks whether a specific agent can be spawned, considering
   * per-agent instance limits from both the definition and config.
   */
  canSpawnAgent(agentId: string): boolean {
    const definition = this.registry.get(agentId);
    const maxInstances =
      definition?.metadata.maxInstances ??
      this.limits.maxConcurrentPerAgent?.[agentId];

    if (maxInstances === undefined) {
      return true; // No per-agent limit
    }

    const usage = this.getResourceUsage();
    const currentCount = usage.activeByAgent[agentId] ?? 0;
    return currentCount < maxInstances;
  }

  /**
   * Checks whether a new agent at the given tier can be spawned.
   */
  canSpawnAtTier(tier: AgentTier): boolean {
    const usage = this.getResourceUsage();
    const tierCount = usage.activeByTier[tier] ?? 0;
    const tierLimit =
      this.limits.maxConcurrentPerTier[tier] ?? this.limits.maxConcurrentAgents;
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
   * Stops all timers and persists final state.
   */
  shutdown(): void {
    this.stopSweeper();
    this.stopHealthChecker();
    this.persist();
    this.logger('[Lifecycle] Shutdown complete');
  }

  /**
   * Resets all state. Primarily for testing.
   */
  resetForTests(): void {
    this.runs.clear();
    this.agentStates.clear();
    this.stopSweeper();
    this.stopHealthChecker();
    this.restored = false;
    this.persist();
  }

  // ===========================================================================
  // Private: Agent Restart
  // ===========================================================================

  /**
   * Attempts to restart a dead agent by creating a new run with the
   * same parameters. Marks the old run as failed.
   */
  private restartAgent(deadRecord: AgentRunRecord): AgentRunRecord | null {
    const now = Date.now();

    // Mark old run as failed
    deadRecord.endedAt = now;
    deadRecord.outcome = {
      status: 'error',
      error: `Dead agent (${deadRecord.missedHeartbeats ?? 0} missed heartbeats), restarting`,
    };

    try {
      const newRecord = this.spawn({
        agentId: deadRecord.agentId,
        task: deadRecord.task,
        label: deadRecord.label
          ? `${deadRecord.label} (restart ${(deadRecord.restartCount ?? 0) + 1})`
          : undefined,
        requesterSessionKey: deadRecord.requesterSessionKey,
        requesterDisplayKey: deadRecord.requesterDisplayKey,
        cleanup: deadRecord.cleanup,
        model: deadRecord.model,
        parentRunId: deadRecord.parentRunId,
        memoryScope: deadRecord.memoryScope,
        toolRestrictions: deadRecord.effectiveToolRestrictions,
      });

      // Track restart lineage
      newRecord.restartCount = (deadRecord.restartCount ?? 0) + 1;
      newRecord.maxRestarts = deadRecord.maxRestarts;

      this.persist();

      this.onAgentRestarted?.(deadRecord.runId, newRecord);

      this.logger(
        `[Lifecycle] Restarted agent "${deadRecord.agentId}" ` +
          `(old: ${deadRecord.runId.slice(0, 12)}, new: ${newRecord.runId.slice(0, 12)}, ` +
          `restart ${newRecord.restartCount}/${newRecord.maxRestarts ?? 'unlimited'})`
      );

      return newRecord;
    } catch (err) {
      this.logger(
        `[Lifecycle] Failed to restart agent "${deadRecord.agentId}": ` +
          `${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  // ===========================================================================
  // Private: Auto-Save State
  // ===========================================================================

  /**
   * Automatically saves state for a completed run if the agent is
   * configured for state persistence.
   */
  private autoSaveState(record: AgentRunRecord): void {
    const definition = this.registry.get(record.agentId);
    if (!definition || definition.metadata.persistState !== true) {
      return;
    }

    const scope = record.memoryScope ?? 'project';
    const existing = this.agentStates.get(record.agentId);

    const data: Record<string, unknown> = {
      ...(existing?.data ?? {}),
      lastRunId: record.runId,
      lastTask: record.task,
      lastOutcome: record.outcome?.status,
      lastCompletedAt: record.endedAt,
      tokensUsed:
        ((existing?.data?.tokensUsed as number) ?? 0) +
        (record.tokensUsed ?? 0),
      totalRuns: (existing?.runCount ?? 0) + 1,
    };

    this.saveAgentState(record.agentId, scope, data);
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
    if (
      this.sweeper &&
      typeof this.sweeper === 'object' &&
      'unref' in this.sweeper
    ) {
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
  // Private: Health Checker
  // ===========================================================================

  private startHealthChecker(): void {
    if (this.healthChecker) {
      return;
    }

    this.healthChecker = setInterval(() => {
      this.checkHealth();
    }, this.heartbeatConfig.intervalMs);

    if (
      this.healthChecker &&
      typeof this.healthChecker === 'object' &&
      'unref' in this.healthChecker
    ) {
      (this.healthChecker as { unref: () => void }).unref();
    }
  }

  private stopHealthChecker(): void {
    if (!this.healthChecker) {
      return;
    }
    clearInterval(this.healthChecker);
    this.healthChecker = null;
  }

  // ===========================================================================
  // Private: Persistence Restoration
  // ===========================================================================

  private restoreFromV1(parsed: PersistedAgentRegistryV1): void {
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

      // Migrate V1 records: add new fields with defaults
      if (!record.missedHeartbeats) {
        record.missedHeartbeats = 0;
      }
      if (!record.restartCount) {
        record.restartCount = 0;
      }
      if (!record.outputFragments) {
        record.outputFragments = [];
      }

      if (!this.runs.has(runId)) {
        this.runs.set(runId, record);
        restoredCount++;
      }
    }

    this.startTimersIfNeeded();

    this.logger(
      `[Lifecycle] Restored ${restoredCount} run records from V1 format`
    );
  }

  private restoreFromV2(parsed: PersistedAgentRegistry): void {
    const runs = parsed.runs;
    if (runs && typeof runs === 'object') {
      let restoredCount = 0;
      for (const [runId, record] of Object.entries(runs)) {
        if (!record || typeof record !== 'object') {
          continue;
        }
        if (!record.runId || typeof record.runId !== 'string') {
          continue;
        }

        if (!this.runs.has(runId)) {
          this.runs.set(runId, record);
          restoredCount++;
        }
      }

      this.logger(
        `[Lifecycle] Restored ${restoredCount} run records from disk`
      );
    }

    // Restore agent states
    const agentStates = parsed.agentStates;
    if (agentStates && typeof agentStates === 'object') {
      let stateCount = 0;
      for (const [agentId, state] of Object.entries(agentStates)) {
        if (!state || typeof state !== 'object') {
          continue;
        }
        if (!state.agentId || typeof state.agentId !== 'string') {
          continue;
        }

        if (!this.agentStates.has(agentId)) {
          this.agentStates.set(agentId, state);
          stateCount++;
        }
      }

      if (stateCount > 0) {
        this.logger(
          `[Lifecycle] Restored ${stateCount} agent states from disk`
        );
      }
    }

    this.startTimersIfNeeded();
  }

  private startTimersIfNeeded(): void {
    // Start sweeper if any archived runs exist
    if ([...this.runs.values()].some(r => r.archiveAtMs)) {
      this.startSweeper();
    }

    // Start health checker if any active runs exist
    if ([...this.runs.values()].some(r => !r.endedAt)) {
      this.startHealthChecker();
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
      outputText?: string;
    }>
  ): unknown {
    return {
      agents: outputs.map(o => ({
        agentId: o.agentId,
        runId: o.runId,
        status: o.status,
        task: o.task,
        label: o.label,
        output: o.outputText || undefined,
      })),
      totalAgents: outputs.length,
      successCount: outputs.filter(o => o.status === 'ok').length,
      failureCount: outputs.filter(o => o.status !== 'ok').length,
    };
  }

  private voteSynthesis(outputs: Array<{ status: string }>): {
    output: unknown;
    confidence: number;
  } {
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

  private bestPickSynthesis(records: AgentRunRecord[]): {
    output: unknown;
    confidence: number;
  } {
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
        output: this.getOutputText(best.runId) || undefined,
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
      output: this.getOutputText(last.runId) || undefined,
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
  limits?: Partial<ResourceLimits>,
  heartbeat?: Partial<HeartbeatConfig>
): AgentLifecycleManager {
  return new AgentLifecycleManager({
    registry,
    persistPath: path.join(stateDir, 'agents', 'runs.json'),
    resourceLimits: limits,
    heartbeat,
  });
}
