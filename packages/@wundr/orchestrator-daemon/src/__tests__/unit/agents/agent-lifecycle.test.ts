/**
 * Tests for AgentLifecycleManager (src/agents/agent-lifecycle.ts).
 *
 * Covers:
 *  - spawn() with validation, permission inheritance, and cleanup modes
 *  - recordHeartbeat() and heartbeat tracking
 *  - checkHealth() - dead agent detection with missed heartbeats
 *  - restartAgent() - restart count tracking and limits
 *  - saveAgentState / getAgentState / clearAgentState - cross-session persistence
 *  - appendOutput / getOutput / getOutputText - streaming output collection
 *  - canSpawnAgent - maxInstances checking
 *  - updateTurnsUsed
 *  - listChildRuns
 *  - garbageCollect - expired run removal
 *  - Persistence save / restore with V1 to V2 migration
 *  - Synthesis strategies with output text
 *  - Event callbacks (onAgentDead, onAgentRestarted)
 */

import * as fs from 'fs';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AgentLifecycleManager } from '../../../agents/agent-lifecycle';
import {
  REGISTRY_VERSION,
} from '../../../agents/agent-types';

import type { AgentLifecycleOptions } from '../../../agents/agent-lifecycle';
import type { AgentRegistry } from '../../../agents/agent-registry';
import type {
  AgentDefinition,
  AgentRunRecord,
  PersistedAgentRegistry,
  PersistedAgentRegistryV1,
} from '../../../agents/agent-types';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('fs', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue('{}'),
  };
});

// =============================================================================
// Helpers
// =============================================================================

function makeDefinition(
  overrides: Partial<AgentDefinition> & { id: string } = { id: 'test-agent' },
): AgentDefinition {
  return {
    id: overrides.id,
    metadata: {
      name: overrides.id,
      type: 'developer',
      tier: 3,
      maxInstances: undefined,
      maxRestarts: undefined,
      canSpawnSubagents: undefined,
      toolRestrictions: undefined,
      memoryScope: undefined,
      persistState: undefined,
      parentAgentId: undefined,
      model: 'sonnet',
      ...((overrides.metadata ?? {}) as Record<string, unknown>),
    } as AgentDefinition['metadata'],
    systemPrompt: overrides.systemPrompt ?? 'You are a test agent.',
    sourcePath: overrides.sourcePath ?? 'test/test-agent.md',
    category: overrides.category ?? 'test',
    mtime: overrides.mtime ?? Date.now(),
  };
}

function makeMockRegistry(
  definitions: Map<string, AgentDefinition> = new Map(),
): AgentRegistry {
  return {
    get: vi.fn((agentId: string) => definitions.get(agentId.toLowerCase().trim())),
    resolveMemoryScope: vi.fn((_agentId: string) => 'local'),
    resolvePermissionChain: vi.fn((agentId: string) => [agentId]),
  } as unknown as AgentRegistry;
}

function makeSpawnParams(overrides: Record<string, unknown> = {}) {
  return {
    agentId: 'test-agent',
    task: 'Do something useful',
    requesterSessionKey: 'session-abc',
    requesterDisplayKey: 'User',
    ...overrides,
  };
}

function createManager(
  overrides: Partial<AgentLifecycleOptions> = {},
  definitions?: Map<string, AgentDefinition>,
): { manager: AgentLifecycleManager; registry: AgentRegistry; logger: ReturnType<typeof vi.fn> } {
  const defs = definitions ?? new Map<string, AgentDefinition>([
    ['test-agent', makeDefinition({ id: 'test-agent' })],
  ]);
  const registry = makeMockRegistry(defs);
  const logger = vi.fn();

  const manager = new AgentLifecycleManager({
    registry,
    persistPath: '/tmp/test-runs.json',
    logger,
    heartbeat: {
      intervalMs: 1000,
      missedThreshold: 3,
      autoRestart: false,
      maxRestarts: 2,
    },
    ...overrides,
  });

  return { manager, registry, logger };
}

// =============================================================================
// Tests
// =============================================================================

