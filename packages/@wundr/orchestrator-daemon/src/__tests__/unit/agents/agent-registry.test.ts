/**
 * Tests for the AgentRegistry class (src/agents/agent-registry.ts).
 *
 * Covers:
 *  - Agent registration, retrieval, and unregistration
 *  - Lookup by type, tier, capability, category, priority, model, memory scope
 *  - Stateful agent queries
 *  - findSpawnCandidates with type filtering, tier ceiling, and capability requirements
 *  - resolveEffectiveTools (allowed/denied lists, parent restrictions, intersection)
 *  - isToolAllowed validation
 *  - resolvePermissions (parent-child inheritance, most-restrictive-wins)
 *  - resolvePermissionChain (walking parentAgentId with circular reference protection)
 *  - resolveMaxTurns (definition -> type defaults -> parent constraint)
 *  - resolveMemoryScope (agent config -> parent scope -> 'local')
 *  - Groups and teams (defineGroup, getGroup, getTeamForManager, listGroups, removeGroup)
 *  - Type and tier restriction validation
 *  - Search (text query)
 *  - findBestMatch (scoring)
 *  - getStats summary
 *  - createEmptyRegistry factory
 *  - Edge cases: missing agents, circular parents, empty registries
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  AgentRegistry,
  createEmptyRegistry,
} from '../../../agents/agent-registry';
import { DEFAULT_MAX_TURNS_BY_TYPE } from '../../../agents/agent-types';

import type {
  AgentDefinition,
  AgentPermissions,
  ToolRestrictions,
} from '../../../agents/agent-types';

// =============================================================================
// Mock Agent Definition Factory
// =============================================================================

let idCounter = 0;

function nextId(prefix = 'agent'): string {
  idCounter++;
  return `${prefix}-${idCounter.toString().padStart(3, '0')}`;
}

/**
 * Creates a mock AgentDefinition with sensible defaults.
 * All fields are shallow-merged so callers can override individual pieces.
 */
