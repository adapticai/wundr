# 14 - Subagent Registry with Persistence

## Status: Design Complete

## Overview

The Subagent Registry is the central nervous system for Wundr's multi-agent orchestration. It manages agent definitions loaded from `.claude/agents/` markdown files with YAML frontmatter, tracks running agent instances with full lifecycle persistence, handles output collection and synthesis, and provides agent-to-agent communication via a mailbox system.

This design draws heavily from OpenClaw's battle-tested `subagent-registry.ts` persistence model while extending it with Wundr's 54-agent-type taxonomy, tier hierarchy (Tier 0-3), team composition, and the hub-and-spoke delegation pattern from `@wundr/agent-delegation`.

## Architecture

```
                    +---------------------------+
                    |    Agent Definition Files  |
                    |   .claude/agents/**/*.md   |
                    +-------------+-------------+
                                  |
                          [AgentLoader]
                       (parse YAML frontmatter,
                        resolve inheritance,
                        validate schemas)
                                  |
                    +-------------v-------------+
                    |      AgentRegistry        |
                    |  (in-memory definitions)  |
                    |  Map<agentId, AgentDef>   |
                    +---+----------+--------+---+
                        |          |        |
               +--------v--+  +---v----+  +v-----------+
               | Lifecycle  |  | Groups |  | Type       |
               | Manager    |  | & Teams|  | Restrictions|
               +-----+------+ +--------+  +------------+
                     |
         +-----------+-----------+
         |           |           |
    +----v---+  +----v---+  +---v------+
    | spawn  |  |monitor |  | cleanup  |
    +--------+  +--------+  +----------+
         |           |           |
    +----v-----------v-----------v----+
    |     Persistence Layer           |
    |  state/agents/runs.json         |
    |  (versioned, migrateable)       |
    +----------------------------------+
```

## Source Analysis

### OpenClaw Subagent Registry (Reference Implementation)

**File**: `openclaw/src/agents/subagent-registry.ts`

Key patterns we adopt:
- **SubagentRunRecord**: Tracks `runId`, `childSessionKey`, `requesterSessionKey`, `task`, `cleanup` mode, `outcome`, lifecycle timestamps
- **Persistence**: JSON file at `STATE_DIR/subagents/runs.json` with versioned schema (currently v2)
- **Lifecycle listener**: `onAgentEvent` hooks for `start`, `end`, `error` phases
- **Sweeper**: Periodic cleanup of archived runs via `setInterval` with `unref()`
- **Resume on restart**: `restoreSubagentRunsOnce()` re-hydrates in-memory state and resumes pending work
- **Announce flow**: After completion, results are announced back to the requester agent
- **Cleanup modes**: `"delete"` (remove session) or `"keep"` (preserve transcript)

**File**: `openclaw/src/agents/subagent-registry.store.ts`

Key patterns:
- Versioned persistence schema with migration support (v1 -> v2)
- `loadSubagentRegistryFromDisk()` / `saveSubagentRegistryToDisk()` pair
- Legacy field migration (`announceCompletedAt` -> `cleanupCompletedAt`)

**File**: `openclaw/src/auto-reply/reply/commands-subagents.ts`

User-facing subagent commands:
- `/subagents list` - Show all subagents with status, runtime, labels
- `/subagents stop <id|#|all>` - Abort running subagents
- `/subagents log <id|#>` - View transcript
- `/subagents info <id|#>` - Detailed status
- `/subagents send <id|#> <message>` - Send message to running subagent

### Wundr Agent Definitions (.claude/agents/)

**Format**: Markdown files with YAML frontmatter. Observed fields across 90+ agent definitions:

```yaml
---
# Identity
name: eng-code-surgeon          # Unique identifier
type: developer | coordinator | evaluator | session-manager
description: "..."              # When/how to use this agent
color: '#FF6B35'                # UI color hint

# Hierarchy
tier: 0 | 1 | 2 | 3            # 0=Evaluator, 1=Orchestrator, 2=SessionManager, 3=Specialist
scope: engineering | marketing | legal | hr | universal
archetype: engineering          # For session managers

# Capabilities
capabilities:                   # String array of skills
  - code_generation
  - refactoring
priority: high | medium | low | critical

# Tools & Model
tools:                          # Allowed tool names
  - Edit
  - Bash
  - Read
model: sonnet | opus | haiku    # Model preference
permissionMode: acceptEdits | ask | deny

# Lifecycle Hooks
hooks:
  pre: |
    echo "Starting..."
  post: |
    echo "Done..."

# RLHF / Reward Weights
rewardWeights:
  code_correctness: 0.40
  test_coverage: 0.25

# Constraints
hardConstraints:
  - "Atomic commits only"
  - "Never break existing tests"

# Autonomy
autonomousAuthority:
  - "Refactor methods under 100 lines"
escalationTriggers:
  confidence: 0.70
  risk_level: medium

# Team Composition
keySubAgents:                   # For session managers
  - backend-dev
  - frontend-dev
specializedMCPs:                # MCP servers this agent needs
  - git
  - github

# Evaluator-specific
metrics:
  - policy_compliance_rate
evaluationFrequency:
  policy_compliance_rate: per_commit
thresholds:
  violation_rate_threshold: 0.005
escalationProtocol:
  automatic:
    - "Critical security violations"

# Memory
memoryBankPath: '.claude/memory/sessions/${SESSION_ID}/'
worktreeRequirement: read | write

# Objectives
guidingPrinciples:
  - "If it isn't tested, it doesn't exist"
measurableObjectives:
  ciPipelineSuccess: '>99%'
---
```

### Wundr AI Integration (54 Agent Types)

**File**: `@wundr/ai-integration/src/core/ClaudeFlowOrchestrator.ts`

Categories and counts:
| Category | Count | Agent Types |
|----------|-------|-------------|
| Core Development | 5 | coder, reviewer, tester, planner, researcher |
| Swarm Coordination | 5 | hierarchical-coordinator, mesh-coordinator, adaptive-coordinator, collective-intelligence-coordinator, swarm-memory-manager |
| Consensus & Distributed | 7 | byzantine-coordinator, raft-manager, gossip-coordinator, consensus-builder, crdt-synchronizer, quorum-manager, security-manager |
| Performance & Optimization | 5 | perf-analyzer, performance-benchmarker, task-orchestrator, memory-coordinator, smart-agent |
| GitHub & Repository | 9 | github-modes, pr-manager, code-review-swarm, issue-tracker, release-manager, workflow-automation, project-board-sync, repo-architect, multi-repo-swarm |
| SPARC Methodology | 6 | sparc-coord, sparc-coder, specification, pseudocode, architecture, refinement |
| Specialized Development | 8 | backend-dev, mobile-dev, ml-developer, cicd-engineer, api-docs, system-architect, code-analyzer, base-template-generator |
| Testing & Validation | 2 | tdd-london-swarm, production-validator |
| Migration & Planning | 2 | migration-planner, swarm-init |

### Wundr Agent Delegation

**File**: `@wundr/agent-delegation/src/types.ts`

Key types we integrate with:
- `AgentDefinition`: id, name, role, capabilities, capabilityLevels, modelPreference, maxConcurrentTasks, timeout, retryPolicy
- `DelegationTask`: id, description, context, requiredCapabilities, preferredAgentId, priority, timeout
- `DelegationResult`: taskId, agentId, status, output, error, tokensUsed, duration
- `DelegationStatus`: pending, assigned, executing, completed, failed, cancelled, timeout
- `SynthesisStrategy`: merge, vote, consensus, best_pick, weighted_average, chain

## Detailed Design

### 1. Agent Definition Format (agent-types.ts)

The canonical agent metadata schema unifies all observed frontmatter fields:

```typescript
interface AgentMetadata {
  // Identity
  name: string;
  type?: AgentType;
  description?: string;
  color?: string;

  // Hierarchy
  tier?: AgentTier;  // 0-3
  scope?: string;
  archetype?: string;

  // Capabilities
  capabilities?: string[];
  priority?: AgentPriority;

  // Runtime Configuration
  tools?: string[];
  model?: ModelPreference;
  permissionMode?: PermissionMode;
  maxTurns?: number;

  // Lifecycle Hooks
  hooks?: {
    pre?: string;
    post?: string;
  };

  // RLHF
  rewardWeights?: Record<string, number>;
  hardConstraints?: string[];

  // Autonomy
  autonomousAuthority?: string[];
  escalationTriggers?: {
    confidence?: number;
    risk_level?: string;
    breaking_change_detected?: boolean;
  };

  // Team Composition
  keySubAgents?: string[];
  specializedMCPs?: string[];

  // Evaluator-specific
  metrics?: string[];
  evaluationFrequency?: Record<string, string>;
  thresholds?: Record<string, number>;
  escalationProtocol?: Record<string, string[]>;

  // Memory & Resources
  memoryBankPath?: string;
  worktreeRequirement?: 'read' | 'write';
  guidingPrinciples?: string[];
  measurableObjectives?: Record<string, string>;

  // Inheritance
  extends?: string;  // Base agent to inherit from
}
```

Type restrictions via `Task(agent_type)` syntax:
```typescript
type AgentType =
  | 'developer' | 'coordinator' | 'evaluator' | 'session-manager'
  | 'researcher' | 'reviewer' | 'tester' | 'planner'
  | 'specialist' | 'swarm-coordinator';

type AgentTier = 0 | 1 | 2 | 3;
type AgentPriority = 'critical' | 'high' | 'medium' | 'low';
type ModelPreference = 'opus' | 'sonnet' | 'haiku';
type PermissionMode = 'acceptEdits' | 'ask' | 'deny';
```

### 2. Agent Loader (agent-loader.ts)

Responsible for discovering and parsing `.claude/agents/**/*.md` files:

1. **Discovery**: Glob `**/*.md` under `.claude/agents/`, skip README.md files
2. **Parsing**: Extract YAML frontmatter between `---` delimiters using `yaml` library
3. **Validation**: Validate against Zod schema (fail-soft with warnings)
4. **Inheritance**: Resolve `extends` field by merging parent metadata first
5. **System Prompt**: Body markdown becomes the agent's system prompt
6. **Caching**: Cache parsed definitions with file mtime invalidation
7. **Hot Reload**: Watch for file changes and re-parse on modification

Path-based categorization:
```
.claude/agents/core/coder.md       -> category: "core"
.claude/agents/swarm/mesh.md       -> category: "swarm"
.claude/agents/sub-agents/eng/*.md -> category: "sub-agents/engineering"
```

### 3. Agent Registry (agent-registry.ts)

Central registry that maps agent IDs to their definitions and provides lookup APIs:

```typescript
interface AgentRegistry {
  // Registration
  register(definition: AgentDefinition): void;
  registerFromDirectory(agentsDir: string): Promise<number>;
  unregister(agentId: string): boolean;

  // Lookup
  get(agentId: string): AgentDefinition | undefined;
  getByType(type: AgentType): AgentDefinition[];
  getByTier(tier: AgentTier): AgentDefinition[];
  getByCapability(capability: string): AgentDefinition[];
  getByCategory(category: string): AgentDefinition[];
  findBestMatch(requirements: AgentRequirements): AgentDefinition | undefined;

  // Groups & Teams
  defineGroup(groupId: string, agentIds: string[]): void;
  getGroup(groupId: string): AgentDefinition[];
  getTeamForManager(managerId: string): AgentDefinition[];

  // Type Restrictions
  validateTypeRestriction(agentId: string, requiredType: AgentType): boolean;

  // Lifecycle
  reload(): Promise<void>;
  listAll(): AgentDefinition[];
  getStats(): RegistryStats;
}
```