describe('AgentLifecycleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // spawn()
  // ---------------------------------------------------------------------------

  describe('spawn()', () => {
    it('should create a run record with a unique runId', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      expect(record.runId).toBeDefined();
      expect(record.runId).toMatch(/^run-/);
      expect(record.agentId).toBe('test-agent');
      expect(record.task).toBe('Do something useful');
    });

    it('should set timestamps and defaults on the new record', () => {
      const { manager } = createManager();
      const before = Date.now();
      const record = manager.spawn(makeSpawnParams());
      const after = Date.now();

      expect(record.createdAt).toBeGreaterThanOrEqual(before);
      expect(record.createdAt).toBeLessThanOrEqual(after);
      expect(record.startedAt).toBe(record.createdAt);
      expect(record.lastHeartbeat).toBe(record.createdAt);
      expect(record.missedHeartbeats).toBe(0);
      expect(record.restartCount).toBe(0);
      expect(record.outputFragments).toEqual([]);
      expect(record.cleanup).toBe('keep');
    });

    it('should use the specified cleanup mode', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams({ cleanup: 'delete' }));
      expect(record.cleanup).toBe('delete');
    });

    it('should throw if agent definition not found', () => {
      const { manager } = createManager();
      expect(() =>
        manager.spawn(makeSpawnParams({ agentId: 'nonexistent' })),
      ).toThrow('Agent "nonexistent" not found in registry');
    });

    it('should throw if total concurrent agent limit is reached', () => {
      const { manager } = createManager({
        resourceLimits: { maxConcurrentAgents: 1 },
      });
      manager.spawn(makeSpawnParams());
      expect(() => manager.spawn(makeSpawnParams())).toThrow('resource limits exceeded');
    });

    it('should throw if per-type concurrent limit is reached', () => {
      const { manager } = createManager({
        resourceLimits: { maxConcurrentPerType: 1 },
      });
      manager.spawn(makeSpawnParams());
      expect(() => manager.spawn(makeSpawnParams())).toThrow('resource limits exceeded');
    });

    it('should throw if per-agent maxInstances limit is reached', () => {
      const def = makeDefinition({
        id: 'test-agent',
        metadata: { name: 'test-agent', type: 'developer', maxInstances: 1 } as AgentDefinition['metadata'],
      });
      const defs = new Map([['test-agent', def]]);
      const { manager } = createManager({}, defs);

      manager.spawn(makeSpawnParams());
      expect(() => manager.spawn(makeSpawnParams())).toThrow('max instances');
    });

    it('should throw if parent agent cannot spawn sub-agents', () => {
      const parentDef = makeDefinition({
        id: 'parent-agent',
        metadata: {
          name: 'parent-agent',
          type: 'coordinator',
          canSpawnSubagents: false,
        } as AgentDefinition['metadata'],
      });
      const childDef = makeDefinition({ id: 'test-agent' });
      const defs = new Map([
        ['parent-agent', parentDef],
        ['test-agent', childDef],
      ]);
      const { manager } = createManager({}, defs);

      const parentRecord = manager.spawn(makeSpawnParams({ agentId: 'parent-agent' }));
      expect(() =>
        manager.spawn(makeSpawnParams({ parentRunId: parentRecord.runId })),
      ).toThrow('not allowed to spawn sub-agents');
    });

    it('should set the model from the definition when not overridden', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      expect(record.model).toBe('sonnet');
    });

    it('should allow overriding the model in spawn params', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams({ model: 'opus' }));
      expect(record.model).toBe('opus');
    });

    it('should inherit tool restrictions from parent when child has none', () => {
      const parentDef = makeDefinition({
        id: 'parent-agent',
        metadata: {
          name: 'parent-agent',
          type: 'coordinator',
        } as AgentDefinition['metadata'],
      });
      const childDef = makeDefinition({ id: 'test-agent' });
      const defs = new Map([
        ['parent-agent', parentDef],
        ['test-agent', childDef],
      ]);
      const { manager } = createManager({}, defs);

      const parentRecord = manager.spawn(
        makeSpawnParams({
          agentId: 'parent-agent',
          toolRestrictions: { allowed: ['read', 'write'] },
        }),
      );

      const childRecord = manager.spawn(
        makeSpawnParams({ parentRunId: parentRecord.runId }),
      );

      expect(childRecord.effectiveToolRestrictions).toEqual({
        allowed: ['read', 'write'],
      });
    });

    it('should resolve permission chain IDs', () => {
      const { manager, registry } = createManager();
      (registry.resolvePermissionChain as ReturnType<typeof vi.fn>).mockReturnValue([
        'root-agent',
        'test-agent',
      ]);

      const record = manager.spawn(makeSpawnParams());
      expect(record.permissionChainIds).toEqual(['root-agent', 'test-agent']);
    });

    it('should persist after spawn', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams());
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should set archiveAtMs when archiveAfterMinutes is > 0', () => {
      const { manager } = createManager({
        resourceLimits: { archiveAfterMinutes: 10 },
      });
      const before = Date.now();
      const record = manager.spawn(makeSpawnParams());
      expect(record.archiveAtMs).toBeGreaterThanOrEqual(before + 10 * 60_000);
    });

    it('should set label and optional fields', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams({ label: 'important task' }));
      expect(record.label).toBe('important task');
    });
  });

  // ---------------------------------------------------------------------------
  // recordHeartbeat()
  // ---------------------------------------------------------------------------

  describe('recordHeartbeat()', () => {
    it('should update lastHeartbeat timestamp', () => {
      vi.useFakeTimers();
      // Use a very large heartbeat interval to prevent auto health checks
      // from killing the agent during advanceTimersByTime
      const { manager } = createManager({
        heartbeat: { intervalMs: 999_999, missedThreshold: 3, autoRestart: false, maxRestarts: 0 },
      });
      const record = manager.spawn(makeSpawnParams());
      const spawnTime = record.lastHeartbeat!;

      vi.advanceTimersByTime(5000);
      manager.recordHeartbeat(record.runId);

      const updated = manager.getRun(record.runId)!;
      expect(updated.lastHeartbeat).toBeGreaterThan(spawnTime);
      vi.useRealTimers();
    });

    it('should reset missedHeartbeats to zero', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      // Manually set missed heartbeats to simulate detection
      const run = manager.getRun(record.runId)!;
      run.missedHeartbeats = 2;

      manager.recordHeartbeat(record.runId);

      const updated = manager.getRun(record.runId)!;
      expect(updated.missedHeartbeats).toBe(0);
    });

    it('should be a no-op for ended runs', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      const endedRun = manager.getRun(record.runId)!;
      const heartbeatBefore = endedRun.lastHeartbeat;

      manager.recordHeartbeat(record.runId);
      expect(manager.getRun(record.runId)!.lastHeartbeat).toBe(heartbeatBefore);
    });

    it('should be a no-op for unknown run IDs', () => {
      const { manager } = createManager();
      // Should not throw
      manager.recordHeartbeat('run-nonexistent');
    });
  });

  // ---------------------------------------------------------------------------
  // checkHealth()
  // ---------------------------------------------------------------------------

  describe('checkHealth()', () => {
    // NOTE: These tests manipulate lastHeartbeat directly rather than using
    // vi.advanceTimersByTime, because the internal health checker interval
    // would auto-fire and process dead agents before our manual checkHealth().

    it('should detect dead agents after enough missed heartbeats', () => {
      const { manager } = createManager({
        heartbeat: {
          intervalMs: 1000,
          missedThreshold: 3,
          autoRestart: false,
          maxRestarts: 0,
        },
      });
      const record = manager.spawn(makeSpawnParams());

      // Simulate 3.5 seconds elapsed since last heartbeat
      const run = manager.getRun(record.runId)!;
      run.lastHeartbeat = Date.now() - 3500;

      const result = manager.checkHealth();
      expect(result.dead).toContain(record.runId);
      expect(result.restarted).toHaveLength(0);
    });

    it('should mark dead agents as failed when no restarts remaining', () => {
      const { manager } = createManager({
        heartbeat: {
          intervalMs: 1000,
          missedThreshold: 3,
          autoRestart: true,
          maxRestarts: 0,
        },
      });
      const record = manager.spawn(makeSpawnParams());

      // Simulate enough time for 3+ missed heartbeats
      const run = manager.getRun(record.runId)!;
      run.lastHeartbeat = Date.now() - 3500;

      manager.checkHealth();

      const updated = manager.getRun(record.runId)!;
      expect(updated.endedAt).toBeDefined();
      expect(updated.outcome?.status).toBe('error');
      expect(updated.outcome?.error).toContain('missed heartbeats');
    });

    it('should not flag agents that have recent heartbeats', () => {
      const { manager } = createManager({
        heartbeat: { intervalMs: 1000, missedThreshold: 3, autoRestart: false, maxRestarts: 0 },
      });
      const record = manager.spawn(makeSpawnParams());

      // Last heartbeat was very recent
      const run = manager.getRun(record.runId)!;
      run.lastHeartbeat = Date.now() - 500;

      const result = manager.checkHealth();
      expect(result.dead).toHaveLength(0);
    });

    it('should skip already-ended runs', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      const result = manager.checkHealth();
      expect(result.dead).toHaveLength(0);
    });

    it('should update missedHeartbeats count as time elapses', () => {
      const { manager } = createManager({
        heartbeat: { intervalMs: 1000, missedThreshold: 10, autoRestart: false, maxRestarts: 0 },
      });
      const record = manager.spawn(makeSpawnParams());

      // Simulate 2.5 seconds elapsed
      const run = manager.getRun(record.runId)!;
      run.lastHeartbeat = Date.now() - 2500;

      manager.checkHealth();

      expect(run.missedHeartbeats).toBe(2);
    });

    it('should invoke onAgentDead callback for dead agents', () => {
      const onAgentDead = vi.fn();
      const { manager } = createManager({
        onAgentDead,
        heartbeat: { intervalMs: 1000, missedThreshold: 3, autoRestart: false, maxRestarts: 0 },
      });
      const record = manager.spawn(makeSpawnParams());

      // Simulate enough time for death detection
      const run = manager.getRun(record.runId)!;
      run.lastHeartbeat = Date.now() - 3500;

      manager.checkHealth();

      expect(onAgentDead).toHaveBeenCalledOnce();
      expect(onAgentDead.mock.calls[0][0].agentId).toBe('test-agent');
    });
  });

  // ---------------------------------------------------------------------------
  // Restart (via checkHealth with autoRestart)
  // ---------------------------------------------------------------------------

  describe('restartAgent (via checkHealth)', () => {
    it('should restart a dead agent when autoRestart is enabled', () => {
      const { manager } = createManager({
        heartbeat: {
          intervalMs: 1000,
          missedThreshold: 3,
          autoRestart: true,
          maxRestarts: 2,
        },
      });
      const record = manager.spawn(makeSpawnParams());

      // Manipulate lastHeartbeat directly to simulate elapsed time
      // (using vi.advanceTimersByTime would trigger the internal health checker
      // interval before our manual checkHealth call)
      const run = manager.getRun(record.runId)!;
      run.lastHeartbeat = Date.now() - 3500;

      const result = manager.checkHealth();

      expect(result.dead).toContain(record.runId);
      expect(result.restarted).toHaveLength(1);

      // Old run should be ended
      const oldRun = manager.getRun(record.runId)!;
      expect(oldRun.endedAt).toBeDefined();
      expect(oldRun.outcome?.status).toBe('error');

      // New run should exist with incremented restart count
      const newRunId = result.restarted[0];
      const newRun = manager.getRun(newRunId)!;
      expect(newRun.restartCount).toBe(1);
      expect(newRun.agentId).toBe('test-agent');
    });

    it('should invoke onAgentRestarted callback', () => {
      const onAgentRestarted = vi.fn();
      const { manager } = createManager({
        onAgentRestarted,
        heartbeat: {
          intervalMs: 1000,
          missedThreshold: 3,
          autoRestart: true,
          maxRestarts: 2,
        },
      });
      const record = manager.spawn(makeSpawnParams());

      // Manipulate lastHeartbeat directly to avoid internal health checker race
      const run = manager.getRun(record.runId)!;
      run.lastHeartbeat = Date.now() - 3500;

      manager.checkHealth();

      expect(onAgentRestarted).toHaveBeenCalledOnce();
      expect(onAgentRestarted.mock.calls[0][0]).toBe(record.runId);
      expect(onAgentRestarted.mock.calls[0][1].agentId).toBe('test-agent');
    });

    it('should stop restarting after maxRestarts is reached', () => {
      const { manager } = createManager({
        heartbeat: {
          intervalMs: 1000,
          missedThreshold: 3,
          autoRestart: true,
          maxRestarts: 1,
        },
      });

      // Spawn first run
      const firstRun = manager.spawn(makeSpawnParams());

      // Simulate death of first run by manipulating lastHeartbeat
      const run1 = manager.getRun(firstRun.runId)!;
      run1.lastHeartbeat = Date.now() - 3500;

      // Kill first run -> restart #1
      const result1 = manager.checkHealth();
      expect(result1.restarted).toHaveLength(1);

      const restartedRunId = result1.restarted[0];
      const restartedRun = manager.getRun(restartedRunId)!;
      expect(restartedRun.restartCount).toBe(1);
      expect(restartedRun.maxRestarts).toBe(1);

      // Simulate death of restarted run
      restartedRun.lastHeartbeat = Date.now() - 3500;

      // Kill restarted run -> should NOT restart (count=1 >= max=1)
      const result2 = manager.checkHealth();
      expect(result2.dead).toContain(restartedRunId);
      expect(result2.restarted).toHaveLength(0);

      // Should be marked as failed
      const failedRun = manager.getRun(restartedRunId)!;
      expect(failedRun.endedAt).toBeDefined();
      expect(failedRun.outcome?.status).toBe('error');
      expect(failedRun.outcome?.error).toContain('no restarts remaining');
    });
  });

  // ---------------------------------------------------------------------------
  // saveAgentState / getAgentState / clearAgentState
  // ---------------------------------------------------------------------------

  describe('Agent state persistence', () => {
    it('should save and retrieve agent state', () => {
      const { manager } = createManager();
      manager.saveAgentState('my-agent', 'project', { foo: 'bar', count: 42 });

      const state = manager.getAgentState('my-agent');
      expect(state).toBeDefined();
      expect(state!.agentId).toBe('my-agent');
      expect(state!.scope).toBe('project');
      expect(state!.data).toEqual({ foo: 'bar', count: 42 });
      expect(state!.runCount).toBe(1);
    });

    it('should increment runCount on subsequent saves', () => {
      const { manager } = createManager();
      manager.saveAgentState('my-agent', 'project', { v: 1 });
      manager.saveAgentState('my-agent', 'project', { v: 2 });

      const state = manager.getAgentState('my-agent');
      expect(state!.runCount).toBe(2);
      expect(state!.data).toEqual({ v: 2 });
    });

    it('should return undefined for unknown agent state', () => {
      const { manager } = createManager();
      expect(manager.getAgentState('nonexistent')).toBeUndefined();
    });

    it('should clear state and return true for known agents', () => {
      const { manager } = createManager();
      manager.saveAgentState('my-agent', 'project', { v: 1 });

      const result = manager.clearAgentState('my-agent');
      expect(result).toBe(true);
      expect(manager.getAgentState('my-agent')).toBeUndefined();
    });

    it('should return false when clearing state for unknown agent', () => {
      const { manager } = createManager();
      expect(manager.clearAgentState('nonexistent')).toBe(false);
    });

    it('should list all persisted agent states', () => {
      const { manager } = createManager();
      manager.saveAgentState('agent-a', 'project', { a: 1 });
      manager.saveAgentState('agent-b', 'user', { b: 2 });

      const all = manager.listPersistedAgents();
      expect(all).toHaveLength(2);
      expect(all.map(s => s.agentId).sort()).toEqual(['agent-a', 'agent-b']);
    });

    it('should persist state to disk on save', () => {
      const { manager } = createManager();
      vi.mocked(fs.writeFileSync).mockClear();

      manager.saveAgentState('my-agent', 'project', { v: 1 });

      expect(fs.writeFileSync).toHaveBeenCalled();
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as PersistedAgentRegistry;
      expect(written.agentStates).toBeDefined();
      expect(written.agentStates!['my-agent'].agentId).toBe('my-agent');
    });
  });

  // ---------------------------------------------------------------------------
  // appendOutput / getOutput / getOutputText
  // ---------------------------------------------------------------------------

  describe('Output collection', () => {
    it('should append output fragments in sequence order', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      manager.appendOutput(record.runId, 'Hello ');
      manager.appendOutput(record.runId, 'World');

      const fragments = manager.getOutput(record.runId);
      expect(fragments).toHaveLength(2);
      expect(fragments[0].sequence).toBe(0);
      expect(fragments[0].content).toBe('Hello ');
      expect(fragments[1].sequence).toBe(1);
      expect(fragments[1].content).toBe('World');
    });

    it('should mark final fragments correctly', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      manager.appendOutput(record.runId, 'partial', false);
      manager.appendOutput(record.runId, ' done', true);

      const fragments = manager.getOutput(record.runId);
      expect(fragments[0].isFinal).toBe(false);
      expect(fragments[1].isFinal).toBe(true);
    });

    it('should concatenate all fragments via getOutputText()', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      manager.appendOutput(record.runId, 'Hello ');
      manager.appendOutput(record.runId, 'World');
      manager.appendOutput(record.runId, '!', true);

      expect(manager.getOutputText(record.runId)).toBe('Hello World!');
    });

    it('should return empty array/string for unknown run IDs', () => {
      const { manager } = createManager();
      expect(manager.getOutput('nonexistent')).toEqual([]);
      expect(manager.getOutputText('nonexistent')).toBe('');
    });

    it('should be a no-op for unknown run IDs on appendOutput', () => {
      const { manager } = createManager();
      // Should not throw
      manager.appendOutput('nonexistent', 'data');
    });

    it('should persist only on final output fragment', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      vi.mocked(fs.writeFileSync).mockClear();

      manager.appendOutput(record.runId, 'chunk1');
      expect(fs.writeFileSync).not.toHaveBeenCalled();

      manager.appendOutput(record.runId, 'chunk2', true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // canSpawnAgent()
  // ---------------------------------------------------------------------------

  describe('canSpawnAgent()', () => {
    it('should return true when no per-agent limit is set', () => {
      const { manager } = createManager();
      expect(manager.canSpawnAgent('test-agent')).toBe(true);
    });

    it('should return true when under the per-agent limit', () => {
      const def = makeDefinition({
        id: 'test-agent',
        metadata: { name: 'test-agent', type: 'developer', maxInstances: 3 } as AgentDefinition['metadata'],
      });
      const defs = new Map([['test-agent', def]]);
      const { manager } = createManager({}, defs);

      manager.spawn(makeSpawnParams());
      expect(manager.canSpawnAgent('test-agent')).toBe(true);
    });

    it('should return false when at the per-agent limit', () => {
      const def = makeDefinition({
        id: 'test-agent',
        metadata: { name: 'test-agent', type: 'developer', maxInstances: 1 } as AgentDefinition['metadata'],
      });
      const defs = new Map([['test-agent', def]]);
      const { manager } = createManager({}, defs);

      manager.spawn(makeSpawnParams());
      expect(manager.canSpawnAgent('test-agent')).toBe(false);
    });

    it('should use maxConcurrentPerAgent from resource limits as fallback', () => {
      const def = makeDefinition({
        id: 'test-agent',
        metadata: { name: 'test-agent', type: 'developer' } as AgentDefinition['metadata'],
      });
      const defs = new Map([['test-agent', def]]);
      const { manager } = createManager({
        resourceLimits: {
          maxConcurrentPerAgent: { 'test-agent': 1 },
        },
      }, defs);

      manager.spawn(makeSpawnParams());
      expect(manager.canSpawnAgent('test-agent')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // updateTurnsUsed()
  // ---------------------------------------------------------------------------

  describe('updateTurnsUsed()', () => {
    it('should update the turnsUsed field on a run record', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      manager.updateTurnsUsed(record.runId, 15);

      const updated = manager.getRun(record.runId)!;
      expect(updated.turnsUsed).toBe(15);
    });

    it('should be a no-op for unknown run IDs', () => {
      const { manager } = createManager();
      // Should not throw
      manager.updateTurnsUsed('nonexistent', 5);
    });

    it('should persist after update', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      vi.mocked(fs.writeFileSync).mockClear();

      manager.updateTurnsUsed(record.runId, 10);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // listChildRuns()
  // ---------------------------------------------------------------------------

  describe('listChildRuns()', () => {
    it('should return only runs with the given parentRunId', () => {
      const parentDef = makeDefinition({
        id: 'parent-agent',
        metadata: { name: 'parent-agent', type: 'coordinator' } as AgentDefinition['metadata'],
      });
      const childDef = makeDefinition({ id: 'test-agent' });
      const defs = new Map([
        ['parent-agent', parentDef],
        ['test-agent', childDef],
      ]);
      const { manager } = createManager({}, defs);

      const parent = manager.spawn(makeSpawnParams({ agentId: 'parent-agent' }));
      const child1 = manager.spawn(makeSpawnParams({ parentRunId: parent.runId }));
      const child2 = manager.spawn(makeSpawnParams({ parentRunId: parent.runId }));
      // Unrelated agent
      manager.spawn(makeSpawnParams({ agentId: 'parent-agent' }));

      const children = manager.listChildRuns(parent.runId);
      expect(children).toHaveLength(2);
      const childIds = children.map(c => c.runId);
      expect(childIds).toContain(child1.runId);
      expect(childIds).toContain(child2.runId);
    });

    it('should return empty array when no children exist', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      expect(manager.listChildRuns(record.runId)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // garbageCollect()
  // ---------------------------------------------------------------------------

  describe('garbageCollect()', () => {
    it('should remove ended runs older than maxAgeMs', () => {
      vi.useFakeTimers();
      const { manager } = createManager();

      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      vi.advanceTimersByTime(60_000);
      const removed = manager.garbageCollect(30_000);

      expect(removed).toBe(1);
      expect(manager.getRun(record.runId)).toBeUndefined();
      vi.useRealTimers();
    });

    it('should not remove runs still within maxAgeMs', () => {
      vi.useFakeTimers();
      const { manager } = createManager();

      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      vi.advanceTimersByTime(5_000);
      const removed = manager.garbageCollect(30_000);

      expect(removed).toBe(0);
      expect(manager.getRun(record.runId)).toBeDefined();
      vi.useRealTimers();
    });

    it('should not remove active (not ended) runs', () => {
      // Use a very large heartbeat interval so the internal health checker
      // does not auto-fire and mark the agent as dead during timer advancement
      const { manager } = createManager({
        heartbeat: { intervalMs: 999_999, missedThreshold: 999, autoRestart: false, maxRestarts: 0 },
      });

      const record = manager.spawn(makeSpawnParams());

      // Even with a very small maxAgeMs, active runs should never be removed
      // Manually verify the run is still active (no endedAt)
      expect(manager.getRun(record.runId)!.endedAt).toBeUndefined();

      const removed = manager.garbageCollect(1);

      expect(removed).toBe(0);
    });

    it('should persist after removing runs', () => {
      vi.useFakeTimers();
      const { manager } = createManager();

      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });
      vi.mocked(fs.writeFileSync).mockClear();

      vi.advanceTimersByTime(60_000);
      manager.garbageCollect(30_000);

      expect(fs.writeFileSync).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should return 0 and not persist when nothing to remove', () => {
      const { manager } = createManager();
      vi.mocked(fs.writeFileSync).mockClear();

      const removed = manager.garbageCollect(30_000);
      expect(removed).toBe(0);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Persistence: save / restore with V1 -> V2 migration
  // ---------------------------------------------------------------------------

  describe('Persistence', () => {
    it('should serialize runs and agentStates as V2 format', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams());
      manager.saveAgentState('my-agent', 'project', { x: 1 });
      vi.mocked(fs.writeFileSync).mockClear();

      manager.persist();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as PersistedAgentRegistry;

      expect(written.version).toBe(REGISTRY_VERSION);
      expect(Object.keys(written.runs)).toHaveLength(1);
      expect(written.agentStates).toBeDefined();
      expect(written.agentStates!['my-agent']).toBeDefined();
    });

    it('should omit agentStates key when empty', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams());
      vi.mocked(fs.writeFileSync).mockClear();

      manager.persist();

      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as PersistedAgentRegistry;
      expect(written.agentStates).toBeUndefined();
    });

    it('should create the directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const { manager } = createManager();

      manager.persist();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true },
      );
    });

    it('should restore from V2 format', () => {
      const now = Date.now();
      const v2Data: PersistedAgentRegistry = {
        version: REGISTRY_VERSION,
        runs: {
          'run-abc': {
            runId: 'run-abc',
            agentId: 'test-agent',
            childSessionKey: 'session-key',
            requesterSessionKey: 'req-key',
            requesterDisplayKey: 'User',
            task: 'restored task',
            createdAt: now,
            startedAt: now,
            cleanup: 'keep',
            outputFragments: [],
            missedHeartbeats: 0,
            restartCount: 0,
          } as AgentRunRecord,
        },
        agentStates: {
          'my-agent': {
            agentId: 'my-agent',
            scope: 'project',
            data: { restored: true },
            savedAt: now,
            runCount: 5,
            version: 1,
          },
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(v2Data));

      const { manager } = createManager();
      manager.restore();

      const run = manager.getRun('run-abc');
      expect(run).toBeDefined();
      expect(run!.task).toBe('restored task');

      const state = manager.getAgentState('my-agent');
      expect(state).toBeDefined();
      expect(state!.data).toEqual({ restored: true });
      expect(state!.runCount).toBe(5);
    });

    it('should restore from V1 format and migrate to V2', () => {
      const now = Date.now();
      const v1Data: PersistedAgentRegistryV1 = {
        version: 1,
        runs: {
          'run-old': {
            runId: 'run-old',
            agentId: 'legacy-agent',
            childSessionKey: 'session-key',
            requesterSessionKey: 'req-key',
            requesterDisplayKey: 'User',
            task: 'old task',
            createdAt: now,
            startedAt: now,
            cleanup: 'keep',
          } as AgentRunRecord,
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(v1Data));

      const { manager, logger } = createManager();
      vi.mocked(fs.writeFileSync).mockClear();

      manager.restore();

      // Should have migrated record with defaults
      const run = manager.getRun('run-old');
      expect(run).toBeDefined();
      expect(run!.missedHeartbeats).toBe(0);
      expect(run!.restartCount).toBe(0);
      expect(run!.outputFragments).toEqual([]);

      // Should have persisted the migrated V2 format
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('Migrated persistence from V1 to V2'),
      );
    });

    it('should only restore once (idempotent)', () => {
      const v2Data: PersistedAgentRegistry = {
        version: REGISTRY_VERSION,
        runs: {
          'run-once': {
            runId: 'run-once',
            agentId: 'test-agent',
            childSessionKey: 'sk',
            requesterSessionKey: 'rk',
            requesterDisplayKey: 'U',
            task: 'task',
            createdAt: Date.now(),
            cleanup: 'keep',
          } as AgentRunRecord,
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(v2Data));

      const { manager } = createManager();
      manager.restore();
      manager.restore(); // Second call should be a no-op

      // readFileSync should only have been called once (for restore)
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should log and skip unknown persistence versions', () => {
      const unknownVersionData = { version: 99, runs: {} };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(unknownVersionData));

      const { manager, logger } = createManager();
      manager.restore();

      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('Unknown persistence version'),
      );
    });

    it('should handle corrupt persistence file gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('NOT VALID JSON{{{');

      const { manager, logger } = createManager();
      // Should not throw
      manager.restore();

      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('Restore failed'),
      );
    });

    it('should handle persist failures gracefully', () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('disk full');
      });

      const { manager, logger } = createManager();
      // Should not throw
      manager.persist();

      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('Persist failed'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Synthesis strategies
  // ---------------------------------------------------------------------------

  describe('synthesizeOutputs()', () => {
    function setupSynthesisRuns(manager: AgentLifecycleManager) {
      const run1 = manager.spawn(makeSpawnParams({ label: 'worker-1' }));
      manager.appendOutput(run1.runId, 'result-A', true);
      manager.markCompleted(run1.runId, { status: 'ok' });

      const run2 = manager.spawn(makeSpawnParams({ label: 'worker-2' }));
      manager.appendOutput(run2.runId, 'result-B', true);
      manager.markCompleted(run2.runId, { status: 'ok' });

      return [run1, run2];
    }

    it('should return empty result for no runs', () => {
      const { manager } = createManager();
      const result = manager.synthesizeOutputs([]);
      expect(result.synthesizedOutput).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return empty result for non-existent run IDs', () => {
      const { manager } = createManager();
      const result = manager.synthesizeOutputs(['run-fake-1', 'run-fake-2']);
      expect(result.synthesizedOutput).toBeNull();
    });

    describe('merge strategy', () => {
      it('should merge outputs from multiple completed runs', () => {
        const { manager } = createManager();
        const [run1, run2] = setupSynthesisRuns(manager);

        const result = manager.synthesizeOutputs([run1.runId, run2.runId], 'merge');

        expect(result.strategy).toBe('merge');
        expect(result.confidence).toBe(1);
        expect(result.inputRunIds).toEqual([run1.runId, run2.runId]);

        const output = result.synthesizedOutput as {
          agents: Array<{ agentId: string; output?: string }>;
          totalAgents: number;
        };
        expect(output.totalAgents).toBe(2);
        expect(output.agents).toHaveLength(2);
        expect(output.agents[0].output).toBe('result-A');
        expect(output.agents[1].output).toBe('result-B');
      });
    });

    describe('vote strategy', () => {
      it('should determine consensus status via voting', () => {
        const { manager } = createManager();
        const [run1, run2] = setupSynthesisRuns(manager);

        const result = manager.synthesizeOutputs([run1.runId, run2.runId], 'vote');

        expect(result.strategy).toBe('vote');
        const output = result.synthesizedOutput as {
          consensusStatus: string;
          votes: Record<string, number>;
        };
        expect(output.consensusStatus).toBe('ok');
        expect(output.votes['ok']).toBe(2);
        expect(result.confidence).toBe(1);
      });
    });

    describe('best_pick strategy', () => {
      it('should pick the run with the best outcome', () => {
        vi.useFakeTimers();
        const { manager } = createManager();

        const run1 = manager.spawn(makeSpawnParams({ label: 'fast' }));
        manager.appendOutput(run1.runId, 'fast-result', true);
        vi.advanceTimersByTime(100);
        manager.markCompleted(run1.runId, { status: 'ok' });

        const run2 = manager.spawn(makeSpawnParams({ label: 'slow' }));
        manager.appendOutput(run2.runId, 'slow-result', true);
        vi.advanceTimersByTime(500);
        manager.markCompleted(run2.runId, { status: 'ok' });

        const result = manager.synthesizeOutputs([run1.runId, run2.runId], 'best_pick');

        expect(result.strategy).toBe('best_pick');
        expect(result.confidence).toBe(1);

        const output = result.synthesizedOutput as { agentId: string; output?: string };
        expect(output.agentId).toBe('test-agent');
        vi.useRealTimers();
      });

      it('should return null output when no runs succeeded', () => {
        const { manager } = createManager();
        const run1 = manager.spawn(makeSpawnParams());
        manager.markCompleted(run1.runId, { status: 'error', error: 'fail' });

        const result = manager.synthesizeOutputs([run1.runId], 'best_pick');
        expect(result.synthesizedOutput).toBeNull();
        expect(result.confidence).toBe(0);
      });
    });

    describe('chain strategy', () => {
      it('should return the last completed run in the chain', () => {
        vi.useFakeTimers();
        const { manager } = createManager();

        const run1 = manager.spawn(makeSpawnParams({ label: 'step-1' }));
        manager.appendOutput(run1.runId, 'step-1-output', true);
        vi.advanceTimersByTime(100);
        manager.markCompleted(run1.runId, { status: 'ok' });

        const run2 = manager.spawn(makeSpawnParams({ label: 'step-2' }));
        manager.appendOutput(run2.runId, 'step-2-output', true);
        vi.advanceTimersByTime(100);
        manager.markCompleted(run2.runId, { status: 'ok' });

        const result = manager.synthesizeOutputs([run1.runId, run2.runId], 'chain');

        expect(result.strategy).toBe('chain');
        const output = result.synthesizedOutput as {
          finalRunId: string;
          chainLength: number;
          output?: string;
        };
        expect(output.finalRunId).toBe(run2.runId);
        expect(output.chainLength).toBe(2);
        expect(output.output).toBe('step-2-output');
        vi.useRealTimers();
      });
    });

    describe('unsupported strategies', () => {
      it('should fall back to merge for consensus strategy', () => {
        const { manager } = createManager();
        const [run1, run2] = setupSynthesisRuns(manager);

        const result = manager.synthesizeOutputs([run1.runId, run2.runId], 'consensus');

        expect(result.strategy).toBe('consensus');
        const output = result.synthesizedOutput as { totalAgents: number };
        expect(output.totalAgents).toBe(2);
      });

      it('should fall back to merge for weighted_average strategy', () => {
        const { manager } = createManager();
        const [run1, run2] = setupSynthesisRuns(manager);

        const result = manager.synthesizeOutputs([run1.runId, run2.runId], 'weighted_average');

        expect(result.strategy).toBe('weighted_average');
        const output = result.synthesizedOutput as { totalAgents: number };
        expect(output.totalAgents).toBe(2);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Event callbacks
  // ---------------------------------------------------------------------------

  describe('Event callbacks', () => {
    it('should invoke onRunCompleted for successful completions', () => {
      const onRunCompleted = vi.fn();
      const { manager } = createManager({ onRunCompleted });

      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      expect(onRunCompleted).toHaveBeenCalledOnce();
      expect(onRunCompleted.mock.calls[0][0].runId).toBe(record.runId);
    });

    it('should invoke onRunCompleted for timeout outcomes', () => {
      const onRunCompleted = vi.fn();
      const { manager } = createManager({ onRunCompleted });

      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'timeout' });

      expect(onRunCompleted).toHaveBeenCalledOnce();
    });

    it('should invoke onRunFailed for error outcomes', () => {
      const onRunFailed = vi.fn();
      const { manager } = createManager({ onRunFailed });

      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'error', error: 'boom' });

      expect(onRunFailed).toHaveBeenCalledOnce();
      expect(onRunFailed.mock.calls[0][0].outcome?.error).toBe('boom');
    });
  });

  // ---------------------------------------------------------------------------
  // Run status and queries
  // ---------------------------------------------------------------------------

  describe('getRunStatus()', () => {
    it('should return "running" for active runs', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      expect(manager.getRunStatus(record.runId)).toBe('running');
    });

    it('should return "completed" for ok outcomes', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });
      expect(manager.getRunStatus(record.runId)).toBe('completed');
    });

    it('should return "failed" for error outcomes', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'error', error: 'fail' });
      expect(manager.getRunStatus(record.runId)).toBe('failed');
    });

    it('should return "timeout" for timeout outcomes', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'timeout' });
      expect(manager.getRunStatus(record.runId)).toBe('timeout');
    });

    it('should return "unknown" for non-existent runs', () => {
      const { manager } = createManager();
      expect(manager.getRunStatus('run-nonexistent')).toBe('unknown');
    });
  });

  describe('listActiveRuns()', () => {
    it('should return only active runs', () => {
      const { manager } = createManager();
      const run1 = manager.spawn(makeSpawnParams());
      const run2 = manager.spawn(makeSpawnParams());
      manager.markCompleted(run1.runId, { status: 'ok' });

      const active = manager.listActiveRuns();
      expect(active).toHaveLength(1);
      expect(active[0].runId).toBe(run2.runId);
    });
  });

  describe('listRunsForRequester()', () => {
    it('should return runs for a specific requester', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams({ requesterSessionKey: 'alice' }));
      manager.spawn(makeSpawnParams({ requesterSessionKey: 'bob' }));
      manager.spawn(makeSpawnParams({ requesterSessionKey: 'alice' }));

      const aliceRuns = manager.listRunsForRequester('alice');
      expect(aliceRuns).toHaveLength(2);
      aliceRuns.forEach(r => expect(r.requesterSessionKey).toBe('alice'));
    });

    it('should return empty for empty or whitespace key', () => {
      const { manager } = createManager();
      expect(manager.listRunsForRequester('')).toEqual([]);
      expect(manager.listRunsForRequester('   ')).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // stopRun / releaseRun
  // ---------------------------------------------------------------------------

  describe('stopRun()', () => {
    it('should mark a running agent as failed', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      manager.stopRun(record.runId);

      const stopped = manager.getRun(record.runId)!;
      expect(stopped.endedAt).toBeDefined();
      expect(stopped.outcome?.status).toBe('error');
      expect(stopped.outcome?.error).toBe('Stopped by user');
    });

    it('should be a no-op for already-ended runs', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });
      const endedAt = manager.getRun(record.runId)!.endedAt;

      manager.stopRun(record.runId);
      expect(manager.getRun(record.runId)!.endedAt).toBe(endedAt);
    });
  });

  describe('releaseRun()', () => {
    it('should remove a run record entirely', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      manager.releaseRun(record.runId);

      expect(manager.getRun(record.runId)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Health status
  // ---------------------------------------------------------------------------

  describe('getHealthStatuses()', () => {
    it('should return health status for active runs', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams());

      const statuses = manager.getHealthStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].healthy).toBe(true);
      expect(statuses[0].missedHeartbeats).toBe(0);
      expect(statuses[0].pendingRestart).toBe(false);
    });

    it('should exclude ended runs', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      const statuses = manager.getHealthStatuses();
      expect(statuses).toHaveLength(0);
    });

    it('should report unhealthy agents past the missed threshold', () => {
      vi.useFakeTimers();
      const { manager } = createManager({
        heartbeat: { intervalMs: 1000, missedThreshold: 3, autoRestart: true, maxRestarts: 2 },
      });
      manager.spawn(makeSpawnParams());

      // Set missedHeartbeats manually (checkHealth would normally do this)
      const runs = manager.listActiveRuns();
      runs[0].missedHeartbeats = 4;

      const statuses = manager.getHealthStatuses();
      expect(statuses[0].healthy).toBe(false);
      expect(statuses[0].pendingRestart).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('getHealthStatus()', () => {
    it('should return status for a specific run', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      const status = manager.getHealthStatus(record.runId);
      expect(status).toBeDefined();
      expect(status!.runId).toBe(record.runId);
    });

    it('should return undefined for non-existent or ended runs', () => {
      const { manager } = createManager();
      expect(manager.getHealthStatus('nonexistent')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Token usage
  // ---------------------------------------------------------------------------

  describe('updateTokenUsage()', () => {
    it('should update token count and cost estimate', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      manager.updateTokenUsage(record.runId, 5000, 0.05);

      const updated = manager.getRun(record.runId)!;
      expect(updated.tokensUsed).toBe(5000);
      expect(updated.costEstimate).toBe(0.05);
    });
  });

  // ---------------------------------------------------------------------------
  // Resource usage
  // ---------------------------------------------------------------------------

  describe('getResourceUsage()', () => {
    it('should count active, completed, and failed runs', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams());

      const r2 = manager.spawn(makeSpawnParams());
      manager.markCompleted(r2.runId, { status: 'ok' });

      const r3 = manager.spawn(makeSpawnParams());
      manager.markCompleted(r3.runId, { status: 'error', error: 'fail' });

      const usage = manager.getResourceUsage();
      expect(usage.totalActive).toBe(1);
      expect(usage.totalCompleted).toBe(1);
      expect(usage.totalFailed).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Shutdown / reset
  // ---------------------------------------------------------------------------

  describe('shutdown()', () => {
    it('should persist state and log shutdown', () => {
      const { manager, logger } = createManager();
      manager.spawn(makeSpawnParams());
      vi.mocked(fs.writeFileSync).mockClear();

      manager.shutdown();

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown complete'),
      );
    });
  });

  describe('resetForTests()', () => {
    it('should clear all runs and agent states', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams());
      manager.saveAgentState('a', 'project', { x: 1 });

      manager.resetForTests();

      expect(manager.listActiveRuns()).toHaveLength(0);
      expect(manager.getAgentState('a')).toBeUndefined();
      expect(manager.listPersistedAgents()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Mailbox
  // ---------------------------------------------------------------------------

  describe('Mailbox', () => {
    it('should send and retrieve messages', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      const msg = manager.sendMessage(
        record.runId,
        'sender-agent',
        'run-sender',
        'Hello there',
      );

      expect(msg.id).toBeDefined();
      expect(msg.content).toBe('Hello there');
      expect(msg.read).toBe(false);

      const unread = manager.getUnreadMessages(record.runId);
      expect(unread).toHaveLength(1);
      expect(unread[0].content).toBe('Hello there');
    });

    it('should mark messages as read', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());

      const msg = manager.sendMessage(record.runId, 'a', 'r', 'content');
      manager.markMessageRead(record.runId, msg.id);

      expect(manager.getUnreadMessages(record.runId)).toHaveLength(0);
      expect(manager.getMailbox(record.runId)).toHaveLength(1);
      expect(manager.getMailbox(record.runId)[0].read).toBe(true);
    });

    it('should throw when sending to non-existent run', () => {
      const { manager } = createManager();
      expect(() =>
        manager.sendMessage('nonexistent', 'a', 'r', 'content'),
      ).toThrow('Run "nonexistent" not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup workflow
  // ---------------------------------------------------------------------------

  describe('Cleanup workflow', () => {
    it('should beginCleanup and finalize with keep mode', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      const started = manager.beginCleanup(record.runId);
      expect(started).toBe(true);

      manager.finalizeCleanup(record.runId, true);

      const cleaned = manager.getRun(record.runId)!;
      expect(cleaned.cleanupCompletedAt).toBeDefined();
    });

    it('should delete run on finalize with delete mode', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams({ cleanup: 'delete' }));
      manager.markCompleted(record.runId, { status: 'ok' });

      manager.beginCleanup(record.runId);
      manager.finalizeCleanup(record.runId, true);

      expect(manager.getRun(record.runId)).toBeUndefined();
    });

    it('should reset cleanupHandled on failed finalize', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      manager.beginCleanup(record.runId);
      manager.finalizeCleanup(record.runId, false);

      const run = manager.getRun(record.runId)!;
      expect(run.cleanupHandled).toBe(false);
    });

    it('should not allow double beginCleanup', () => {
      const { manager } = createManager();
      const record = manager.spawn(makeSpawnParams());
      manager.markCompleted(record.runId, { status: 'ok' });

      expect(manager.beginCleanup(record.runId)).toBe(true);
      expect(manager.beginCleanup(record.runId)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // stopAllForRequester
  // ---------------------------------------------------------------------------

  describe('stopAllForRequester()', () => {
    it('should stop all active runs for a requester', () => {
      const { manager } = createManager();
      manager.spawn(makeSpawnParams({ requesterSessionKey: 'alice' }));
      manager.spawn(makeSpawnParams({ requesterSessionKey: 'alice' }));
      manager.spawn(makeSpawnParams({ requesterSessionKey: 'bob' }));

      const stopped = manager.stopAllForRequester('alice');
      expect(stopped).toBe(2);

      // Alice's runs should be ended
      const aliceRuns = manager.listRunsForRequester('alice');
      aliceRuns.forEach(r => {
        expect(r.endedAt).toBeDefined();
        expect(r.outcome?.status).toBe('error');
      });

      // Bob's run should still be active
      const bobRuns = manager.listRunsForRequester('bob');
      expect(bobRuns[0].endedAt).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // resolveTimeout
  // ---------------------------------------------------------------------------

  describe('resolveTimeout()', () => {
    it('should return default timeout for undefined or zero request', () => {
      const { manager } = createManager();
      expect(manager.resolveTimeout()).toBe(300_000);
      expect(manager.resolveTimeout(0)).toBe(300_000);
    });

    it('should clamp to maxTimeoutMs', () => {
      const { manager } = createManager();
      expect(manager.resolveTimeout(999_999_999)).toBe(3_600_000);
    });

    it('should allow requests under the max', () => {
      const { manager } = createManager();
      expect(manager.resolveTimeout(60_000)).toBe(60_000);
    });
  });

  // ---------------------------------------------------------------------------
  // canSpawnAtTier
  // ---------------------------------------------------------------------------

  describe('canSpawnAtTier()', () => {
    it('should respect per-tier limits', () => {
      const def = makeDefinition({
        id: 'test-agent',
        metadata: { name: 'test-agent', type: 'developer', tier: 0 } as AgentDefinition['metadata'],
      });
      const defs = new Map([['test-agent', def]]);
      const { manager } = createManager({
        resourceLimits: {
          maxConcurrentPerTier: { 0: 1, 1: 3, 2: 5, 3: 10 },
        },
      }, defs);

      expect(manager.canSpawnAtTier(0)).toBe(true);

      manager.spawn(makeSpawnParams());
      expect(manager.canSpawnAtTier(0)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // listRunsForAgent
  // ---------------------------------------------------------------------------

  describe('listRunsForAgent()', () => {
    it('should return all runs for a specific agent ID', () => {
      const parentDef = makeDefinition({
        id: 'parent-agent',
        metadata: { name: 'parent-agent', type: 'coordinator' } as AgentDefinition['metadata'],
      });
      const childDef = makeDefinition({ id: 'test-agent' });
      const defs = new Map([
        ['parent-agent', parentDef],
        ['test-agent', childDef],
      ]);
      const { manager } = createManager({}, defs);

      manager.spawn(makeSpawnParams());
      manager.spawn(makeSpawnParams());
      manager.spawn(makeSpawnParams({ agentId: 'parent-agent' }));

      const testRuns = manager.listRunsForAgent('test-agent');
      expect(testRuns).toHaveLength(2);
      testRuns.forEach(r => expect(r.agentId).toBe('test-agent'));
    });
  });
});
