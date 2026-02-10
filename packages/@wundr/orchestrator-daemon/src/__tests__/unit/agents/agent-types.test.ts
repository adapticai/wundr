/**
 * Unit tests for @wundr/orchestrator-daemon agent type definitions.
 *
 * Covers Zod schema validation, default constants, enum values,
 * and persistence version constants defined in agent-types.ts.
 */

import { describe, it, expect } from 'vitest';

import {
  // Enum schemas
  AgentTypeSchema,
  AgentTierSchema,
  AgentPrioritySchema,
  ModelPreferenceSchema,
  PermissionModeSchema,
  CleanupModeSchema,
  RunStatusSchema,
  MemoryScopeSchema,
  SynthesisStrategySchema,
  SpawnModeSchema,

  // Object schemas
  ToolRestrictionsSchema,
  EscalationTriggersSchema,
  AgentHooksSchema,
  EscalationProtocolSchema,
  AgentMetadataSchema,

  // Constants
  DEFAULT_MAX_TURNS_BY_TYPE,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_RESOURCE_LIMITS,
  REGISTRY_VERSION,
  PERSISTED_STATE_VERSION,
} from '../../../agents/agent-types';

import type {
  AgentType,
  AgentPriority,
  ModelPreference,
  PermissionMode,
  CleanupMode,
  RunStatus,
  MemoryScope,
  SynthesisStrategy,
  SpawnMode,
  ToolRestrictions,
  AgentPermissions,
  HeartbeatConfig,
} from '../../../agents/agent-types';

// =============================================================================
// AgentTypeSchema
// =============================================================================

describe('AgentTypeSchema', () => {
  const validTypes: AgentType[] = [
    'developer',
    'coordinator',
    'evaluator',
    'session-manager',
    'researcher',
    'reviewer',
    'tester',
    'planner',
    'specialist',
    'swarm-coordinator',
  ];

  it.each(validTypes)('accepts valid agent type "%s"', (value) => {
    const result = AgentTypeSchema.safeParse(value);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(value);
    }
  });

  it('contains exactly 10 agent types', () => {
    expect(AgentTypeSchema.options).toHaveLength(10);
  });

  it('rejects invalid agent type', () => {
    const result = AgentTypeSchema.safeParse('invalid-type');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(AgentTypeSchema.safeParse('').success).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(AgentTypeSchema.safeParse(42).success).toBe(false);
    expect(AgentTypeSchema.safeParse(null).success).toBe(false);
    expect(AgentTypeSchema.safeParse(undefined).success).toBe(false);
  });
});

// =============================================================================
// AgentTierSchema
// =============================================================================

describe('AgentTierSchema', () => {
  it.each([0, 1, 2, 3])('accepts valid tier %d', (value) => {
    const result = AgentTierSchema.safeParse(value);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(value);
    }
  });

  it('rejects tier values outside 0-3 range', () => {
    expect(AgentTierSchema.safeParse(4).success).toBe(false);
    expect(AgentTierSchema.safeParse(-1).success).toBe(false);
    expect(AgentTierSchema.safeParse(100).success).toBe(false);
  });

  it('rejects floating point numbers', () => {
    expect(AgentTierSchema.safeParse(1.5).success).toBe(false);
  });

  it('rejects string numbers', () => {
    expect(AgentTierSchema.safeParse('1').success).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(AgentTierSchema.safeParse(null).success).toBe(false);
    expect(AgentTierSchema.safeParse(undefined).success).toBe(false);
  });
});

// =============================================================================
// AgentPrioritySchema
// =============================================================================

describe('AgentPrioritySchema', () => {
  const validPriorities: AgentPriority[] = ['critical', 'high', 'medium', 'low'];

  it.each(validPriorities)('accepts valid priority "%s"', (value) => {
    const result = AgentPrioritySchema.safeParse(value);
    expect(result.success).toBe(true);
  });

  it('has exactly 4 priority levels', () => {
    expect(AgentPrioritySchema.options).toHaveLength(4);
  });

  it('rejects invalid priority values', () => {
    expect(AgentPrioritySchema.safeParse('urgent').success).toBe(false);
    expect(AgentPrioritySchema.safeParse('').success).toBe(false);
  });
});

// =============================================================================
// ModelPreferenceSchema
// =============================================================================

