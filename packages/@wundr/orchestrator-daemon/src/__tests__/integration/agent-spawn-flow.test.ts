/**
 * Integration tests: Agent Spawn Flow
 *
 * Validates the end-to-end agent spawn chain:
 *   AgentLoader -> AgentRegistry -> AgentLifecycleManager
 *
 * Tests cover:
 *   - Agent definition loading and registration
 *   - Permission inheritance through parent-child chains
 *   - Tool restriction resolution with parent constraints
 *   - Lifecycle spawn, heartbeat, health, and cleanup
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AgentLifecycleManager } from '../../agents/agent-lifecycle';
import { createEmptyRegistry } from '../../agents/agent-registry';

import type { AgentRegistry} from '../../agents/agent-registry';
import type {
  AgentDefinition,
  AgentMetadata,
  AgentTier,
  ToolRestrictions,
} from '../../agents/agent-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wundr-agent-test-'));
}

function buildAgent(
  id: string,
  overrides: Partial<AgentMetadata> = {},
): AgentDefinition {
  return {
    id,
    metadata: {
      name: id,
      description: `Test agent ${id}`,
      type: 'developer',
      tier: 2 as AgentTier,
      priority: 'medium',
      capabilities: ['code', 'review'],
      model: 'sonnet',
      permissionMode: 'ask',
      canSpawnSubagents: true,
      memoryScope: 'project',
      ...overrides,
    } as AgentMetadata,
    systemPrompt: `You are agent ${id}.`,
    sourcePath: `test/${id}.md`,
    category: 'test',
    mtime: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Agent Spawn Flow Integration', () => {
  let registry: AgentRegistry;
  let lifecycle: AgentLifecycleManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    registry = createEmptyRegistry();
    lifecycle = new AgentLifecycleManager({
      registry,
      persistPath: path.join(tmpDir, 'runs.json'),
      resourceLimits: {
        maxConcurrentAgents: 10,
        maxConcurrentPerType: 5,
      },
      heartbeat: {
        intervalMs: 1_000,
        missedThreshold: 3,
        autoRestart: true,
        maxRestarts: 2,
      },
      logger: () => {}, // suppress test output
    });
  });

  afterEach(() => {
    lifecycle.shutdown();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors on CI
    }
  });

  // -------------------------------------------------------------------------
  // Registry -> Lifecycle: spawn flow
  // -------------------------------------------------------------------------

  describe('registry -> lifecycle spawn flow', () => {
    it('registers agents and spawns them through the lifecycle manager', () => {
      const coder = buildAgent('eng-code-surgeon');
      registry.register(coder);

      const record = lifecycle.spawn({
        agentId: 'eng-code-surgeon',
        task: 'Refactor auth module',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      expect(record.runId).toBeDefined();
      expect(record.agentId).toBe('eng-code-surgeon');
      expect(record.task).toBe('Refactor auth module');
      expect(record.agentType).toBe('developer');
      expect(record.agentTier).toBe(2);
    });

    it('throws when spawning an unregistered agent', () => {
      expect(() => {
        lifecycle.spawn({
          agentId: 'nonexistent-agent',
          task: 'Do something',
          requesterSessionKey: 'agent:main:main',
          requesterDisplayKey: 'main',
        });
      }).toThrow('not found in registry');
    });

    it('enforces per-agent instance limits from definition', () => {
      const limited = buildAgent('limited-agent', { maxInstances: 1 });
      registry.register(limited);

      // First spawn succeeds
      lifecycle.spawn({
        agentId: 'limited-agent',
        task: 'Task A',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      // Second spawn should fail
      expect(() => {
        lifecycle.spawn({
          agentId: 'limited-agent',
          task: 'Task B',
          requesterSessionKey: 'agent:main:main',
          requesterDisplayKey: 'main',
        });
      }).toThrow('max instances');
    });

    it('enforces total concurrent agent limit', () => {
      lifecycle = new AgentLifecycleManager({
        registry,
        persistPath: path.join(tmpDir, 'runs.json'),
        resourceLimits: { maxConcurrentAgents: 1, maxConcurrentPerType: 5 },
        logger: () => {},
      });

      const agentA = buildAgent('agent-a');
      const agentB = buildAgent('agent-b');
      registry.register(agentA);
      registry.register(agentB);

      lifecycle.spawn({
        agentId: 'agent-a',
        task: 'Task A',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      expect(() => {
        lifecycle.spawn({
          agentId: 'agent-b',
          task: 'Task B',
          requesterSessionKey: 'agent:main:main',
          requesterDisplayKey: 'main',
        });
      }).toThrow('resource limits exceeded');
    });
  });

  // -------------------------------------------------------------------------
  // Permission inheritance
  // -------------------------------------------------------------------------

  describe('permission inheritance', () => {
    it('inherits permissions from parent agent definition', () => {
      const parent = buildAgent('lead-architect', {
        type: 'session-manager',
        tier: 1 as AgentTier,
        permissionMode: 'acceptEdits',
        canSpawnSubagents: true,
        toolRestrictions: {
          denied: ['mcp__evil_server'],
        },
      });
      const child = buildAgent('eng-code-surgeon', {
        type: 'developer',
        tier: 2 as AgentTier,
        permissionMode: 'ask',
        parentAgentId: 'lead-architect',
      });

      registry.register(parent);
      registry.register(child);

      // Resolve child permissions with parent context
      const parentPerms = registry.resolvePermissions('lead-architect');
      const childPerms = registry.resolvePermissions('eng-code-surgeon', parentPerms);

      // Child should be at least as restrictive as parent
      expect(childPerms.permissionMode).toBe('ask'); // 'ask' is more restrictive than 'acceptEdits'
      expect(childPerms.canSpawnSubagents).toBe(true);
    });

    it('intersects permissions: child cannot exceed parent grants', () => {
      const parent = buildAgent('parent-agent', {
        permissionMode: 'ask',
        canSpawnSubagents: false,
        maxTurns: 20,
      });
      const child = buildAgent('child-agent', {
        permissionMode: 'acceptEdits',
        canSpawnSubagents: true,
        maxTurns: 100,
      });

      registry.register(parent);
      registry.register(child);

      const parentPerms = registry.resolvePermissions('parent-agent');
      const childPerms = registry.resolvePermissions('child-agent', parentPerms);

      // Permission mode: parent 'ask' (1) vs child 'acceptEdits' (2) -> intersection = 'ask'
      expect(childPerms.permissionMode).toBe('ask');

      // canSpawnSubagents: parent false AND child true -> false
      expect(childPerms.canSpawnSubagents).toBe(false);

      // maxTurns: min(100, 20) = 20
      expect(childPerms.maxTurns).toBe(20);
    });

    it('resolves permission chain through hierarchy', () => {
      const grandparent = buildAgent('grandparent', {
        parentAgentId: undefined,
      });
      const parent = buildAgent('parent', {
        parentAgentId: 'grandparent',
      });
      const child = buildAgent('child', {
        parentAgentId: 'parent',
      });

      registry.register(grandparent);
      registry.register(parent);
      registry.register(child);

      const chain = registry.resolvePermissionChain('child');
      expect(chain).toEqual(['grandparent', 'parent', 'child']);
    });

    it('handles circular reference in permission chain', () => {
      const a = buildAgent('agent-a', { parentAgentId: 'agent-b' });
      const b = buildAgent('agent-b', { parentAgentId: 'agent-a' });

      registry.register(a);
      registry.register(b);

      // Should not infinite loop
      const chain = registry.resolvePermissionChain('agent-a');
      expect(chain.length).toBeLessThanOrEqual(2);
    });

    it('prevents sub-agent spawn when parent disallows it', () => {
      const noSpawnParent = buildAgent('no-spawn-parent', {
        canSpawnSubagents: false,
      });
      const child = buildAgent('child-worker');

      registry.register(noSpawnParent);
      registry.register(child);

      // Spawn parent first
      const parentRecord = lifecycle.spawn({
        agentId: 'no-spawn-parent',
        task: 'Parent task',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      // Attempt to spawn child with parent reference
      expect(() => {
        lifecycle.spawn({
          agentId: 'child-worker',
          task: 'Child task',
          requesterSessionKey: 'agent:main:main',
          requesterDisplayKey: 'main',
          parentRunId: parentRecord.runId,
        });
      }).toThrow('not allowed to spawn sub-agents');
    });
  });

  // -------------------------------------------------------------------------
  // Tool restriction resolution
  // -------------------------------------------------------------------------

  describe('tool restriction resolution', () => {
    const allTools = ['read_file', 'write_file', 'bash_execute', 'web_search', 'mcp__db__query'];

    it('returns all tools when no restrictions exist', () => {
      const agent = buildAgent('unrestricted-agent');
      registry.register(agent);

      const effective = registry.resolveEffectiveTools('unrestricted-agent', allTools);
      expect(effective).toEqual(allTools);
    });

    it('applies agent allowed-list restriction', () => {
      const agent = buildAgent('restricted-agent', {
        toolRestrictions: {
          allowed: ['read_file', 'web_search'],
        },
      });
      registry.register(agent);

      const effective = registry.resolveEffectiveTools('restricted-agent', allTools);
      expect(effective).toEqual(['read_file', 'web_search']);
    });

    it('applies agent denied-list restriction', () => {
      const agent = buildAgent('deny-agent', {
        toolRestrictions: {
          denied: ['bash_execute', 'mcp__db__query'],
        },
      });
      registry.register(agent);

      const effective = registry.resolveEffectiveTools('deny-agent', allTools);
      expect(effective).toEqual(['read_file', 'write_file', 'web_search']);
    });

    it('intersects agent allowed-list with parent allowed-list', () => {
      const agent = buildAgent('child-allow', {
        toolRestrictions: {
          allowed: ['read_file', 'write_file', 'bash_execute'],
        },
      });
      registry.register(agent);

      const parentRestrictions: ToolRestrictions = {
        allowed: ['read_file', 'bash_execute', 'web_search'],
      };

      const effective = registry.resolveEffectiveTools(
        'child-allow',
        allTools,
        parentRestrictions,
      );

      // Intersection: read_file, bash_execute
      expect(effective).toEqual(['read_file', 'bash_execute']);
    });

    it('unions denied-lists from agent and parent', () => {
      const agent = buildAgent('deny-union', {
        toolRestrictions: {
          denied: ['bash_execute'],
        },
      });
      registry.register(agent);

      const parentRestrictions: ToolRestrictions = {
        denied: ['mcp__db__query'],
      };

      const effective = registry.resolveEffectiveTools(
        'deny-union',
        allTools,
        parentRestrictions,
      );

      // Both bash_execute and mcp__db__query should be removed
      expect(effective).toEqual(['read_file', 'write_file', 'web_search']);
    });

    it('validates individual tool with isToolAllowed', () => {
      const agent = buildAgent('check-tool', {
        toolRestrictions: {
          denied: ['bash_execute'],
        },
      });
      registry.register(agent);

      expect(registry.isToolAllowed('check-tool', 'read_file')).toBe(true);
      expect(registry.isToolAllowed('check-tool', 'bash_execute')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle: heartbeat, health, completion
  // -------------------------------------------------------------------------

  describe('lifecycle management', () => {
    it('tracks run status through lifecycle stages', () => {
      const agent = buildAgent('lifecycle-agent');
      registry.register(agent);

      const record = lifecycle.spawn({
        agentId: 'lifecycle-agent',
        task: 'Test lifecycle',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      // Running after spawn
      expect(lifecycle.getRunStatus(record.runId)).toBe('running');

      // Complete the run
      lifecycle.markCompleted(record.runId, { status: 'ok' });
      expect(lifecycle.getRunStatus(record.runId)).toBe('completed');
    });

    it('records heartbeats and resets missed count', () => {
      const agent = buildAgent('hb-agent');
      registry.register(agent);

      const record = lifecycle.spawn({
        agentId: 'hb-agent',
        task: 'Heartbeat test',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      lifecycle.recordHeartbeat(record.runId);
      const run = lifecycle.getRun(record.runId);

      expect(run).toBeDefined();
      expect(run!.missedHeartbeats).toBe(0);
    });

    it('reports health statuses for active runs', () => {
      const agent = buildAgent('health-agent');
      registry.register(agent);

      lifecycle.spawn({
        agentId: 'health-agent',
        task: 'Health check test',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      const statuses = lifecycle.getHealthStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].healthy).toBe(true);
      expect(statuses[0].agentId).toBe('health-agent');
    });

    it('persists and restores run records across instances', () => {
      const agent = buildAgent('persist-agent');
      registry.register(agent);

      const record = lifecycle.spawn({
        agentId: 'persist-agent',
        task: 'Persist test',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      // Create a new lifecycle manager reading from the same file
      const lifecycle2 = new AgentLifecycleManager({
        registry,
        persistPath: path.join(tmpDir, 'runs.json'),
        logger: () => {},
      });
      lifecycle2.restore();

      const restored = lifecycle2.getRun(record.runId);
      expect(restored).toBeDefined();
      expect(restored!.agentId).toBe('persist-agent');
      expect(restored!.task).toBe('Persist test');

      lifecycle2.shutdown();
    });

    it('collects output fragments and assembles text', () => {
      const agent = buildAgent('output-agent');
      registry.register(agent);

      const record = lifecycle.spawn({
        agentId: 'output-agent',
        task: 'Output test',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      lifecycle.appendOutput(record.runId, 'Hello ');
      lifecycle.appendOutput(record.runId, 'World', true);

      const text = lifecycle.getOutputText(record.runId);
      expect(text).toBe('Hello World');
    });

    it('tracks resource usage across multiple spawns', () => {
      const agentA = buildAgent('res-a', { type: 'developer' });
      const agentB = buildAgent('res-b', { type: 'researcher' });
      registry.register(agentA);
      registry.register(agentB);

      lifecycle.spawn({
        agentId: 'res-a',
        task: 'Task A',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });
      lifecycle.spawn({
        agentId: 'res-b',
        task: 'Task B',
        requesterSessionKey: 'agent:main:main',
        requesterDisplayKey: 'main',
      });

      const usage = lifecycle.getResourceUsage();
      expect(usage.totalActive).toBe(2);
      expect(usage.activeByType['developer']).toBe(1);
      expect(usage.activeByType['researcher']).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Registry queries
  // -------------------------------------------------------------------------

  describe('registry queries', () => {
    beforeEach(() => {
      registry.register(buildAgent('dev-a', { type: 'developer', tier: 2 as AgentTier, capabilities: ['code', 'review'] }));
      registry.register(buildAgent('dev-b', { type: 'developer', tier: 3 as AgentTier, capabilities: ['code'] }));
      registry.register(buildAgent('res-a', { type: 'researcher', tier: 2 as AgentTier, capabilities: ['research'] }));
    });

    it('finds spawn candidates by type', () => {
      const candidates = registry.findSpawnCandidates('developer');
      expect(candidates).toHaveLength(2);
    });

    it('filters spawn candidates by tier', () => {
      const candidates = registry.findSpawnCandidates('developer', { maxTier: 2 as AgentTier });
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('dev-a');
    });

    it('filters spawn candidates by capabilities', () => {
      const candidates = registry.findSpawnCandidates('developer', {
        requiredCapabilities: ['review'],
      });
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('dev-a');
    });

    it('finds best match with weighted scoring', () => {
      const best = registry.findBestMatch({
        preferredType: 'developer',
        preferredTier: 2 as AgentTier,
        requiredCapabilities: ['code', 'review'],
      });

      expect(best).toBeDefined();
      expect(best!.id).toBe('dev-a');
    });

    it('searches agents by text query', () => {
      // search() matches against name, description, and capabilities.
      // 'research' matches the capability declared on res-a.
      const results = registry.search('research');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('res-a');
    });
  });
});