**Agent Groups and Team Composition**:

Groups are defined either declaratively in config or derived from session manager `keySubAgents`:

```typescript
// Explicit group definition
registry.defineGroup('code-review-team', [
  'reviewer', 'code-analyzer', 'security-manager'
]);

// Derived from session manager
const engManager = registry.get('session-engineering-manager');
// engManager.metadata.keySubAgents = ['backend-dev', 'frontend-dev', 'qa-engineer']
const team = registry.getTeamForManager('session-engineering-manager');
```

**Agent Inheritance**:

```yaml
# .claude/agents/sub-agents/engineering/code-surgeon.md
---
name: eng-code-surgeon
extends: core/coder          # Inherits from coder agent
scope: engineering
tier: 3
tools:
  - Edit
  - Bash
---
```

Resolution: Load parent definition first, deep-merge child metadata over parent, concatenate capabilities arrays.

### 4. Agent Lifecycle Manager (agent-lifecycle.ts)

Manages the spawn -> monitor -> cleanup lifecycle, modeled after OpenClaw's pattern:

```typescript
interface AgentLifecycleManager {
  // Spawn
  spawn(params: SpawnParams): Promise<AgentRunRecord>;

  // Monitor
  getRunStatus(runId: string): AgentRunStatus;
  listActiveRuns(): AgentRunRecord[];
  listRunsForRequester(requesterId: string): AgentRunRecord[];
  waitForCompletion(runId: string, timeoutMs: number): Promise<AgentRunOutcome>;

  // Communication
  sendMessage(runId: string, message: string): Promise<void>;
  getMailbox(agentId: string): MailboxMessage[];

  // Output Collection
  getOutput(runId: string): Promise<string | undefined>;
  synthesizeOutputs(runIds: string[], strategy: SynthesisStrategy): Promise<SynthesizedResult>;

  // Cleanup
  stopRun(runId: string): Promise<void>;
  stopAllForRequester(requesterId: string): Promise<number>;
  releaseRun(runId: string): void;

  // Persistence
  persist(): void;
  restore(): void;

  // Resource Limits
  getResourceUsage(): ResourceUsage;
  canSpawn(agentType?: AgentType): boolean;
}
```