describe('ModelPreferenceSchema', () => {
  const validModels: ModelPreference[] = ['opus', 'sonnet', 'haiku'];

  it.each(validModels)('accepts valid model "%s"', (value) => {
    const result = ModelPreferenceSchema.safeParse(value);
    expect(result.success).toBe(true);
  });

  it('has exactly 3 model options', () => {
    expect(ModelPreferenceSchema.options).toHaveLength(3);
  });

  it('rejects unknown model names', () => {
    expect(ModelPreferenceSchema.safeParse('gpt-4').success).toBe(false);
    expect(ModelPreferenceSchema.safeParse('claude').success).toBe(false);
  });
});

// =============================================================================
// PermissionModeSchema
// =============================================================================

describe('PermissionModeSchema', () => {
  const validModes: PermissionMode[] = ['acceptEdits', 'ask', 'deny'];

  it.each(validModes)('accepts valid permission mode "%s"', (value) => {
    const result = PermissionModeSchema.safeParse(value);
    expect(result.success).toBe(true);
  });

  it('has exactly 3 modes', () => {
    expect(PermissionModeSchema.options).toHaveLength(3);
  });

  it('rejects invalid modes', () => {
    expect(PermissionModeSchema.safeParse('allow').success).toBe(false);
    expect(PermissionModeSchema.safeParse('reject').success).toBe(false);
  });
});

// =============================================================================
// CleanupModeSchema
// =============================================================================

describe('CleanupModeSchema', () => {
  const validModes: CleanupMode[] = ['delete', 'keep'];

  it.each(validModes)('accepts valid cleanup mode "%s"', (value) => {
    expect(CleanupModeSchema.safeParse(value).success).toBe(true);
  });

  it('has exactly 2 modes', () => {
    expect(CleanupModeSchema.options).toHaveLength(2);
  });

  it('rejects invalid cleanup modes', () => {
    expect(CleanupModeSchema.safeParse('archive').success).toBe(false);
  });
});

// =============================================================================
// RunStatusSchema
// =============================================================================

describe('RunStatusSchema', () => {
  const validStatuses: RunStatus[] = [
    'pending',
    'running',
    'completed',
    'failed',
    'timeout',
    'cancelled',
  ];

  it.each(validStatuses)('accepts valid status "%s"', (value) => {
    expect(RunStatusSchema.safeParse(value).success).toBe(true);
  });

  it('has exactly 6 statuses', () => {
    expect(RunStatusSchema.options).toHaveLength(6);
  });

  it('rejects invalid statuses', () => {
    expect(RunStatusSchema.safeParse('queued').success).toBe(false);
    expect(RunStatusSchema.safeParse('paused').success).toBe(false);
  });
});

// =============================================================================
// MemoryScopeSchema
// =============================================================================

describe('MemoryScopeSchema', () => {
  const validScopes: MemoryScope[] = ['user', 'project', 'local', 'global'];

  it.each(validScopes)('accepts valid memory scope "%s"', (value) => {
    const result = MemoryScopeSchema.safeParse(value);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(value);
    }
  });

  it('has exactly 4 memory scope levels', () => {
    expect(MemoryScopeSchema.options).toHaveLength(4);
  });

  it('rejects invalid scope strings', () => {
    expect(MemoryScopeSchema.safeParse('session').success).toBe(false);
    expect(MemoryScopeSchema.safeParse('workspace').success).toBe(false);
    expect(MemoryScopeSchema.safeParse('').success).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(MemoryScopeSchema.safeParse(1).success).toBe(false);
    expect(MemoryScopeSchema.safeParse(true).success).toBe(false);
  });
});

// =============================================================================
// SynthesisStrategySchema
// =============================================================================

describe('SynthesisStrategySchema', () => {
  const validStrategies: SynthesisStrategy[] = [
    'merge',
    'vote',
    'consensus',
    'best_pick',
    'weighted_average',
    'chain',
  ];

  it.each(validStrategies)('accepts valid strategy "%s"', (value) => {
    expect(SynthesisStrategySchema.safeParse(value).success).toBe(true);
  });

  it('has exactly 6 strategies', () => {
    expect(SynthesisStrategySchema.options).toHaveLength(6);
  });

  it('rejects invalid strategy', () => {
    expect(SynthesisStrategySchema.safeParse('random').success).toBe(false);
  });
});