function createMockAgentDef(
  overrides?: Partial<AgentDefinition> & {
    metadata?: Partial<AgentDefinition['metadata']>;
  }
): AgentDefinition {
  const id = overrides?.id ?? nextId();
  const metadata = {
    name: overrides?.metadata?.name ?? id,
    type: overrides?.metadata?.type ?? 'developer',
    description: overrides?.metadata?.description ?? `Mock agent ${id}`,
    tier: overrides?.metadata?.tier ?? 3,
    capabilities: overrides?.metadata?.capabilities ?? [],
    priority: overrides?.metadata?.priority ?? 'medium',
    model: overrides?.metadata?.model ?? 'sonnet',
    ...overrides?.metadata,
  } as AgentDefinition['metadata'];

  return {
    id,
    metadata,
    systemPrompt: overrides?.systemPrompt ?? `System prompt for ${id}`,
    sourcePath: overrides?.sourcePath ?? `core/${id}.md`,
    category: overrides?.category ?? 'core',
    mtime: overrides?.mtime ?? Date.now(),
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    idCounter = 0;
    registry = new AgentRegistry({ logger: () => {} });
  });

  // ===========================================================================
  // Registration & Basic Retrieval
  // ===========================================================================

  describe('register / get / listAll / size', () => {
    it('should register and retrieve an agent by ID', () => {
      const def = createMockAgentDef({ id: 'coder' });
      registry.register(def);

      const result = registry.get('coder');
      expect(result).toBeDefined();
      expect(result!.id).toBe('coder');
      expect(result!.metadata.name).toBe('coder');
    });

    it('should normalize agent ID to lowercase on get', () => {
      const def = createMockAgentDef({ id: 'coder' });
      registry.register(def);

      expect(registry.get('Coder')).toBeDefined();
      expect(registry.get('CODER')).toBeDefined();
      expect(registry.get('  coder  ')).toBeDefined();
    });

    it('should return undefined for unregistered agent', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should replace an existing definition on re-register', () => {
      const v1 = createMockAgentDef({
        id: 'coder',
        metadata: { name: 'Coder v1' },
      });
      const v2 = createMockAgentDef({
        id: 'coder',
        metadata: { name: 'Coder v2' },
      });

      registry.register(v1);
      registry.register(v2);

      expect(registry.size).toBe(1);
      expect(registry.get('coder')!.metadata.name).toBe('Coder v2');
    });

    it('should return all registered definitions via listAll', () => {
      registry.register(createMockAgentDef({ id: 'a' }));
      registry.register(createMockAgentDef({ id: 'b' }));
      registry.register(createMockAgentDef({ id: 'c' }));

      const all = registry.listAll();
      expect(all).toHaveLength(3);
      expect(all.map(d => d.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('should report correct size', () => {
      expect(registry.size).toBe(0);

      registry.register(createMockAgentDef({ id: 'x' }));
      expect(registry.size).toBe(1);

      registry.register(createMockAgentDef({ id: 'y' }));
      expect(registry.size).toBe(2);
    });
  });

  // ===========================================================================
  // Unregister
  // ===========================================================================

  describe('unregister', () => {
    it('should remove a registered agent and return true', () => {
      registry.register(createMockAgentDef({ id: 'temp' }));
      expect(registry.unregister('temp')).toBe(true);
      expect(registry.get('temp')).toBeUndefined();
      expect(registry.size).toBe(0);
    });

    it('should return false when unregistering a non-existent agent', () => {
      expect(registry.unregister('ghost')).toBe(false);
    });
  });

  // ===========================================================================
  // Lookup By Type / Tier / Capability / Category / Priority / Model
  // ===========================================================================

  describe('getByType', () => {
    it('should return agents matching the requested type', () => {
      registry.register(
        createMockAgentDef({
          id: 'dev1',
          metadata: { name: 'dev1', type: 'developer' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'dev2',
          metadata: { name: 'dev2', type: 'developer' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'rev1',
          metadata: { name: 'rev1', type: 'reviewer' },
        })
      );

      const devs = registry.getByType('developer');
      expect(devs).toHaveLength(2);
      expect(devs.every(d => d.metadata.type === 'developer')).toBe(true);
    });

    it('should return empty array for unmatched type', () => {
      registry.register(
        createMockAgentDef({
          id: 'dev',
          metadata: { name: 'dev', type: 'developer' },
        })
      );
      expect(registry.getByType('planner')).toEqual([]);
    });
  });

  describe('getByTier', () => {
    it('should return agents at the specified tier', () => {
      registry.register(
        createMockAgentDef({ id: 't0', metadata: { name: 't0', tier: 0 } })
      );
      registry.register(
        createMockAgentDef({ id: 't1', metadata: { name: 't1', tier: 1 } })
      );
      registry.register(
        createMockAgentDef({ id: 't3', metadata: { name: 't3', tier: 3 } })
      );

      expect(registry.getByTier(0)).toHaveLength(1);
      expect(registry.getByTier(0)[0].id).toBe('t0');
      expect(registry.getByTier(2)).toEqual([]);
    });
  });

  describe('getByCapability', () => {
    it('should match capabilities case-insensitively', () => {
      registry.register(
        createMockAgentDef({
          id: 'cap-agent',
          metadata: {
            name: 'cap-agent',
            capabilities: ['TypeScript', 'Testing'],
          },
        })
      );

      expect(registry.getByCapability('typescript')).toHaveLength(1);
      expect(registry.getByCapability('TESTING')).toHaveLength(1);
      expect(registry.getByCapability('  TypeScript  ')).toHaveLength(1);
    });

    it('should return empty for non-existent capability', () => {
      registry.register(
        createMockAgentDef({
          id: 'cap-agent',
          metadata: { name: 'cap-agent', capabilities: ['Python'] },
        })
      );

      expect(registry.getByCapability('rust')).toEqual([]);
    });

    it('should handle agents with undefined capabilities', () => {
      registry.register(
        createMockAgentDef({
          id: 'no-caps',
          metadata: { name: 'no-caps', capabilities: undefined },
        })
      );

      expect(registry.getByCapability('anything')).toEqual([]);
    });
  });

  describe('getByCategory', () => {
    it('should return agents in the specified category', () => {
      registry.register(createMockAgentDef({ id: 'a', category: 'core' }));
      registry.register(createMockAgentDef({ id: 'b', category: 'swarm' }));
      registry.register(createMockAgentDef({ id: 'c', category: 'Core' }));

      const coreAgents = registry.getByCategory('core');
      expect(coreAgents).toHaveLength(2);
    });
  });

  describe('getByPriority', () => {
    it('should return agents with the specified priority', () => {
      registry.register(
        createMockAgentDef({
          id: 'hi',
          metadata: { name: 'hi', priority: 'high' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'lo',
          metadata: { name: 'lo', priority: 'low' },
        })
      );

      expect(registry.getByPriority('high')).toHaveLength(1);
      expect(registry.getByPriority('high')[0].id).toBe('hi');
    });
  });

  describe('getByModel', () => {
    it('should return agents using the specified model', () => {
      registry.register(
        createMockAgentDef({
          id: 'op',
          metadata: { name: 'op', model: 'opus' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'sn',
          metadata: { name: 'sn', model: 'sonnet' },
        })
      );

      expect(registry.getByModel('opus')).toHaveLength(1);
      expect(registry.getByModel('opus')[0].id).toBe('op');
    });
  });

  describe('getByMemoryScope', () => {
    it('should return agents with the specified memory scope', () => {
      registry.register(
        createMockAgentDef({
          id: 'global-agent',
          metadata: { name: 'global-agent', memoryScope: 'global' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'local-agent',
          metadata: { name: 'local-agent', memoryScope: 'local' },
        })
      );

      expect(registry.getByMemoryScope('global')).toHaveLength(1);
      expect(registry.getByMemoryScope('global')[0].id).toBe('global-agent');
    });

    it('should return empty array when no agents match the scope', () => {
      registry.register(
        createMockAgentDef({
          id: 'local-only',
          metadata: { name: 'local-only', memoryScope: 'local' },
        })
      );

      expect(registry.getByMemoryScope('user')).toEqual([]);
    });
  });

  describe('getStateful', () => {
    it('should return only agents with persistState === true', () => {
      registry.register(
        createMockAgentDef({
          id: 'stateful',
          metadata: { name: 'stateful', persistState: true },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'ephemeral',
          metadata: { name: 'ephemeral', persistState: false },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'unset',
          metadata: { name: 'unset' },
        })
      );

      const stateful = registry.getStateful();
      expect(stateful).toHaveLength(1);
      expect(stateful[0].id).toBe('stateful');
    });

    it('should return empty array when no stateful agents exist', () => {
      registry.register(createMockAgentDef({ id: 'eph' }));
      expect(registry.getStateful()).toEqual([]);
    });
  });

  // ===========================================================================
  // findSpawnCandidates
  // ===========================================================================

  describe('findSpawnCandidates', () => {
    beforeEach(() => {
      registry.register(
        createMockAgentDef({
          id: 'dev-senior',
          metadata: {
            name: 'dev-senior',
            type: 'developer',
            tier: 2,
            capabilities: ['typescript', 'testing'],
          },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'dev-junior',
          metadata: {
            name: 'dev-junior',
            type: 'developer',
            tier: 3,
            capabilities: ['typescript'],
          },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'reviewer-1',
          metadata: {
            name: 'reviewer-1',
            type: 'reviewer',
            tier: 2,
            capabilities: ['code-review'],
          },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'dev-no-tier',
          metadata: {
            name: 'dev-no-tier',
            type: 'developer',
            tier: undefined,
            capabilities: ['python'],
          },
        })
      );
    });

    it('should return all agents of the required type', () => {
      const candidates = registry.findSpawnCandidates('developer');
      expect(candidates).toHaveLength(3);
      expect(candidates.every(c => c.metadata.type === 'developer')).toBe(true);
    });

    it('should filter by tier ceiling', () => {
      const candidates = registry.findSpawnCandidates('developer', {
        maxTier: 2,
      });
      // dev-senior (tier 2) passes, dev-junior (tier 3) fails, dev-no-tier (undefined) passes
      expect(candidates).toHaveLength(2);
      expect(candidates.map(c => c.id).sort()).toEqual([
        'dev-no-tier',
        'dev-senior',
      ]);
    });

    it('should filter by required capabilities', () => {
      const candidates = registry.findSpawnCandidates('developer', {
        requiredCapabilities: ['typescript'],
      });
      // dev-senior and dev-junior have 'typescript'
      expect(candidates).toHaveLength(2);
      expect(candidates.map(c => c.id).sort()).toEqual([
        'dev-junior',
        'dev-senior',
      ]);
    });

    it('should filter by both tier ceiling and required capabilities', () => {
      const candidates = registry.findSpawnCandidates('developer', {
        maxTier: 2,
        requiredCapabilities: ['typescript'],
      });
      // Only dev-senior (tier 2 and has typescript)
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('dev-senior');
    });

    it('should match capabilities case-insensitively', () => {
      const candidates = registry.findSpawnCandidates('developer', {
        requiredCapabilities: ['TypeScript'],
      });
      expect(candidates).toHaveLength(2);
    });

    it('should return empty when no type matches', () => {
      expect(registry.findSpawnCandidates('planner')).toEqual([]);
    });

    it('should require all listed capabilities', () => {
      const candidates = registry.findSpawnCandidates('developer', {
        requiredCapabilities: ['typescript', 'testing'],
      });
      // Only dev-senior has both
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe('dev-senior');
    });
  });

  // ===========================================================================
  // resolveEffectiveTools
  // ===========================================================================

  describe('resolveEffectiveTools', () => {
    const allTools = ['read', 'write', 'execute', 'search', 'delete'];

    it('should return all available tools when agent has no restrictions', () => {
      registry.register(createMockAgentDef({ id: 'no-restrict' }));

      const tools = registry.resolveEffectiveTools('no-restrict', allTools);
      expect(tools).toEqual(allTools);
    });

    it('should respect an allowed list', () => {
      registry.register(
        createMockAgentDef({
          id: 'allow-only',
          metadata: {
            name: 'allow-only',
            toolRestrictions: { allowed: ['read', 'search'] },
          },
        })
      );

      const tools = registry.resolveEffectiveTools('allow-only', allTools);
      expect(tools).toEqual(['read', 'search']);
    });

    it('should respect a denied list', () => {
      registry.register(
        createMockAgentDef({
          id: 'deny-some',
          metadata: {
            name: 'deny-some',
            toolRestrictions: { denied: ['delete', 'execute'] },
          },
        })
      );

      const tools = registry.resolveEffectiveTools('deny-some', allTools);
      expect(tools).toEqual(['read', 'write', 'search']);
    });

    it('should apply case-insensitive matching for allowed list', () => {
      registry.register(
        createMockAgentDef({
          id: 'case-agent',
          metadata: {
            name: 'case-agent',
            toolRestrictions: { allowed: ['READ', '  Search  '] },
          },
        })
      );

      const tools = registry.resolveEffectiveTools('case-agent', allTools);
      expect(tools).toEqual(['read', 'search']);
    });

    it('should intersect agent allowed list with parent allowed list', () => {
      registry.register(
        createMockAgentDef({
          id: 'child',
          metadata: {
            name: 'child',
            toolRestrictions: { allowed: ['read', 'write', 'search'] },
          },
        })
      );

      const parentRestrictions: ToolRestrictions = {
        allowed: ['read', 'execute'],
      };

      const tools = registry.resolveEffectiveTools(
        'child',
        allTools,
        parentRestrictions
      );
      // Agent allows [read, write, search], parent allows [read, execute]
      // Intersection: [read]
      expect(tools).toEqual(['read']);
    });

    it('should merge agent denied list with parent denied list', () => {
      registry.register(
        createMockAgentDef({
          id: 'child-deny',
          metadata: {
            name: 'child-deny',
            toolRestrictions: { denied: ['delete'] },
          },
        })
      );

      const parentRestrictions: ToolRestrictions = { denied: ['execute'] };

      const tools = registry.resolveEffectiveTools(
        'child-deny',
        allTools,
        parentRestrictions
      );
      // Union of denied: [delete, execute]
      expect(tools).toEqual(['read', 'write', 'search']);
    });

    it('should fall back to parent restrictions when agent has no restrictions', () => {
      registry.register(createMockAgentDef({ id: 'no-own' }));

      const parentRestrictions: ToolRestrictions = {
        allowed: ['read', 'search'],
      };

      const tools = registry.resolveEffectiveTools(
        'no-own',
        allTools,
        parentRestrictions
      );
      expect(tools).toEqual(['read', 'search']);
    });

    it('should return all tools for unknown agent with no parent restrictions', () => {
      const tools = registry.resolveEffectiveTools('ghost', allTools);
      expect(tools).toEqual(allTools);
    });

    it('should apply parent restrictions for unknown agent', () => {
      const tools = registry.resolveEffectiveTools('ghost', allTools, {
        denied: ['delete'],
      });
      expect(tools).toEqual(['read', 'write', 'execute', 'search']);
    });
  });

  // ===========================================================================
  // isToolAllowed
  // ===========================================================================

  describe('isToolAllowed', () => {
    it('should return true when tool is in the allowed list', () => {
      registry.register(
        createMockAgentDef({
          id: 'allow-agent',
          metadata: {
            name: 'allow-agent',
            toolRestrictions: { allowed: ['read', 'write'] },
          },
        })
      );

      expect(registry.isToolAllowed('allow-agent', 'read')).toBe(true);
      expect(registry.isToolAllowed('allow-agent', 'write')).toBe(true);
    });

    it('should return false when tool is NOT in the allowed list', () => {
      registry.register(
        createMockAgentDef({
          id: 'allow-agent',
          metadata: {
            name: 'allow-agent',
            toolRestrictions: { allowed: ['read'] },
          },
        })
      );

      expect(registry.isToolAllowed('allow-agent', 'delete')).toBe(false);
    });

    it('should return false when tool is in the denied list', () => {
      registry.register(
        createMockAgentDef({
          id: 'deny-agent',
          metadata: {
            name: 'deny-agent',
            toolRestrictions: { denied: ['delete'] },
          },
        })
      );

      expect(registry.isToolAllowed('deny-agent', 'delete')).toBe(false);
    });

    it('should return true for unrestricted agent', () => {
      registry.register(createMockAgentDef({ id: 'free-agent' }));

      expect(registry.isToolAllowed('free-agent', 'anything')).toBe(true);
    });

    it('should respect parent restrictions', () => {
      registry.register(createMockAgentDef({ id: 'child' }));

      const parentRestrictions: ToolRestrictions = { denied: ['execute'] };

      expect(registry.isToolAllowed('child', 'read', parentRestrictions)).toBe(
        true
      );
      expect(
        registry.isToolAllowed('child', 'execute', parentRestrictions)
      ).toBe(false);
    });
  });

  // ===========================================================================
  // resolvePermissions
  // ===========================================================================

  describe('resolvePermissions', () => {
    it('should return default permissions for unknown agent', () => {
      const perms = registry.resolvePermissions('unknown');

      expect(perms.permissionMode).toBe('ask');
      expect(perms.maxTurns).toBe(30);
      expect(perms.canSpawnSubagents).toBe(false);
      expect(perms.memoryScopes).toEqual(['local']);
      expect(perms.maxTier).toBe(3);
    });

    it('should build self-permissions from agent metadata', () => {
      registry.register(
        createMockAgentDef({
          id: 'custom-agent',
          metadata: {
            name: 'custom-agent',
            type: 'developer',
            permissionMode: 'acceptEdits',
            maxTurns: 100,
            canSpawnSubagents: true,
            tier: 1,
            memoryScope: 'project',
          },
        })
      );

      const perms = registry.resolvePermissions('custom-agent');

      expect(perms.permissionMode).toBe('acceptEdits');
      expect(perms.maxTurns).toBe(100);
      expect(perms.canSpawnSubagents).toBe(true);
      expect(perms.maxTier).toBe(1);
      // 'project' scope implies [project, local]
      expect(perms.memoryScopes).toEqual(['project', 'local']);
    });

    it('should fall back to DEFAULT_MAX_TURNS_BY_TYPE when maxTurns is not set', () => {
      registry.register(
        createMockAgentDef({
          id: 'tester-agent',
          metadata: { name: 'tester-agent', type: 'tester' },
        })
      );

      const perms = registry.resolvePermissions('tester-agent');
      expect(perms.maxTurns).toBe(DEFAULT_MAX_TURNS_BY_TYPE['tester']); // 40
    });

    it('should intersect with parent permissions (most restrictive wins)', () => {
      registry.register(
        createMockAgentDef({
          id: 'child-agent',
          metadata: {
            name: 'child-agent',
            type: 'developer',
            permissionMode: 'acceptEdits',
            maxTurns: 100,
            canSpawnSubagents: true,
            tier: 2,
            memoryScope: 'global',
          },
        })
      );

      const parentPermissions: AgentPermissions = {
        permissionMode: 'ask',
        maxTurns: 50,
        maxTimeoutMs: 1_800_000,
        canSpawnSubagents: false,
        memoryScopes: ['project', 'local'],
        maxTier: 1 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions(
        'child-agent',
        parentPermissions
      );

      // 'ask' is more restrictive than 'acceptEdits'
      expect(perms.permissionMode).toBe('ask');
      // min(100, 50) = 50
      expect(perms.maxTurns).toBe(50);
      // min(3_600_000, 1_800_000) = 1_800_000
      expect(perms.maxTimeoutMs).toBe(1_800_000);
      // false && true = false
      expect(perms.canSpawnSubagents).toBe(false);
      // Intersection of [global, user, project, local] and [project, local] = [project, local]
      expect(perms.memoryScopes).toEqual(['project', 'local']);
      // min(2, 1) = 1
      expect(perms.maxTier).toBe(1);
    });

    it('should resolve permission mode to deny when child is deny', () => {
      registry.register(
        createMockAgentDef({
          id: 'deny-child',
          metadata: { name: 'deny-child', permissionMode: 'deny' },
        })
      );

      const parentPermissions: AgentPermissions = {
        permissionMode: 'acceptEdits',
        maxTurns: 50,
        maxTimeoutMs: 3_600_000,
        canSpawnSubagents: true,
        memoryScopes: ['local'],
        maxTier: 3 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions(
        'deny-child',
        parentPermissions
      );
      expect(perms.permissionMode).toBe('deny');
    });

    it('should fall back memoryScopes to [local] when intersection is empty', () => {
      registry.register(
        createMockAgentDef({
          id: 'scope-child',
          metadata: { name: 'scope-child', memoryScope: 'global' },
        })
      );

      // Parent only allows 'local' -- intersection of [global, user, project, local] and ['user'] is ['user']
      // Actually let's make it truly empty: child is 'local' only, parent is 'global' only
      registry.register(
        createMockAgentDef({
          id: 'mismatch-child',
          metadata: { name: 'mismatch-child', memoryScope: 'local' },
        })
      );

      const parentPermissions: AgentPermissions = {
        permissionMode: 'ask',
        maxTurns: 50,
        maxTimeoutMs: 3_600_000,
        canSpawnSubagents: true,
        memoryScopes: ['global'],
        maxTier: 3 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions(
        'mismatch-child',
        parentPermissions
      );
      // Child memoryScopes: ['local'], parent memoryScopes: ['global'] -> intersection is empty -> ['local']
      expect(perms.memoryScopes).toEqual(['local']);
    });
  });

  // ===========================================================================
  // resolvePermissionChain
  // ===========================================================================

  describe('resolvePermissionChain', () => {
    it('should return single-element chain for agent with no parent', () => {
      registry.register(createMockAgentDef({ id: 'root-agent' }));

      const chain = registry.resolvePermissionChain('root-agent');
      expect(chain).toEqual(['root-agent']);
    });

    it('should walk the parentAgentId chain from root to leaf', () => {
      registry.register(
        createMockAgentDef({
          id: 'grandparent',
          metadata: { name: 'grandparent' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'parent',
          metadata: { name: 'parent', parentAgentId: 'grandparent' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'child',
          metadata: { name: 'child', parentAgentId: 'parent' },
        })
      );

      const chain = registry.resolvePermissionChain('child');
      expect(chain).toEqual(['grandparent', 'parent', 'child']);
    });

    it('should protect against circular references', () => {
      registry.register(
        createMockAgentDef({
          id: 'alpha',
          metadata: { name: 'alpha', parentAgentId: 'beta' },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'beta',
          metadata: { name: 'beta', parentAgentId: 'alpha' },
        })
      );

      const chain = registry.resolvePermissionChain('alpha');
      // Should stop when it sees alpha again
      expect(chain).toEqual(['beta', 'alpha']);
      expect(chain).toHaveLength(2);
    });

    it('should protect against self-referencing parent', () => {
      registry.register(
        createMockAgentDef({
          id: 'narcissist',
          metadata: { name: 'narcissist', parentAgentId: 'narcissist' },
        })
      );

      const chain = registry.resolvePermissionChain('narcissist');
      expect(chain).toEqual(['narcissist']);
    });

    it('should handle missing parent gracefully (stop walking)', () => {
      registry.register(
        createMockAgentDef({
          id: 'orphan',
          metadata: { name: 'orphan', parentAgentId: 'missing-parent' },
        })
      );

      const chain = registry.resolvePermissionChain('orphan');
      // walks orphan -> missing-parent (not found, so stops)
      expect(chain).toEqual(['missing-parent', 'orphan']);
    });

    it('should return chain for unregistered starting agent', () => {
      const chain = registry.resolvePermissionChain('ghost');
      // ghost is not registered, so get('ghost') is undefined, parentAgentId is undefined -> stops
      expect(chain).toEqual(['ghost']);
    });
  });

  // ===========================================================================
  // resolveMaxTurns
  // ===========================================================================

  describe('resolveMaxTurns', () => {
    it('should return the explicit maxTurns from agent definition', () => {
      registry.register(
        createMockAgentDef({
          id: 'explicit',
          metadata: { name: 'explicit', maxTurns: 75 },
        })
      );

      expect(registry.resolveMaxTurns('explicit')).toBe(75);
    });

    it('should fall back to DEFAULT_MAX_TURNS_BY_TYPE when maxTurns is not set', () => {
      registry.register(
        createMockAgentDef({
          id: 'typed',
          metadata: { name: 'typed', type: 'researcher' },
        })
      );

      expect(registry.resolveMaxTurns('typed')).toBe(
        DEFAULT_MAX_TURNS_BY_TYPE['researcher']
      ); // 30
    });

    it('should fall back to 30 when no type and no maxTurns', () => {
      registry.register(
        createMockAgentDef({
          id: 'vanilla',
          metadata: { name: 'vanilla', type: undefined, maxTurns: undefined },
        })
      );

      expect(registry.resolveMaxTurns('vanilla')).toBe(30);
    });

    it('should return min of agent maxTurns and parent maxTurns', () => {
      registry.register(
        createMockAgentDef({
          id: 'constrained',
          metadata: { name: 'constrained', maxTurns: 100 },
        })
      );

      expect(registry.resolveMaxTurns('constrained', 50)).toBe(50);
    });

    it('should use agent maxTurns when parent allows more', () => {
      registry.register(
        createMockAgentDef({
          id: 'modest',
          metadata: { name: 'modest', maxTurns: 20 },
        })
      );

      expect(registry.resolveMaxTurns('modest', 100)).toBe(20);
    });

    it('should return parentMaxTurns for unknown agent when provided', () => {
      expect(registry.resolveMaxTurns('unknown', 42)).toBe(42);
    });

    it('should return 30 for unknown agent with no parentMaxTurns', () => {
      expect(registry.resolveMaxTurns('unknown')).toBe(30);
    });
  });

  // ===========================================================================
  // resolveMemoryScope
  // ===========================================================================

  describe('resolveMemoryScope', () => {
    it('should return agent memoryScope when set', () => {
      registry.register(
        createMockAgentDef({
          id: 'global-mem',
          metadata: { name: 'global-mem', memoryScope: 'global' },
        })
      );

      expect(registry.resolveMemoryScope('global-mem')).toBe('global');
    });

    it('should fall back to parentScope when agent has no memoryScope', () => {
      registry.register(
        createMockAgentDef({
          id: 'inherit-mem',
          metadata: { name: 'inherit-mem', memoryScope: undefined },
        })
      );

      expect(registry.resolveMemoryScope('inherit-mem', 'project')).toBe(
        'project'
      );
    });

    it('should fall back to local when neither agent nor parent has a scope', () => {
      registry.register(
        createMockAgentDef({
          id: 'default-mem',
          metadata: { name: 'default-mem', memoryScope: undefined },
        })
      );

      expect(registry.resolveMemoryScope('default-mem')).toBe('local');
    });

    it('should return parentScope for unknown agent when provided', () => {
      expect(registry.resolveMemoryScope('ghost', 'user')).toBe('user');
    });

    it('should return local for unknown agent with no parentScope', () => {
      expect(registry.resolveMemoryScope('ghost')).toBe('local');
    });

    it('should prioritize agent scope over parent scope', () => {
      registry.register(
        createMockAgentDef({
          id: 'override',
          metadata: { name: 'override', memoryScope: 'project' },
        })
      );

      expect(registry.resolveMemoryScope('override', 'global')).toBe('project');
    });
  });

  // ===========================================================================
  // Groups & Teams
  // ===========================================================================

  describe('groups and teams', () => {
    it('should define and retrieve a group', () => {
      registry.register(createMockAgentDef({ id: 'a' }));
      registry.register(createMockAgentDef({ id: 'b' }));

      registry.defineGroup('team-alpha', ['a', 'b'], 'Alpha team');

      const group = registry.getGroup('team-alpha');
      expect(group).toHaveLength(2);
      expect(group.map(d => d.id).sort()).toEqual(['a', 'b']);
    });

    it('should return empty array for unknown group', () => {
      expect(registry.getGroup('nonexistent')).toEqual([]);
    });

    it('should skip missing agents in group', () => {
      registry.register(createMockAgentDef({ id: 'a' }));

      registry.defineGroup('mixed', ['a', 'missing']);

      const group = registry.getGroup('mixed');
      expect(group).toHaveLength(1);
      expect(group[0].id).toBe('a');
    });

    it('should list all groups', () => {
      registry.defineGroup('g1', ['a']);
      registry.defineGroup('g2', ['b']);

      const groups = registry.listGroups();
      expect(groups).toHaveLength(2);
      expect(groups.map(g => g.groupId).sort()).toEqual(['g1', 'g2']);
    });

    it('should remove a group', () => {
      registry.defineGroup('temp-group', ['a']);

      expect(registry.removeGroup('temp-group')).toBe(true);
      expect(registry.listGroups()).toHaveLength(0);
    });

    it('should return false when removing non-existent group', () => {
      expect(registry.removeGroup('fake')).toBe(false);
    });

    it('should get team for a session manager using keySubAgents', () => {
      registry.register(
        createMockAgentDef({
          id: 'manager',
          metadata: {
            name: 'manager',
            type: 'session-manager',
            keySubAgents: ['worker-a', 'worker-b'],
          },
        })
      );
      registry.register(createMockAgentDef({ id: 'worker-a' }));
      registry.register(createMockAgentDef({ id: 'worker-b' }));

      const team = registry.getTeamForManager('manager');
      expect(team).toHaveLength(2);
      expect(team.map(d => d.id).sort()).toEqual(['worker-a', 'worker-b']);
    });

    it('should return empty team for unknown manager', () => {
      expect(registry.getTeamForManager('unknown')).toEqual([]);
    });

    it('should return empty team for manager without keySubAgents', () => {
      registry.register(
        createMockAgentDef({
          id: 'lonely-manager',
          metadata: { name: 'lonely-manager', type: 'session-manager' },
        })
      );

      expect(registry.getTeamForManager('lonely-manager')).toEqual([]);
    });
  });

  // ===========================================================================
  // Type / Tier Restriction Validation
  // ===========================================================================

  describe('validateTypeRestriction', () => {
    it('should return true when agent type matches', () => {
      registry.register(
        createMockAgentDef({
          id: 'dev',
          metadata: { name: 'dev', type: 'developer' },
        })
      );

      expect(registry.validateTypeRestriction('dev', 'developer')).toBe(true);
    });

    it('should return false when agent type does not match', () => {
      registry.register(
        createMockAgentDef({
          id: 'dev',
          metadata: { name: 'dev', type: 'developer' },
        })
      );

      expect(registry.validateTypeRestriction('dev', 'reviewer')).toBe(false);
    });

    it('should return false for unknown agent', () => {
      expect(registry.validateTypeRestriction('ghost', 'developer')).toBe(
        false
      );
    });
  });

  describe('validateTierRestriction', () => {
    it('should return true when agent tier is at or below maxTier', () => {
      registry.register(
        createMockAgentDef({
          id: 'low-tier',
          metadata: { name: 'low-tier', tier: 1 },
        })
      );

      expect(registry.validateTierRestriction('low-tier', 2)).toBe(true);
      expect(registry.validateTierRestriction('low-tier', 1)).toBe(true);
    });

    it('should return false when agent tier exceeds maxTier', () => {
      registry.register(
        createMockAgentDef({
          id: 'high-tier',
          metadata: { name: 'high-tier', tier: 3 },
        })
      );

      expect(registry.validateTierRestriction('high-tier', 2)).toBe(false);
    });

    it('should return false for agent with undefined tier', () => {
      registry.register(
        createMockAgentDef({
          id: 'no-tier',
          metadata: { name: 'no-tier', tier: undefined },
        })
      );

      expect(registry.validateTierRestriction('no-tier', 3)).toBe(false);
    });

    it('should return false for unknown agent', () => {
      expect(registry.validateTierRestriction('ghost', 3)).toBe(false);
    });
  });

  // ===========================================================================
  // Search
  // ===========================================================================

  describe('search', () => {
    beforeEach(() => {
      registry.register(
        createMockAgentDef({
          id: 'code-reviewer',
          metadata: {
            name: 'Code Reviewer',
            description: 'Reviews pull requests for quality',
            capabilities: ['code-review', 'security-audit'],
          },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'test-writer',
          metadata: {
            name: 'Test Writer',
            description: 'Creates comprehensive test suites',
            capabilities: ['testing', 'typescript'],
          },
        })
      );
    });

    it('should match against agent name', () => {
      const results = registry.search('Code');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('code-reviewer');
    });

    it('should match against description', () => {
      const results = registry.search('pull requests');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('code-reviewer');
    });

    it('should match against capabilities', () => {
      const results = registry.search('typescript');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-writer');
    });

    it('should be case-insensitive', () => {
      const results = registry.search('TEST WRITER');
      expect(results).toHaveLength(1);
    });

    it('should return empty for blank query', () => {
      expect(registry.search('')).toEqual([]);
      expect(registry.search('   ')).toEqual([]);
    });

    it('should return empty for non-matching query', () => {
      expect(registry.search('nonexistent-capability')).toEqual([]);
    });
  });

  // ===========================================================================
  // findBestMatch
  // ===========================================================================

  describe('findBestMatch', () => {
    beforeEach(() => {
      registry.register(
        createMockAgentDef({
          id: 'ts-dev',
          metadata: {
            name: 'ts-dev',
            type: 'developer',
            tier: 2,
            model: 'opus',
            capabilities: ['typescript', 'testing'],
            priority: 'high',
          },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'py-dev',
          metadata: {
            name: 'py-dev',
            type: 'developer',
            tier: 3,
            model: 'sonnet',
            capabilities: ['python', 'testing'],
            priority: 'medium',
          },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'rev',
          metadata: {
            name: 'rev',
            type: 'reviewer',
            tier: 2,
            model: 'opus',
            capabilities: ['code-review'],
            priority: 'high',
          },
        })
      );
    });

    it('should find best match by capability', () => {
      const best = registry.findBestMatch({
        requiredCapabilities: ['typescript'],
      });
      expect(best).toBeDefined();
      expect(best!.id).toBe('ts-dev');
    });

    it('should boost score for matching type preference', () => {
      const best = registry.findBestMatch({
        requiredCapabilities: ['testing'],
        preferredType: 'developer',
      });
      // Both ts-dev and py-dev have 'testing' and are 'developer', but
      // ts-dev has 'high' priority giving it a higher score
      expect(best).toBeDefined();
      expect(best!.metadata.type).toBe('developer');
    });

    it('should return undefined when no capabilities match', () => {
      const best = registry.findBestMatch({
        requiredCapabilities: ['rust', 'wasm'],
      });
      expect(best).toBeUndefined();
    });

    it('should return undefined from empty registry', () => {
      const empty = new AgentRegistry({ logger: () => {} });
      expect(
        empty.findBestMatch({ requiredCapabilities: ['anything'] })
      ).toBeUndefined();
    });

    it('should handle requirements with no capabilities', () => {
      const best = registry.findBestMatch({
        preferredType: 'reviewer',
        preferredModel: 'opus',
      });
      expect(best).toBeDefined();
      expect(best!.id).toBe('rev');
    });
  });

  // ===========================================================================
  // getStats
  // ===========================================================================

  describe('getStats', () => {
    it('should return correct summary statistics', () => {
      registry.register(
        createMockAgentDef({
          id: 'dev1',
          category: 'core',
          metadata: { name: 'dev1', type: 'developer', tier: 2 },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'dev2',
          category: 'core',
          metadata: { name: 'dev2', type: 'developer', tier: 3 },
        })
      );
      registry.register(
        createMockAgentDef({
          id: 'rev1',
          category: 'review',
          metadata: { name: 'rev1', type: 'reviewer', tier: 2 },
        })
      );

      registry.defineGroup('g1', ['dev1', 'dev2']);

      const stats = registry.getStats();

      expect(stats.totalDefinitions).toBe(3);
      expect(stats.byType).toEqual({ developer: 2, reviewer: 1 });
      expect(stats.byTier).toEqual({ 2: 2, 3: 1 });
      expect(stats.byCategory).toEqual({ core: 2, review: 1 });
      expect(stats.totalGroups).toBe(1);
    });

    it('should return zeros for empty registry', () => {
      const stats = registry.getStats();

      expect(stats.totalDefinitions).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byTier).toEqual({});
      expect(stats.byCategory).toEqual({});
      expect(stats.totalGroups).toBe(0);
    });

    it('should classify agents with no type as unspecified', () => {
      registry.register(
        createMockAgentDef({
          id: 'untyped',
          metadata: { name: 'untyped', type: undefined },
        })
      );

      const stats = registry.getStats();
      expect(stats.byType).toEqual({ unspecified: 1 });
    });
  });

  // ===========================================================================
  // Factory Functions
  // ===========================================================================

  describe('createEmptyRegistry', () => {
    it('should create an empty registry with no loader', () => {
      const empty = createEmptyRegistry();

      expect(empty.size).toBe(0);
      expect(empty.listAll()).toEqual([]);
    });

    it('should allow manual registration on empty registry', () => {
      const empty = createEmptyRegistry();
      empty.register(createMockAgentDef({ id: 'manual' }));

      expect(empty.size).toBe(1);
      expect(empty.get('manual')).toBeDefined();
    });

    it('should throw when loadFromDirectory is called on empty registry', async () => {
      const empty = createEmptyRegistry();

      await expect(empty.loadFromDirectory()).rejects.toThrow(
        /no loader configured/i
      );
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty available tools array in resolveEffectiveTools', () => {
      registry.register(
        createMockAgentDef({
          id: 'agent',
          metadata: { name: 'agent', toolRestrictions: { allowed: ['read'] } },
        })
      );

      const tools = registry.resolveEffectiveTools('agent', []);
      expect(tools).toEqual([]);
    });

    it('should handle permission resolution with all scope levels', () => {
      // Agent with 'user' scope gets [user, project, local]
      registry.register(
        createMockAgentDef({
          id: 'user-scope',
          metadata: { name: 'user-scope', memoryScope: 'user' },
        })
      );

      const perms = registry.resolvePermissions('user-scope');
      expect(perms.memoryScopes).toEqual(['user', 'project', 'local']);
    });

    it('should handle permission resolution with global scope', () => {
      registry.register(
        createMockAgentDef({
          id: 'global-scope',
          metadata: { name: 'global-scope', memoryScope: 'global' },
        })
      );

      const perms = registry.resolvePermissions('global-scope');
      expect(perms.memoryScopes).toEqual([
        'global',
        'user',
        'project',
        'local',
      ]);
    });

    it('should handle permission intersection when both parent and child have tool restrictions', () => {
      registry.register(
        createMockAgentDef({
          id: 'restricted-child',
          metadata: {
            name: 'restricted-child',
            toolRestrictions: { allowed: ['read', 'write', 'search'] },
          },
        })
      );

      const parentPerms: AgentPermissions = {
        permissionMode: 'ask',
        toolRestrictions: { allowed: ['read', 'execute'] },
        maxTurns: 50,
        maxTimeoutMs: 3_600_000,
        canSpawnSubagents: true,
        memoryScopes: ['local'],
        maxTier: 3 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions(
        'restricted-child',
        parentPerms
      );
      // child allowed [read, write, search] intersect parent allowed [read, execute] -> [read]
      expect(perms.toolRestrictions).toBeDefined();
      expect(perms.toolRestrictions!.allowed).toEqual(['read']);
    });

    it('should handle permission intersection with child denied and parent allowed', () => {
      registry.register(
        createMockAgentDef({
          id: 'deny-child',
          metadata: {
            name: 'deny-child',
            toolRestrictions: { denied: ['execute'] },
          },
        })
      );

      const parentPerms: AgentPermissions = {
        permissionMode: 'ask',
        toolRestrictions: { allowed: ['read', 'execute', 'search'] },
        maxTurns: 50,
        maxTimeoutMs: 3_600_000,
        canSpawnSubagents: true,
        memoryScopes: ['local'],
        maxTier: 3 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions('deny-child', parentPerms);
      // child denied [execute], parent allowed [read, execute, search]
      // -> allowed = parent.allowed.filter(not in child.denied) = [read, search]
      expect(perms.toolRestrictions).toBeDefined();
      expect(perms.toolRestrictions!.allowed).toEqual(['read', 'search']);
    });

    it('should handle permission intersection with child allowed and parent denied', () => {
      registry.register(
        createMockAgentDef({
          id: 'allow-child',
          metadata: {
            name: 'allow-child',
            toolRestrictions: { allowed: ['read', 'execute', 'write'] },
          },
        })
      );

      const parentPerms: AgentPermissions = {
        permissionMode: 'ask',
        toolRestrictions: { denied: ['execute', 'delete'] },
        maxTurns: 50,
        maxTimeoutMs: 3_600_000,
        canSpawnSubagents: true,
        memoryScopes: ['local'],
        maxTier: 3 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions('allow-child', parentPerms);
      // child allowed [read, execute, write], parent denied [execute, delete]
      // -> allowed = child.allowed.filter(not in parent.denied) = [read, write]
      expect(perms.toolRestrictions).toBeDefined();
      expect(perms.toolRestrictions!.allowed).toEqual(['read', 'write']);
    });

    it('should handle permission intersection with both denied lists', () => {
      registry.register(
        createMockAgentDef({
          id: 'double-deny',
          metadata: {
            name: 'double-deny',
            toolRestrictions: { denied: ['delete'] },
          },
        })
      );

      const parentPerms: AgentPermissions = {
        permissionMode: 'ask',
        toolRestrictions: { denied: ['execute'] },
        maxTurns: 50,
        maxTimeoutMs: 3_600_000,
        canSpawnSubagents: true,
        memoryScopes: ['local'],
        maxTier: 3 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions('double-deny', parentPerms);
      // Union: [delete, execute]
      expect(perms.toolRestrictions).toBeDefined();
      expect(perms.toolRestrictions!.denied).toBeDefined();
      const denied = new Set(perms.toolRestrictions!.denied);
      expect(denied.has('delete')).toBe(true);
      expect(denied.has('execute')).toBe(true);
    });

    it('should handle permission intersection with no tool restrictions', () => {
      registry.register(
        createMockAgentDef({
          id: 'no-tools',
          metadata: { name: 'no-tools' },
        })
      );

      const parentPerms: AgentPermissions = {
        permissionMode: 'ask',
        maxTurns: 50,
        maxTimeoutMs: 3_600_000,
        canSpawnSubagents: true,
        memoryScopes: ['local'],
        maxTier: 3 as 0 | 1 | 2 | 3,
      };

      const perms = registry.resolvePermissions('no-tools', parentPerms);
      expect(perms.toolRestrictions).toBeUndefined();
    });

    it('should handle large registry efficiently', () => {
      // Register 200 agents
      for (let i = 0; i < 200; i++) {
        registry.register(
          createMockAgentDef({
            id: `agent-${i}`,
            metadata: {
              name: `agent-${i}`,
              type: i % 2 === 0 ? 'developer' : 'reviewer',
              tier: (i % 4) as 0 | 1 | 2 | 3,
            },
          })
        );
      }

      expect(registry.size).toBe(200);
      expect(registry.getByType('developer')).toHaveLength(100);
      expect(registry.getByTier(0)).toHaveLength(50);
    });
  });
});