**AgentRunRecord** (extends OpenClaw's SubagentRunRecord):

```typescript
interface AgentRunRecord {
  // Core identity (from OpenClaw)
  runId: string;
  agentId: string;              // Which agent definition is running
  childSessionKey: string;
  requesterSessionKey: string;
  requesterDisplayKey: string;

  // Task
  task: string;
  label?: string;

  // Agent metadata snapshot
  agentType?: AgentType;
  agentTier?: AgentTier;
  model?: ModelPreference;

  // Lifecycle timestamps
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  outcome?: AgentRunOutcome;

  // Cleanup
  cleanup: 'delete' | 'keep';
  archiveAtMs?: number;
  cleanupCompletedAt?: number;
  cleanupHandled?: boolean;

  // Resource tracking
  tokensUsed?: number;
  costEstimate?: number;

  // Communication
  mailbox?: MailboxMessage[];
}
```

**Persistence Format** (versioned, like OpenClaw):

```json
{
  "version": 1,
  "runs": {
    "run-abc123": {
      "runId": "run-abc123",
      "agentId": "eng-code-surgeon",
      "childSessionKey": "agent:main:subagent:code-surgery-1",
      "requesterSessionKey": "agent:main:main",
      "task": "Refactor auth module",
      "agentType": "developer",
      "agentTier": 3,
      "createdAt": 1707500000000,
      "startedAt": 1707500001000,
      "cleanup": "keep"
    }
  }
}
```

**Resource Limits**:

```typescript
interface ResourceLimits {
  maxConcurrentAgents: number;          // Default: 10
  maxConcurrentPerType: number;         // Default: 5
  maxConcurrentPerTier: Record<AgentTier, number>;
  defaultTimeoutMs: number;             // Default: 300_000 (5 min)
  maxTimeoutMs: number;                 // Default: 3_600_000 (1 hour)
  archiveAfterMinutes: number;          // Default: 60
}
```

**Agent-to-Agent Communication (Mailbox)**:

Based on the Agent Teams mailbox pattern:

```typescript
interface MailboxMessage {
  id: string;
  fromAgentId: string;
  fromRunId: string;
  toAgentId: string;
  content: string;
  timestamp: number;
  read: boolean;
  replyTo?: string;     // For threaded conversations
}
```

Messages are delivered via the lifecycle manager. A running agent can:
1. Send a message to another agent's mailbox
2. Read messages from its own mailbox
3. Reply to a specific message

### 5. Output Collection and Synthesis

When subagents complete, their outputs are collected and can be synthesized:

```typescript
interface SynthesizedResult {
  id: string;
  strategy: SynthesisStrategy;
  inputRunIds: string[];
  synthesizedOutput: unknown;
  confidence?: number;
  conflicts: SynthesisConflict[];
  duration: number;
}
```

Synthesis strategies (from `@wundr/agent-delegation`):
- **merge**: Deep-merge object outputs, concatenate arrays
- **vote**: Most common output wins
- **consensus**: Field-by-field agreement above threshold
- **best_pick**: Highest-scoring result based on criteria
- **weighted_average**: Numeric outputs averaged by agent weights
- **chain**: Sequential pipeline, last output wins

### 6. Integration Points

**With OrchestratorDaemon**:
```typescript
// In orchestrator-daemon startup
const loader = new AgentLoader({ agentsDir: '.claude/agents' });
const registry = new AgentRegistry();
await loader.loadAll(registry);

const lifecycle = new AgentLifecycleManager({
  registry,
  persistPath: 'state/agents/runs.json',
  resourceLimits: config.agentLimits,
});
lifecycle.restore(); // Resume from disk
```

**With HubCoordinator** (`@wundr/agent-delegation`):
```typescript
// Bridge registry definitions to delegation system
for (const def of registry.listAll()) {
  coordinator.registerAgent({
    name: def.metadata.name,
    role: def.metadata.type ?? 'specialist',
    capabilities: def.metadata.capabilities ?? [],
    modelPreference: mapModelTier(def.metadata.model),
    maxConcurrentTasks: def.metadata.maxConcurrentTasks ?? 3,
  });
}
```

**With Agent Teams (mailbox)**:
```typescript
// Route Task(agent_type) to appropriate agent
function resolveTaskAgent(taskType: string): AgentDefinition[] {
  return registry.getByType(taskType as AgentType);
}
```

## File Manifest

| File | Purpose |
|------|---------|
| `agent-types.ts` | Type definitions, Zod schemas, enums |
| `agent-loader.ts` | Parse .md files, resolve inheritance, validate |
| `agent-registry.ts` | Central registry with lookup, groups, teams |
| `agent-lifecycle.ts` | Spawn, monitor, cleanup, persistence, mailbox |

## Migration Path

1. **Phase 1**: Types and loader - Parse existing `.claude/agents/` files
2. **Phase 2**: Registry - Replace hardcoded `AGENT_REGISTRY` in `ClaudeFlowOrchestrator.ts`
3. **Phase 3**: Lifecycle - Replace in-memory `activeAgents` Map with full persistence
4. **Phase 4**: Bridge to `@wundr/agent-delegation` HubCoordinator

## Open Questions

1. Should agent definitions support environment-specific overrides (dev vs prod)?
2. Should the mailbox be persisted independently or as part of run records?
3. Should we support dynamic agent registration at runtime (not just from files)?
4. How should agent capability scoring interact with the existing `ModelSelector`?