// =============================================================================
// SpawnModeSchema
// =============================================================================

describe('SpawnModeSchema', () => {
  const validModes: SpawnMode[] = [
    'in-process',
    'worker-thread',
    'child-process',
    'tmux-session',
  ];

  it.each(validModes)('accepts valid spawn mode "%s"', (value) => {
    expect(SpawnModeSchema.safeParse(value).success).toBe(true);
  });

  it('has exactly 4 spawn modes', () => {
    expect(SpawnModeSchema.options).toHaveLength(4);
  });

  it('rejects invalid spawn modes', () => {
    expect(SpawnModeSchema.safeParse('docker').success).toBe(false);
  });
});

// =============================================================================
// ToolRestrictionsSchema
// =============================================================================

describe('ToolRestrictionsSchema', () => {
  it('accepts undefined (schema itself is optional)', () => {
    const result = ToolRestrictionsSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('accepts an empty object', () => {
    const result = ToolRestrictionsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts allowed-only restriction', () => {
    const result = ToolRestrictionsSchema.safeParse({
      allowed: ['Read', 'Bash', 'Grep'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ allowed: ['Read', 'Bash', 'Grep'] });
    }
  });

  it('accepts denied-only restriction', () => {
    const result = ToolRestrictionsSchema.safeParse({
      denied: ['Write', 'Edit'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ denied: ['Write', 'Edit'] });
    }
  });

  it('accepts both allowed and denied simultaneously', () => {
    // The schema allows both; business logic enforces mutual exclusivity
    const result = ToolRestrictionsSchema.safeParse({
      allowed: ['Read'],
      denied: ['Write'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty arrays for allowed and denied', () => {
    const result = ToolRestrictionsSchema.safeParse({
      allowed: [],
      denied: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-string array items in allowed', () => {
    const result = ToolRestrictionsSchema.safeParse({
      allowed: [1, 2, 3],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string array items in denied', () => {
    const result = ToolRestrictionsSchema.safeParse({
      denied: [true, false],
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// EscalationTriggersSchema
// =============================================================================

describe('EscalationTriggersSchema', () => {
  it('accepts undefined (schema itself is optional)', () => {
    expect(EscalationTriggersSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts valid escalation triggers', () => {
    const result = EscalationTriggersSchema.safeParse({
      confidence: 0.85,
      risk_level: 'high',
      breaking_change_detected: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(EscalationTriggersSchema.safeParse({}).success).toBe(true);
  });

  it('accepts confidence boundary values', () => {
    expect(
      EscalationTriggersSchema.safeParse({ confidence: 0 }).success,
    ).toBe(true);
    expect(
      EscalationTriggersSchema.safeParse({ confidence: 1 }).success,
    ).toBe(true);
  });

  it('rejects confidence values outside [0,1]', () => {
    expect(
      EscalationTriggersSchema.safeParse({ confidence: -0.1 }).success,
    ).toBe(false);
    expect(
      EscalationTriggersSchema.safeParse({ confidence: 1.1 }).success,
    ).toBe(false);
  });

  it('rejects extra keys (strict mode)', () => {
    const result = EscalationTriggersSchema.safeParse({
      confidence: 0.5,
      extra_field: 'not allowed',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// AgentHooksSchema
// =============================================================================

describe('AgentHooksSchema', () => {
  it('accepts undefined (schema is optional)', () => {
    expect(AgentHooksSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts valid pre and post hooks', () => {
    const result = AgentHooksSchema.safeParse({
      pre: 'echo "starting"',
      post: 'echo "done"',
    });
    expect(result.success).toBe(true);
  });

  it('accepts pre-only', () => {
    expect(AgentHooksSchema.safeParse({ pre: 'lint' }).success).toBe(true);
  });

  it('accepts post-only', () => {
    expect(AgentHooksSchema.safeParse({ post: 'cleanup' }).success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(AgentHooksSchema.safeParse({}).success).toBe(true);
  });

  it('rejects extra keys (strict mode)', () => {
    const result = AgentHooksSchema.safeParse({
      pre: 'lint',
      during: 'watch',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// EscalationProtocolSchema
// =============================================================================

describe('EscalationProtocolSchema', () => {
  it('accepts undefined (schema is optional)', () => {
    expect(EscalationProtocolSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts valid escalation protocol', () => {
    const result = EscalationProtocolSchema.safeParse({
      automatic: ['restart', 'notify'],
      guardian_review: ['security-scan'],
      architect_alert: ['design-review'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial protocol', () => {
    expect(
      EscalationProtocolSchema.safeParse({ automatic: ['restart'] }).success,
    ).toBe(true);
  });

  it('accepts empty object', () => {
    expect(EscalationProtocolSchema.safeParse({}).success).toBe(true);
  });
});

// =============================================================================
// AgentMetadataSchema
// =============================================================================

describe('AgentMetadataSchema', () => {
  const minimalValid = { name: 'test-agent' };

  it('accepts minimal metadata with just a name', () => {
    const result = AgentMetadataSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('test-agent');
    }
  });

  it('rejects missing name', () => {
    const result = AgentMetadataSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = AgentMetadataSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts fully populated metadata', () => {
    const full = {
      name: 'full-agent',
      type: 'developer',
      description: 'A complete agent definition',
      color: '#ff0000',
      tier: 2,
      scope: 'project',
      archetype: 'builder',
      capabilities: ['code-gen', 'refactoring'],
      priority: 'high',
      tools: ['Read', 'Write', 'Bash'],
      model: 'opus',
      permissionMode: 'acceptEdits',
      maxTurns: 100,
      hooks: { pre: 'lint', post: 'test' },
      rewardWeights: { quality: 0.8, speed: 0.2 },
      hardConstraints: ['no-force-push'],
      autonomousAuthority: ['approve-minor-changes'],
      escalationTriggers: { confidence: 0.7, breaking_change_detected: false },
      keySubAgents: ['linter', 'formatter'],
      specializedMCPs: ['code-analysis'],
      metrics: ['coverage', 'complexity'],
      evaluationFrequency: { daily: 'full-suite' },
      thresholds: { coverage: 80 },
      escalationProtocol: { automatic: ['restart'] },
      memoryBankPath: '.memory/full-agent',
      worktreeRequirement: 'write',
      guidingPrinciples: ['keep it simple'],
      measurableObjectives: { coverage: '80%' },
      extends: 'base-agent',
      toolRestrictions: { allowed: ['Read'] },
      memoryScope: 'project',
      heartbeatIntervalMs: 15000,
      heartbeatMissedThreshold: 5,
      maxInstances: 3,
      persistState: true,
      parentAgentId: 'orchestrator',
      maxRestarts: 4,
      canSpawnSubagents: true,
    };

    const result = AgentMetadataSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('full-agent');
      expect(result.data.type).toBe('developer');
      expect(result.data.tier).toBe(2);
      expect(result.data.capabilities).toEqual(['code-gen', 'refactoring']);
      expect(result.data.maxTurns).toBe(100);
      expect(result.data.memoryScope).toBe('project');
      expect(result.data.canSpawnSubagents).toBe(true);
    }
  });

  it('uses passthrough mode to allow extra fields', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test-agent',
      custom_field: 'extra-data',
      another: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom_field).toBe('extra-data');
      expect(result.data.another).toBe(42);
    }
  });

  it('rejects invalid type enum value', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      type: 'invalid-type',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid tier value', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      tier: 5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxTurns', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      maxTurns: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero maxTurns', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      maxTurns: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer maxTurns', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      maxTurns: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid worktreeRequirement', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      worktreeRequirement: 'execute',
    });
    expect(result.success).toBe(false);
  });

  it('validates worktreeRequirement enum values', () => {
    expect(
      AgentMetadataSchema.safeParse({ name: 'a', worktreeRequirement: 'read' })
        .success,
    ).toBe(true);
    expect(
      AgentMetadataSchema.safeParse({ name: 'a', worktreeRequirement: 'write' })
        .success,
    ).toBe(true);
  });

  it('rejects negative heartbeatIntervalMs', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      heartbeatIntervalMs: -100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer heartbeatMissedThreshold', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      heartbeatMissedThreshold: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxRestarts', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      maxRestarts: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero maxRestarts (disable restarts)', () => {
    const result = AgentMetadataSchema.safeParse({
      name: 'test',
      maxRestarts: 0,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// DEFAULT_MAX_TURNS_BY_TYPE
// =============================================================================

describe('DEFAULT_MAX_TURNS_BY_TYPE', () => {
  it('has an entry for every agent type', () => {
    const allTypes = AgentTypeSchema.options;
    for (const type of allTypes) {
      expect(DEFAULT_MAX_TURNS_BY_TYPE).toHaveProperty(type);
      expect(typeof DEFAULT_MAX_TURNS_BY_TYPE[type]).toBe('number');
    }
  });

  it('all values are positive integers', () => {
    for (const [, value] of Object.entries(DEFAULT_MAX_TURNS_BY_TYPE)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('has expected specific values', () => {
    expect(DEFAULT_MAX_TURNS_BY_TYPE.developer).toBe(50);
    expect(DEFAULT_MAX_TURNS_BY_TYPE.coordinator).toBe(30);
    expect(DEFAULT_MAX_TURNS_BY_TYPE.evaluator).toBe(20);
    expect(DEFAULT_MAX_TURNS_BY_TYPE['session-manager']).toBe(40);
    expect(DEFAULT_MAX_TURNS_BY_TYPE.researcher).toBe(30);
    expect(DEFAULT_MAX_TURNS_BY_TYPE.reviewer).toBe(25);
    expect(DEFAULT_MAX_TURNS_BY_TYPE.tester).toBe(40);
    expect(DEFAULT_MAX_TURNS_BY_TYPE.planner).toBe(25);
    expect(DEFAULT_MAX_TURNS_BY_TYPE.specialist).toBe(35);
    expect(DEFAULT_MAX_TURNS_BY_TYPE['swarm-coordinator']).toBe(30);
  });

  it('is typed as Readonly (compile-time immutability)', () => {
    // Readonly<Record<...>> is a compile-time constraint only; the object
    // is not Object.freeze'd at runtime. Verify it still behaves as a
    // plain object at runtime with the correct key count.
    const keys = Object.keys(DEFAULT_MAX_TURNS_BY_TYPE);
    expect(keys).toHaveLength(AgentTypeSchema.options.length);
  });
});

// =============================================================================
// DEFAULT_HEARTBEAT_CONFIG
// =============================================================================

describe('DEFAULT_HEARTBEAT_CONFIG', () => {
  it('has the expected default values', () => {
    expect(DEFAULT_HEARTBEAT_CONFIG.intervalMs).toBe(30_000);
    expect(DEFAULT_HEARTBEAT_CONFIG.missedThreshold).toBe(3);
    expect(DEFAULT_HEARTBEAT_CONFIG.autoRestart).toBe(false);
    expect(DEFAULT_HEARTBEAT_CONFIG.maxRestarts).toBe(2);
  });

  it('contains all required HeartbeatConfig fields', () => {
    const config: HeartbeatConfig = DEFAULT_HEARTBEAT_CONFIG;
    expect(config).toHaveProperty('intervalMs');
    expect(config).toHaveProperty('missedThreshold');
    expect(config).toHaveProperty('autoRestart');
    expect(config).toHaveProperty('maxRestarts');
  });

  it('has an interval in a reasonable range', () => {
    expect(DEFAULT_HEARTBEAT_CONFIG.intervalMs).toBeGreaterThanOrEqual(1000);
    expect(DEFAULT_HEARTBEAT_CONFIG.intervalMs).toBeLessThanOrEqual(300_000);
  });
});

// =============================================================================
// DEFAULT_RESOURCE_LIMITS
// =============================================================================

describe('DEFAULT_RESOURCE_LIMITS', () => {
  it('has the expected default concurrency limits', () => {
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentAgents).toBe(10);
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentPerType).toBe(5);
  });

  it('has the expected per-tier limits', () => {
    const perTier = DEFAULT_RESOURCE_LIMITS.maxConcurrentPerTier;
    expect(perTier[0]).toBe(2);  // Tier 0: evaluators
    expect(perTier[1]).toBe(3);  // Tier 1: orchestrators
    expect(perTier[2]).toBe(5);  // Tier 2: session managers
    expect(perTier[3]).toBe(10); // Tier 3: specialists
  });

  it('per-tier limits increase with tier number', () => {
    const perTier = DEFAULT_RESOURCE_LIMITS.maxConcurrentPerTier;
    expect(perTier[0]).toBeLessThanOrEqual(perTier[1]);
    expect(perTier[1]).toBeLessThanOrEqual(perTier[2]);
    expect(perTier[2]).toBeLessThanOrEqual(perTier[3]);
  });

  it('has expected timeout defaults', () => {
    expect(DEFAULT_RESOURCE_LIMITS.defaultTimeoutMs).toBe(300_000);    // 5 min
    expect(DEFAULT_RESOURCE_LIMITS.maxTimeoutMs).toBe(3_600_000);       // 1 hour
  });

  it('default timeout does not exceed max timeout', () => {
    expect(DEFAULT_RESOURCE_LIMITS.defaultTimeoutMs).toBeLessThanOrEqual(
      DEFAULT_RESOURCE_LIMITS.maxTimeoutMs,
    );
  });

  it('has expected archive configuration', () => {
    expect(DEFAULT_RESOURCE_LIMITS.archiveAfterMinutes).toBe(60);
  });

  it('does not set maxConcurrentPerAgent by default', () => {
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentPerAgent).toBeUndefined();
  });

  it('all numeric fields are positive', () => {
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentAgents).toBeGreaterThan(0);
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentPerType).toBeGreaterThan(0);
    expect(DEFAULT_RESOURCE_LIMITS.defaultTimeoutMs).toBeGreaterThan(0);
    expect(DEFAULT_RESOURCE_LIMITS.maxTimeoutMs).toBeGreaterThan(0);
    expect(DEFAULT_RESOURCE_LIMITS.archiveAfterMinutes).toBeGreaterThan(0);
  });
});

// =============================================================================
// Persistence Version Constants
// =============================================================================

describe('Persistence version constants', () => {
  it('REGISTRY_VERSION is 2', () => {
    expect(REGISTRY_VERSION).toBe(2);
  });

  it('PERSISTED_STATE_VERSION is 1', () => {
    expect(PERSISTED_STATE_VERSION).toBe(1);
  });

  it('versions are integers', () => {
    expect(Number.isInteger(REGISTRY_VERSION)).toBe(true);
    expect(Number.isInteger(PERSISTED_STATE_VERSION)).toBe(true);
  });
});

// =============================================================================
// TypeScript interface structural tests
// =============================================================================

describe('Type-level structural assertions', () => {
  it('ToolRestrictions interface allows allowed-only', () => {
    const r: ToolRestrictions = { allowed: ['Read'] };
    expect(r.allowed).toEqual(['Read']);
    expect(r.denied).toBeUndefined();
  });

  it('ToolRestrictions interface allows denied-only', () => {
    const r: ToolRestrictions = { denied: ['Write'] };
    expect(r.denied).toEqual(['Write']);
    expect(r.allowed).toBeUndefined();
  });

  it('ToolRestrictions interface allows empty object', () => {
    const r: ToolRestrictions = {};
    expect(r.allowed).toBeUndefined();
    expect(r.denied).toBeUndefined();
  });

  it('AgentPermissions interface has all required fields', () => {
    const p: AgentPermissions = {
      permissionMode: 'acceptEdits',
      maxTurns: 50,
      maxTimeoutMs: 300_000,
      canSpawnSubagents: true,
      memoryScopes: ['project', 'local'],
      maxTier: 3,
    };
    expect(p.permissionMode).toBe('acceptEdits');
    expect(p.maxTurns).toBe(50);
    expect(p.maxTimeoutMs).toBe(300_000);
    expect(p.canSpawnSubagents).toBe(true);
    expect(p.memoryScopes).toContain('project');
    expect(p.memoryScopes).toContain('local');
    expect(p.maxTier).toBe(3);
  });

  it('AgentPermissions with optional toolRestrictions', () => {
    const p: AgentPermissions = {
      permissionMode: 'deny',
      maxTurns: 10,
      maxTimeoutMs: 60_000,
      canSpawnSubagents: false,
      memoryScopes: ['local'],
      maxTier: 0,
      toolRestrictions: { denied: ['Bash'] },
    };
    expect(p.toolRestrictions?.denied).toContain('Bash');
  });
});
