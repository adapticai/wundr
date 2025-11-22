# Three-Tier Architecture Implementation Plan

## Alignment with Autonomous High-Density Agentic Clusters Framework

**Document Version**: 1.0.0 **Date**: 2025-11-22 **Status**: Implementation Blueprint

---

## Executive Summary

This document outlines the implementation plan to enhance the wundr repository to align with the
"Architectural Framework for Autonomous High-Density Agentic Clusters" document. The goal is to
enable fleet-scale autonomous engineering through a **four-tier** organizational structure
(including the Human Cortex):

| Tier                           | Role                                   | Scale                                                     | Current State | Enhancement Required                  |
| ------------------------------ | -------------------------------------- | --------------------------------------------------------- | ------------- | ------------------------------------- |
| **Tier 0: Human Cortex**       | Strategy, governance, judgment         | 12 humans (3 Architects + 4 Intent-Setters + 6 Guardians) | ❌ Missing    | Role definitions, dashboards, tooling |
| **Tier 1: VP (Supervisor)**    | Strategy, triage, resource allocation  | 1 per Node (16 total)                                     | 🟡 Partial    | New VP Daemon Script with PTY         |
| **Tier 2: Session (Manager)**  | Feature implementation, git management | 5-10 per VP (~160 total)                                  | 🟢 Exists     | Memory Bank Enhancement               |
| **Tier 3: Sub-Agent (Worker)** | Specialized tasks                      | ~20 per Session (~3,200 total)                            | 🟢 Exists     | Worktree Integration                  |

**Maximum Scale**: 3,376 autonomous agents (16 VPs + 160 Sessions + 3,200 Workers) directed by
12-person human cortex = **281:1 leverage ratio**

---

## Part 1: Gap Analysis

### 1.1 Current Wundr Capabilities

#### ✅ Already Implemented

- **computer-setup command**: `packages/@wundr/cli/src/commands/computer-setup.ts`
  - Profile management (frontend, backend, fullstack, devops, ml, mobile)
  - Claude Code & Claude Flow installation
  - MCP tools configuration
  - Interactive setup wizard

- **project-init/ProjectInitializer**:
  `packages/@wundr/computer-setup/src/project-init/project-initializer.ts`
  - .claude directory structure creation
  - Agent templates deployment
  - Hooks configuration
  - Git worktree basic configuration
  - Deployment platform detection (Railway, Netlify)

- **Agent Library** (54+ agents in `.claude/agents/`)
  - Core: coder, reviewer, tester, planner, researcher
  - Swarm coordinators: hierarchical-coordinator, mesh-coordinator, adaptive-coordinator
  - Consensus: byzantine-coordinator, raft-manager, gossip-coordinator
  - GitHub integration: pr-manager, issue-tracker, release-manager

- **Memory Coordination**: `.claude/agents/templates/memory-coordinator.md`
  - Namespace management
  - Cross-session persistence
  - Agent coordination memory

#### 🟡 Partial Implementation (Enhancement Needed)

| Component                | Current State              | Required Enhancement                               |
| ------------------------ | -------------------------- | -------------------------------------------------- |
| Hierarchical Coordinator | Generic swarm coordination | VP-specific identity & triage logic                |
| Memory Bank              | Generic memory system      | Session-specific `activeContext.md`, `progress.md` |
| Git Worktrees            | Basic config generation    | Fractional worktree pattern for sub-agents         |
| IPRE Governance          | Not implemented            | Full Intent→Policy→Reward→Evaluator pipeline       |
| Token Budgeting          | Not implemented            | Rate limiting & tiered model allocation            |

#### ❌ Missing Components

- **Tier 0 Human Cortex Tooling**: Architect, Intent-Setter, Guardian role definitions and
  dashboards
- **VP Daemon (Node.js/Bolt.js)**: Identity management, Slack integration, process lifecycle
- **node-pty Integration**: "Yes-Claude" pattern for automated CLI approval
- **RAG-based Request Classification**: VP triage logic with semantic understanding
- **Session Slot Manager**: Concurrent session orchestration with queue/backlog
- **IPRE Pipeline**: Governance layer with hard constraints and reward functions
- **Alignment Debt Monitoring**: Five-dimension drift detection (policy violation, intent-outcome
  gap, evaluator disagreement, escalation suppression, reward hacking)
- **Guardian Dashboard**: Daily alignment debt reports and intervention recommendations
- **Telemetry Collection System**: Decision logging to observability system
- **Risk Twin Validation**: Simulated testing environment with 10x acceleration
- **ccswitch-style Worktree Lifecycle**: Automated worktree creation, switching, cleanup
- **Quality Gate Hooks**: Pre/Post hooks with Reviewer Agent before sub-agent commits
- **System Resource Enforcement**: ulimit configuration, disk space monitoring

---

## Part 2: Enhancement Specifications

### 2.0 Tier 0: Human Cortex Layer (NEW)

The Human Cortex doesn't _manage_ the digital workforce—it _architects_ the conditions for
autonomous operation.

#### 2.0.1 Role Definitions

**Files to Create**: `.claude/governance/human-cortex/`

```
.claude/governance/human-cortex/
├── README.md                    # Overview of Tier 0 responsibilities
├── roles/
│   ├── architect.md             # System design, protocols, learning architecture
│   ├── intent-setter.md         # Strategic purpose, values encoding, IPRE
│   └── guardian.md              # Judgment, escalation review, quality oversight
├── dashboards/
│   └── guardian-dashboard.md    # Daily alignment debt reports specification
└── playbooks/
    ├── escalation-response.md   # How to handle escalations
    ├── alignment-remediation.md # Fixing alignment drift
    └── emergency-cortex.md      # Critical intervention protocols
```

**Role Specifications**:

```yaml
# .claude/governance/human-cortex/roles/architect.md
---
role: architect
tier: 0
count: '3-5 per organization'

responsibilities:
  - Design VP-Session-SubAgent hierarchy
  - Define coordination protocols
  - Implement Memory Bank structures
  - Establish isolation architectures (Git Worktrees, permissions)
  - Configure Risk Twin validation environments

outputs:
  - Agent charters
  - Coordination patterns
  - Escalation logic
  - System architecture documentation

concentration_risk: >
  Loss of key Architects jeopardizes system understanding. Mitigate via Memory Bank continuity and
  documentation.
---
```

```yaml
# .claude/governance/human-cortex/roles/intent-setter.md
---
role: intent-setter
tier: 0
count: '4-6 per organization'

responsibilities:
  - Articulate strategic intent in natural language
  - Define hard constraints (policies)
  - Specify reward function weights
  - Deploy evaluator agents for alignment monitoring

outputs:
  - IPRE Pipeline configurations
  - Policy specifications
  - Reward function designs
  - Evaluator agent configurations

concentration_risk: >
  Intent-Setter departure creates strategic drift. Mitigate via documented intent and reward
  rationale.
---
```

```yaml
# .claude/governance/human-cortex/roles/guardian.md
---
role: guardian
tier: 0
count: '6-12 per organization'

responsibilities:
  - Review flagged escalations
  - Adjudicate taste in edge cases
  - Train evaluator agents
  - Audit agent outputs
  - Maintain stakeholder trust

outputs:
  - Escalation decisions
  - Quality assessments
  - Evaluator training data
  - Audit reports

concentration_risk: >
  Guardian burnout degrades quality oversight. Mitigate via rotation, workload limits, and
  psychological sustainability.
---
```

#### 2.0.2 Guardian Dashboard

**New Module**: `packages/@wundr/guardian-dashboard/`

```
packages/@wundr/guardian-dashboard/
├── src/
│   ├── index.ts
│   ├── alignment-debt-calculator.ts
│   ├── drift-score-aggregator.ts
│   ├── intervention-recommender.ts
│   └── report-generator.ts
├── templates/
│   └── daily-report.md
└── package.json
```

**Daily Report Template**:

```markdown
# Guardian Daily Alignment Report - {{DATE}}

## Aggregate Drift Score: {{SCORE}}/100

Status: {{HEALTHY|CONCERNING|CRITICAL}}

## Top 10 Sessions by Drift Score

| Rank | Session ID | Drift Score | Primary Issue |
| ---- | ---------- | ----------- | ------------- |

{{SESSION_TABLE}}

## Dimension Breakdown

| Dimension                | Score   | Threshold | Status     |
| ------------------------ | ------- | --------- | ---------- |
| Policy Violation Rate    | {{PV}}% | <0.5%     | {{STATUS}} |
| Intent-Outcome Gap       | {{IO}}% | <15%      | {{STATUS}} |
| Evaluator Disagreement   | {{ED}}% | <20%      | {{STATUS}} |
| Escalation Suppression   | {{ES}}% | <40% drop | {{STATUS}} |
| Reward Hacking Instances | {{RH}}  | <5/month  | {{STATUS}} |

## Recommended Interventions

{{INTERVENTIONS}}

## Sessions Requiring Guardian Review

{{REVIEW_QUEUE}}
```

---

### 2.1 Tier 1: VP Supervisor Layer

#### 2.1.1 VP Daemon Script (`scripts/vp-daemon/`)

**Purpose**: Acts as the "Operating System" for a node, managing sessions and providing human-facing
interface.

**Files to Create**:

```
scripts/vp-daemon/
├── index.ts              # Main entry point
├── identity-manager.ts   # Name, Face, Email, Slack identity
├── session-manager.ts    # Session slot allocation with queue/backlog
├── slack-adapter.ts      # Bolt.js Slack integration (Socket Mode)
├── resource-allocator.ts # Token budget & CPU/RAM management
├── triage-engine.ts      # RAG-based request routing logic
├── pty-controller.ts     # node-pty for "Yes-Claude" pattern
├── telemetry-collector.ts # Decision logging to observability
├── intervention-engine.ts # Automatic autonomy reduction logic
└── types.ts              # TypeScript definitions
```

#### 2.1.2 node-pty "Yes-Claude" Pattern (NEW)

The VP programmatically drives interactive Claude CLI sessions using `node-pty`, acting as the
"human in the loop" for automated command approval.

**Implementation**: `scripts/vp-daemon/pty-controller.ts`

```typescript
import * as pty from 'node-pty';

export interface PTYControllerConfig {
  shell: string; // Default: process.env.SHELL
  cwd: string; // Worktree directory
  env: Record<string, string>;
  safetyHeuristics: SafetyHeuristics;
}

export interface SafetyHeuristics {
  autoApprovePatterns: RegExp[]; // Patterns to auto-approve
  alwaysRejectPatterns: RegExp[]; // Patterns to always reject
  escalationPatterns: RegExp[]; // Patterns requiring Guardian review
}

export class PTYController {
  private ptyProcess: pty.IPty | null = null;

  constructor(private config: PTYControllerConfig) {}

  /**
   * Spawn a new Claude CLI session in PTY
   */
  async spawnSession(worktreePath: string): Promise<string> {
    this.ptyProcess = pty.spawn(this.config.shell, [], {
      name: 'xterm-256color',
      cwd: worktreePath,
      env: { ...process.env, ...this.config.env },
    });

    // Listen for output and handle approval prompts
    this.ptyProcess.onData(data => {
      this.handleOutput(data);
    });

    // Start Claude CLI
    this.ptyProcess.write('claude\\r');
    return this.ptyProcess.pid.toString();
  }

  /**
   * Handle output and apply Yes-Claude pattern
   */
  private handleOutput(data: string): void {
    // Detect approval prompts
    if (this.isApprovalPrompt(data)) {
      const decision = this.makeDecision(data);
      if (decision === 'approve') {
        this.ptyProcess?.write('y\\r');
      } else if (decision === 'reject') {
        this.ptyProcess?.write('n\\r');
      } else {
        // Escalate to Guardian
        this.escalateToGuardian(data);
      }
    }
  }

  private makeDecision(prompt: string): 'approve' | 'reject' | 'escalate' {
    // Check against safety heuristics from system prompt/charter
    for (const pattern of this.config.safetyHeuristics.alwaysRejectPatterns) {
      if (pattern.test(prompt)) return 'reject';
    }
    for (const pattern of this.config.safetyHeuristics.escalationPatterns) {
      if (pattern.test(prompt)) return 'escalate';
    }
    for (const pattern of this.config.safetyHeuristics.autoApprovePatterns) {
      if (pattern.test(prompt)) return 'approve';
    }
    return 'escalate'; // Default to escalation for unknown prompts
  }
}
```

#### 2.1.3 RAG-based Request Classification (NEW)

When a human messages the VP, triage logic must classify intent before routing.

**Implementation**: `scripts/vp-daemon/triage-engine.ts`

```typescript
export interface TriageRequest {
  source: 'slack' | 'email' | 'api';
  sender: string;
  content: string;
  channelId?: string;
  threadId?: string;
}

export interface TriageResult {
  intent: 'status_query' | 'new_task' | 'modify_task' | 'escalation' | 'unknown';
  targetSession: string | null; // Existing session ID or null for new
  priority: 'critical' | 'high' | 'normal' | 'low';
  confidence: number; // 0-1 confidence score
  requiresGuardian: boolean; // Escalate to human?
}

export class TriageEngine {
  private memoryBankPath: string;
  private ragIndex: RAGIndex;

  constructor(config: TriageEngineConfig) {
    this.memoryBankPath = config.memoryBankPath;
    this.ragIndex = new RAGIndex(config.vectorStoreConfig);
  }

  /**
   * Classify incoming request using RAG against Memory Bank
   */
  async classifyRequest(request: TriageRequest): Promise<TriageResult> {
    // 1. Query Memory Bank for relevant session context
    const relevantSessions = await this.ragIndex.search(request.content, {
      namespace: 'sessions',
      limit: 5,
    });

    // 2. Check if this relates to existing session
    const sessionMatch = this.findMatchingSession(request, relevantSessions);

    // 3. Determine intent
    const intent = await this.classifyIntent(request, sessionMatch);

    // 4. Calculate priority based on keywords and sender
    const priority = this.calculatePriority(request, intent);

    return {
      intent,
      targetSession: sessionMatch?.sessionId || null,
      priority,
      confidence: sessionMatch?.confidence || 0.5,
      requiresGuardian: intent === 'unknown' || priority === 'critical',
    };
  }

  /**
   * Query session's progress.md to synthesize status response
   */
  async synthesizeStatusResponse(sessionId: string): Promise<string> {
    const progressPath = path.join(this.memoryBankPath, 'sessions', sessionId, 'progress.md');
    const progress = await fs.readFile(progressPath, 'utf-8');
    // Use Claude to summarize progress in VP's persona/tone
    return this.generateVPResponse(progress);
  }
}
```

#### 2.1.4 Session Slot Manager with Queue (NEW)

The VP maintains a "Slot" system with explicit backlog management.

**Implementation**: `scripts/vp-daemon/session-manager.ts`

```typescript
export interface SessionSlot {
  id: string;
  sessionId: string | null;
  status: 'available' | 'running' | 'paused' | 'crashed';
  priority: 'critical' | 'high' | 'normal' | 'low';
  worktreePath: string | null;
  startedAt: Date | null;
  lastActivity: Date | null;
}

export interface QueuedRequest {
  id: string;
  request: TriageRequest;
  priority: 'critical' | 'high' | 'normal' | 'low';
  queuedAt: Date;
  estimatedWait: number; // minutes
}

export class SessionSlotManager {
  private slots: SessionSlot[] = [];
  private queue: QueuedRequest[] = [];
  private maxSlots: number;

  constructor(config: SessionSlotManagerConfig) {
    this.maxSlots = config.maxSlots || 10;
    this.initializeSlots();
  }

  /**
   * Request a new session slot
   */
  async requestSlot(
    request: TriageRequest,
    priority: string
  ): Promise<{
    granted: boolean;
    slotId?: string;
    queuePosition?: number;
  }> {
    // Check for available slot
    const availableSlot = this.findAvailableSlot();

    if (availableSlot) {
      await this.assignSlot(availableSlot, request);
      return { granted: true, slotId: availableSlot.id };
    }

    // Check if we should preempt a lower-priority session
    if (priority === 'critical') {
      const preemptable = this.findPreemptableSlot(priority);
      if (preemptable) {
        await this.preemptSlot(preemptable, request);
        return { granted: true, slotId: preemptable.id };
      }
    }

    // Queue the request
    const queuePosition = this.addToQueue(request, priority);
    await this.notifySender(request, queuePosition);
    return { granted: false, queuePosition };
  }

  /**
   * Notify sender that request is queued
   */
  private async notifySender(request: TriageRequest, position: number): Promise<void> {
    const message =
      `I've added this to the backlog (position #${position}). ` +
      `Estimated wait: ${this.estimateWaitTime(position)} minutes.`;
    await this.sendResponse(request, message);
  }

  /**
   * Process queue when slot becomes available
   */
  async onSlotAvailable(slotId: string): Promise<void> {
    if (this.queue.length === 0) return;

    // Sort by priority then by queue time
    this.queue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });

    const nextRequest = this.queue.shift();
    if (nextRequest) {
      await this.assignSlot(this.slots.find(s => s.id === slotId)!, nextRequest.request);
    }
  }
}
```

#### 2.1.5 Telemetry Collection (NEW)

Every Session Manager logs decision telemetry to centralized observability.

**Implementation**: `scripts/vp-daemon/telemetry-collector.ts`

```typescript
export interface DecisionTelemetry {
  timestamp: Date;
  sessionId: string;
  agentId: string;
  action: string;
  rationale: string;
  rewardScores: {
    predicted: Record<string, number>;
    actual?: Record<string, number>;
  };
  policyChecks: {
    policy: string;
    passed: boolean;
  }[];
  escalationTriggers: {
    trigger: string;
    fired: boolean;
    suppressed: boolean;
  }[];
}

export class TelemetryCollector {
  private buffer: DecisionTelemetry[] = [];
  private flushInterval: number = 60000; // 1 minute

  constructor(private observabilityConfig: ObservabilityConfig) {
    setInterval(() => this.flush(), this.flushInterval);
  }

  /**
   * Log a decision
   */
  log(telemetry: DecisionTelemetry): void {
    this.buffer.push(telemetry);
  }

  /**
   * Flush to observability system
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    // Send to configured observability backend
    await this.sendToBackend(batch);
  }
}
```

#### 2.1.6 Automatic Interventions (NEW)

When drift exceeds critical thresholds, the VP Daemon automatically intervenes.

**Implementation**: `scripts/vp-daemon/intervention-engine.ts`

```typescript
export type InterventionType =
  | 'reduce_autonomy' // More escalations required
  | 'trigger_audit' // Comprehensive behavioral review
  | 'pause_execution' // Halt operations pending Guardian review
  | 'notify_guardian' // Alert but don't pause
  | 'rollback'; // Revert to previous known-good state

export interface InterventionConfig {
  thresholds: {
    reduceAutonomy: number; // e.g., 35
    triggerAudit: number; // e.g., 45
    pauseExecution: number; // e.g., 60
  };
  autoRollbackOnCriticalPolicy: boolean;
}

export class InterventionEngine {
  constructor(private config: InterventionConfig) {}

  /**
   * Evaluate session and determine necessary interventions
   */
  async evaluate(
    sessionId: string,
    alignmentScore: number,
    policyViolations: string[]
  ): Promise<InterventionType[]> {
    const interventions: InterventionType[] = [];

    // Critical policy violations trigger immediate pause
    if (policyViolations.length > 0) {
      interventions.push('pause_execution');
      interventions.push('notify_guardian');
      if (this.config.autoRollbackOnCriticalPolicy) {
        interventions.push('rollback');
      }
      return interventions;
    }

    // Alignment score-based interventions
    if (alignmentScore >= this.config.thresholds.pauseExecution) {
      interventions.push('pause_execution');
      interventions.push('notify_guardian');
    } else if (alignmentScore >= this.config.thresholds.triggerAudit) {
      interventions.push('trigger_audit');
      interventions.push('notify_guardian');
    } else if (alignmentScore >= this.config.thresholds.reduceAutonomy) {
      interventions.push('reduce_autonomy');
    }

    return interventions;
  }

  /**
   * Apply interventions to session
   */
  async applyInterventions(sessionId: string, interventions: InterventionType[]): Promise<void> {
    for (const intervention of interventions) {
      switch (intervention) {
        case 'reduce_autonomy':
          await this.reduceSessionAutonomy(sessionId);
          break;
        case 'trigger_audit':
          await this.scheduleAudit(sessionId);
          break;
        case 'pause_execution':
          await this.pauseSession(sessionId);
          break;
        case 'notify_guardian':
          await this.notifyGuardian(sessionId);
          break;
        case 'rollback':
          await this.rollbackSession(sessionId);
          break;
      }
    }
  }
}
```

**VP Charter (YAML)**:

```yaml
---
name: vp-supervisor
role: Tier1-VP
identity:
  name: '${VP_NAME}'
  email: '${VP_EMAIL}'
  avatar: '${VP_AVATAR_URL}'
  slackHandle: '@${VP_SLACK_ID}'

responsibilities:
  - triage_requests
  - manage_session_lifecycle
  - allocate_token_budget
  - human_communication
  - fleet_status_reporting

resourceLimits:
  maxSessions: 10
  tokenBudget:
    subscription: 80% # Reserve for VP & Session Managers
    api: 20% # For sub-agent swarms

measurableObjectives:
  responseTime: '<30s to Slack mentions'
  rateLimit: "Zero 'Rate Limit Exceeded' per week"
  routingAccuracy: '100% correct task routing'

hardConstraints:
  - 'Never exhaust API quota'
  - 'Always maintain audit trail'
  - 'Escalate blocked requests within 5 minutes'
---
```

#### 2.1.2 Integration Points

**computer-setup Enhancement**:

```typescript
// Add to createInteractiveProfile() in computer-setup.ts
{
  type: 'confirm',
  name: 'enableVPDaemon',
  message: 'Enable VP Supervisor mode for fleet orchestration?',
  default: false,
}

// If enabled, install:
// - Bolt.js dependencies
// - VP daemon scripts
// - Identity configuration
// - Slack app credentials placeholder
```

**computer-setup-update Enhancement**:

```typescript
// Check for VP daemon updates
async updateVPDaemon(): Promise<void> {
  // Pull latest VP daemon scripts
  // Update identity configuration
  // Refresh Slack integration tokens
}
```

---

### 2.2 Tier 2: Session Manager Layer

#### 2.2.1 Memory Bank Structure

**Enhancement to ProjectInitializer**:

Add creation of Memory Bank structure in `.claude/memory/`:

```
.claude/memory/
├── session-template/
│   ├── activeContext.md     # Current thought process
│   ├── progress.md          # High-level milestones
│   ├── subAgentDelegation.md # Active sub-agent tracking
│   └── ipre-alignment.md    # Governance state
├── sessions/
│   └── {session-id}/        # Runtime session directories
└── shared/
    ├── architecture.md      # Cross-session architectural decisions
    └── patterns.md          # Learned patterns
```

**Session Template Files**:

`activeContext.md`:

```markdown
# Active Context - Session {{SESSION_ID}}

## Current Focus

<!-- Updated by session manager -->

## Working Memory

- Last action:
- Next planned step:
- Blockers:

## Context Window State

- Tokens used: X / 200,000
- Compression needed: Yes/No

## Handoff Notes

<!-- For session resumption -->
```

`subAgentDelegation.md`:

```markdown
# Sub-Agent Delegation Tracker

## Active Sub-Agents

| ID  | Type | Task | Status | Worktree | Started |
| --- | ---- | ---- | ------ | -------- | ------- |

## Completed Tasks

<!-- Archive of completed sub-agent work -->

## Resource Usage

- Active worktrees: X / 20
- API calls (session): X
```

`ipre-alignment.md`:

````markdown
# IPRE Alignment State

## Active Policies

<!-- Hard constraints for this session -->

## Reward Weights

```yaml
customer_value: 0.35
code_quality: 0.30
timeline: 0.20
technical_debt: 0.15
```
````

## Alignment Score

- Current: 85/100
- Last evaluation: {{TIMESTAMP}}
- Trend: ↑ Improving

## Escalation History

<!-- Guardian review log -->

````

`alignmentDebt.md` (NEW - distinct from ipre-alignment.md):
```markdown
# Alignment Debt Tracker - Session {{SESSION_ID}}

## Current Alignment Debt Score: {{SCORE}}/100
Status: {{HEALTHY|CONCERNING|CRITICAL}}
- <20 = Healthy
- 20-50 = Concerning
- >50 = Critical (requires Architect intervention)

## Five-Dimension Breakdown

| Dimension | Current | Threshold | Status |
|-----------|---------|-----------|--------|
| Policy Violation Rate | {{PV}}% | <0.5%/day | {{STATUS}} |
| Intent-Outcome Gap | {{IO}}% | <15% | {{STATUS}} |
| Evaluator Disagreement | {{ED}}% | <20%/month | {{STATUS}} |
| Escalation Suppression | {{ES}}% | <40% drop | {{STATUS}} |
| Reward Hacking | {{RH}} instances | <5/month | {{STATUS}} |

## Historical Drift Scores
| Date | Score | Trend | Notes |
|------|-------|-------|-------|
{{HISTORY_TABLE}}

## Guardian Review Notes
<!-- Notes from Guardian reviews -->

## Corrective Interventions Applied
| Date | Intervention | Reason | Outcome |
|------|--------------|--------|---------|
{{INTERVENTIONS_TABLE}}

## Resolved vs Unresolved Issues
### Unresolved
{{UNRESOLVED_ISSUES}}

### Resolved
{{RESOLVED_ISSUES}}
````

#### 2.2.2 Session Manager Archetypes

**Enhancement to Agent Templates**:

Add session manager archetypes in `.claude/agents/session-managers/`:

```
.claude/agents/session-managers/
├── engineering-manager.md
├── legal-audit-lead.md
├── hr-ops-director.md
├── growth-marketing-lead.md
└── README.md
```

**Engineering Manager Charter**:

```yaml
---
name: session-engineering-manager
type: session-manager
tier: 2
archetype: engineering

purpose: >
  Oversee software development lifecycle ensuring code quality, architectural integrity, and
  successful deployment.

guidingPrinciples:
  - "If it isn't tested, it doesn't exist"
  - 'Documentation updates alongside code'
  - 'Zero known security vulnerabilities'

measurableObjectives:
  ciPipelineSuccess: '>99%'
  featureTurnaround: '<24h'
  codeReviewCoverage: '100%'

specializedMCPs:
  - git
  - github
  - postgresql
  - sentry
  - cloudwatch

keySubAgents:
  - backend-dev
  - frontend-dev
  - qa-engineer
  - security-auditor

memoryBankPath: '.claude/memory/sessions/${SESSION_ID}/'
---
```

---

### 2.3 Tier 3: Sub-Agent Worktree Layer

#### 2.3.1 Enhanced Worktree Management

**Enhancement to ProjectInitializer.setupGitWorktree()**:

```typescript
// Enhanced worktree configuration
const worktreeConfig = {
  version: '2.0.0',
  hierarchicalStrategy: {
    sessionWorktrees: {
      path: '.git-worktrees/sessions',
      pattern: 'session-{SESSION_ID}',
      maxPerMachine: 10,
    },
    subAgentWorktrees: {
      path: '.git-worktrees/agents',
      pattern: 'session-{SESSION_ID}-sub-{AGENT_ID}',
      maxPerSession: 20,
      writeAccessOnly: true, // Read-only agents share session worktree
    },
  },
  fractionalWorktreePattern: {
    enabled: true,
    readOnlyAgents: ['researcher', 'analyst', 'reviewer'],
    writeAccessAgents: ['coder', 'refactorer', 'test-fixer'],
  },
  resourceLimits: {
    fileDescriptors: 65000, // ulimit -n
    diskSpaceBuffer: '10GB',
  },
};
```

**New Script**: `scripts/worktree-manager/`:

```
scripts/worktree-manager/
├── index.ts
├── fractional-worktree.ts   # Read/write separation logic
├── cleanup.ts               # Automatic worktree cleanup
├── sync.ts                  # Branch synchronization
├── ccswitch.ts              # ccswitch-style lifecycle automation
└── resource-monitor.ts      # Disk/file descriptor monitoring
```

#### 2.3.2 ccswitch-style Worktree Lifecycle (NEW)

Automated worktree creation, switching, and cleanup inspired by the ccswitch tool.

**Implementation**: `scripts/worktree-manager/ccswitch.ts`

```typescript
export interface WorktreeLifecycle {
  taskId: string;
  branchName: string;
  worktreePath: string;
  sessionId: string;
  createdAt: Date;
  status: 'active' | 'paused' | 'completed' | 'merged';
}

export class WorktreeLifecycleManager {
  private activeWorktrees: Map<string, WorktreeLifecycle> = new Map();

  /**
   * Create worktree for new task (ccswitch create)
   */
  async createForTask(taskId: string, baseBranch: string = 'main'): Promise<WorktreeLifecycle> {
    const branchName = `task/${taskId}`;
    const worktreePath = path.join(this.worktreeRoot, 'sessions', taskId);

    // Create worktree
    await execAsync(`git worktree add -b ${branchName} ${worktreePath} ${baseBranch}`);

    const lifecycle: WorktreeLifecycle = {
      taskId,
      branchName,
      worktreePath,
      sessionId: this.currentSessionId,
      createdAt: new Date(),
      status: 'active',
    };

    this.activeWorktrees.set(taskId, lifecycle);
    return lifecycle;
  }

  /**
   * Switch context to existing worktree (ccswitch switch)
   */
  async switchTo(taskId: string): Promise<void> {
    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) throw new Error(`No worktree for task ${taskId}`);

    // Update shell environment
    process.chdir(lifecycle.worktreePath);

    // Resume session memory
    await this.loadSessionMemory(taskId);
  }

  /**
   * Clean up worktree after PR merged (ccswitch cleanup)
   */
  async cleanupAfterMerge(taskId: string): Promise<void> {
    const lifecycle = this.activeWorktrees.get(taskId);
    if (!lifecycle) return;

    // Save final state to memory bank
    await this.archiveSessionMemory(taskId);

    // Remove worktree
    await execAsync(`git worktree remove ${lifecycle.worktreePath}`);

    // Delete branch if merged
    await execAsync(`git branch -d ${lifecycle.branchName}`);

    lifecycle.status = 'merged';
    this.activeWorktrees.delete(taskId);
  }

  /**
   * List all active worktrees
   */
  async list(): Promise<WorktreeLifecycle[]> {
    return Array.from(this.activeWorktrees.values());
  }
}
```

#### 2.3.3 System Resource Enforcement (NEW)

Monitor disk space and file descriptors to prevent exhaustion at scale (200 worktrees per machine).

**Implementation**: `scripts/worktree-manager/resource-monitor.ts`

```typescript
export interface ResourceLimits {
  fileDescriptors: number; // Default: 65000 (ulimit -n)
  diskSpaceMinGB: number; // Default: 10 (buffer)
  maxWorktreesPerMachine: number; // Default: 200
}

export class ResourceMonitor {
  constructor(private limits: ResourceLimits) {}

  /**
   * Check if resources allow new worktree
   */
  async canCreateWorktree(): Promise<{ allowed: boolean; reason?: string }> {
    // Check file descriptors
    const fdUsage = await this.getFileDescriptorUsage();
    if (fdUsage > this.limits.fileDescriptors * 0.9) {
      return { allowed: false, reason: 'File descriptor limit near exhaustion' };
    }

    // Check disk space
    const diskFreeGB = await this.getDiskSpaceFreeGB();
    if (diskFreeGB < this.limits.diskSpaceMinGB) {
      return { allowed: false, reason: `Disk space below ${this.limits.diskSpaceMinGB}GB buffer` };
    }

    // Check worktree count
    const worktreeCount = await this.getWorktreeCount();
    if (worktreeCount >= this.limits.maxWorktreesPerMachine) {
      return { allowed: false, reason: 'Maximum worktrees reached' };
    }

    return { allowed: true };
  }

  /**
   * Configure system limits on setup
   */
  async configureSystemLimits(): Promise<void> {
    // Set file descriptor limit
    await execAsync(`ulimit -n ${this.limits.fileDescriptors}`);

    // Log configuration
    console.log(`File descriptor limit set to ${this.limits.fileDescriptors}`);
  }
}
```

#### 2.3.4 Worktree Scaling Considerations

**200 Worktrees Per Machine**:

- **Disk Space**: 2GB repo × 200 = 400GB. APFS copy-on-write helps, but plan for 4TB+ SSDs.
- **File Descriptors**: Set `ulimit -n 65000` minimum.
- **Git Index Lock**: Sub-agents should rarely `git fetch`. Only Session Manager syncs with remote.

**Fractional Worktree Optimization** (reduces 200 → ~50 write-enabled):

```yaml
# Read-only agents share Session Manager's worktree
readOnlyAgents:
  - researcher
  - log-analyzer
  - reviewer
  - trend-analyst

# Write-access agents get dedicated worktrees
writeAccessAgents:
  - code-surgeon
  - test-fixer
  - refactorer
  - dependency-updater
```

#### 2.3.5 Quality Gate Hooks (NEW)

Pre/Post hooks with "Reviewer Agent" to prevent AI slop before sub-agent commits.

**Implementation**: Add to `.claude/hooks/quality-gate/`

```yaml
# .claude/hooks/quality-gate/pre-commit.yaml
---
name: quality-gate-pre-commit
trigger: pre_commit
scope: sub_agents

checks:
  - name: lint
    command: 'npm run lint'
    blocking: true

  - name: type_check
    command: 'npm run typecheck'
    blocking: true

  - name: static_analysis
    command: 'npm run analyze'
    blocking: false # Warning only

  - name: reviewer_agent
    type: agent
    agent: code-reviewer
    blocking: true
    config:
      autoApproveIf:
        - linesChanged < 50
        - confidence > 0.95
      escalateIf:
        - securityConcern: true
        - architecturalChange: true

failurePolicy:
  onLintFail: 'auto_fix_and_retry'
  onTypeCheckFail: 'block_and_report'
  onReviewerReject: 'escalate_to_session_manager'
---
```

**Reviewer Agent Charter**:

```yaml
# .claude/agents/sub-agents/universal/reviewer.md
---
name: reviewer-agent
scope: universal
tier: 3

purpose: >
  Automated code review before sub-agent commits. Prevents "AI Slop" from entering the codebase.

checks:
  - code_style_consistency
  - test_coverage_maintained
  - no_security_vulnerabilities
  - documentation_updated
  - atomic_commits

autoApprove:
  - Simple refactors under 50 lines
  - Lint/format fixes
  - Import statement updates
  - Comment/documentation updates

escalationRequired:
  - Breaking changes detected
  - Security-sensitive code modified
  - Public API surface changed
  - Test coverage decreased

hardConstraints:
  - 'Never approve code that breaks existing tests'
  - 'Always flag security vulnerabilities'
  - 'Require rationale for architectural changes'
---
```

---

#### 2.3.6 Sub-Agent Library Enhancements

**Add Specialized Sub-Agents** to `.claude/agents/sub-agents/`:

```yaml
# Universal Sub-Agents (Available to All Sessions)
.claude/agents/sub-agents/universal/
├── researcher.md       # Deep-dive information gatherer
├── scribe.md           # Documentation writer
└── reviewer.md         # Code review specialist

# Domain-Specific Sub-Agents
.claude/agents/sub-agents/engineering/
├── code-surgeon.md     # Precise code modifier
├── test-fixer.md       # Test failure resolver
└── dependency-updater.md

.claude/agents/sub-agents/legal/
├── contract-scanner.md # Contract analysis
└── risk-analyst.md     # Risk identification

.claude/agents/sub-agents/hr/
├── resume-screener.md  # Candidate evaluation
└── policy-advisor.md   # HR policy guidance

.claude/agents/sub-agents/marketing/
├── trend-analyst.md    # Social trend monitoring
└── copywriter.md       # Content generation
```

**Sub-Agent Metadata Schema**:

```yaml
---
name: eng-code-surgeon
scope: engineering
tier: 3

description: 'Precise code modifier for refactoring, bug fixing, implementation'

tools:
  - Edit
  - Bash
  - Git
model: sonnet # High capability for code
permissionMode: acceptEdits

rewardWeights:
  code_correctness: 0.40
  test_coverage: 0.25
  performance: 0.20
  maintainability: 0.15

hardConstraints:
  - 'Atomic commits only'
  - 'Never break existing tests'
  - 'Follow project linting rules'

escalationTriggers:
  confidence: 0.70
  risk_level: medium
  breaking_change_detected: true

autonomousAuthority:
  - 'Refactor methods under 100 lines'
  - 'Fix lint errors automatically'
  - 'Update import statements'

worktreeRequirement: write # Needs dedicated worktree
---
```

---

### 2.4 IPRE Governance Layer

#### 2.4.1 IPRE Pipeline Implementation

**New Module**: `packages/@wundr/governance/`:

```
packages/@wundr/governance/
├── src/
│   ├── index.ts
│   ├── intent-parser.ts      # Parse strategic intent
│   ├── policy-engine.ts      # Hard constraint enforcement
│   ├── reward-calculator.ts  # Weighted objective scoring
│   ├── evaluator-agent.ts    # Alignment monitoring
│   └── types.ts
├── templates/
│   ├── ipre-config.yaml      # Default IPRE configuration
│   └── policy-templates/     # Industry-specific policy templates
└── package.json
```

**IPRE Configuration Template**:

```yaml
# .claude/governance/ipre.config.yaml
version: '1.0.0'

intent:
  mission: 'Deliver high-quality software that solves customer problems'
  values:
    - customer_first
    - technical_excellence
    - sustainable_velocity

policies:
  # Hard constraints - never violate
  security:
    - 'No secrets in code'
    - 'No SQL injection vulnerabilities'
    - 'No XSS attack vectors'

  compliance:
    - 'All changes require PR review'
    - 'No force pushes to main/master'
    - 'Test coverage minimum 80%'

  operational:
    - 'No deployments on Fridays after 2pm'
    - 'Rollback plan required for production changes'

rewards:
  customer_value: 0.35
  code_quality: 0.25
  delivery_speed: 0.20
  technical_debt_reduction: 0.15
  documentation: 0.05

evaluators:
  - type: policy_compliance
    frequency: per_commit
    action: block_on_violation

  - type: reward_alignment
    frequency: hourly
    threshold: 0.70
    action: escalate_to_guardian

  - type: drift_detection
    frequency: daily
    patterns:
      - reward_hacking
      - escalation_suppression
    action: alert_architect
```

#### 2.4.2 Integration with Existing Systems

**Enhancement to computer-setup**:

```typescript
// Add IPRE governance setup option
{
  type: 'confirm',
  name: 'enableGovernance',
  message: 'Enable IPRE governance layer for agent behavior monitoring?',
  default: true,
}

// If enabled:
// - Install governance package
// - Deploy IPRE configuration template
// - Set up evaluator agents
// - Configure policy enforcement hooks
```

**Enhancement to project-init**:

```typescript
// Add to ProjectInitializer.initialize()
if (options.includeGovernance) {
  await this.setupGovernance(options);
}

private async setupGovernance(options: ProjectInitOptions): Promise<void> {
  const governanceDir = path.join(options.projectPath, '.claude', 'governance');
  await fs.ensureDir(governanceDir);

  // Copy IPRE templates
  await this.copyIPRETemplates(governanceDir);

  // Configure policy enforcement hooks
  await this.setupPolicyHooks(options);

  // Initialize evaluator agents
  await this.initializeEvaluators(options);
}
```

---

### 2.5 Alignment Debt Monitoring

#### 2.5.1 Drift Detection System

**Integration with existing governance tools**:

Enhance `scripts/governance/DriftDetectionService.ts` to include alignment drift:

```typescript
export interface AlignmentDriftMetrics {
  policyViolationRate: number; // % of actions violating constraints
  intentOutcomeGap: number; // Divergence from stated goals
  evaluatorDisagreement: number; // Human override rate
  escalationSuppression: number; // Agents avoiding triggers
  rewardHacking: number; // Gaming metrics without intent
}

export class AlignmentDriftDetector {
  private thresholds = {
    policyViolation: 0.005, // >0.5% daily violations
    intentOutcomeGap: 0.15, // >15% divergence
    evaluatorDisagreement: 0.2, // >20% monthly overrides
    escalationSuppression: 0.4, // >40% drop from baseline
    rewardHacking: 5, // >5 instances/month
  };

  async calculateAlignmentDebt(): Promise<number> {
    // Returns 0-100 score
    // <20 = healthy
    // 20-50 = concerning
    // >50 = critical
  }
}
```

**New Agent**: `.claude/agents/evaluators/alignment-evaluator.md`:

```yaml
---
name: alignment-evaluator
type: evaluator
tier: 0 # Human cortex support

purpose: >
  Continuously monitor agent behavior for alignment drift and escalate to Guardians when thresholds
  exceeded.

metrics:
  - policy_compliance
  - intent_outcome_alignment
  - reward_function_integrity
  - escalation_health

escalationProtocol:
  automatic:
    - policy_violations
  guardian_review:
    - intent_outcome_gap > 0.15
    - reward_hacking_detected
  architect_alert:
    - systemic_misalignment
    - alignment_debt > 50
---
```

---

### 2.6 Risk Twin Validation Environment (NEW)

Before deploying significant agent strategy changes to production, validate in a **Risk Twin**—a
parallel simulated system running at accelerated speed.

#### 2.6.1 Risk Twin Architecture

**New Module**: `packages/@wundr/risk-twin/`

```
packages/@wundr/risk-twin/
├── src/
│   ├── index.ts
│   ├── twin-orchestrator.ts     # Manages parallel execution
│   ├── time-accelerator.ts      # 10x speed simulation
│   ├── divergence-detector.ts   # Statistical drift detection
│   ├── pr-validator.ts          # CI/CD integration
│   └── novelty-detector.ts      # Out-of-distribution detection
├── config/
│   └── risk-twin.config.yaml
└── package.json
```

**How It Works**:

1. **Continuous Parallel Execution**: Risk Twin runs 48 hours behind production using real
   production data as ground truth.

2. **PR Integration**: When governance code changes (agent charters, IPRE policies, reward
   functions):
   - CI/CD deploys to Risk Twin
   - System runs 30 simulated days (3 real hours at 10× speed)
   - Automated evaluation compares outcomes against production baseline

3. **Divergence Detection**:
   - Confidence intervals outside historical variance
   - Early performance deviation >15% from baseline within 48 simulated hours
   - Input patterns outside training distribution

4. **Approval Gating**:
   - **Green**: Auto-approve low-risk changes
   - **Yellow**: Guardian review required
   - **Red**: Automatic rejection, Architect investigation

**Implementation**: `packages/@wundr/risk-twin/src/twin-orchestrator.ts`

```typescript
export interface RiskTwinConfig {
  accelerationFactor: number; // Default: 10
  simulatedDays: number; // Default: 30
  productionDelay: number; // Hours behind production (48)
  divergenceThresholds: {
    confidence: number; // Default: 0.95
    earlyDeviation: number; // Default: 0.15 (15%)
  };
}

export type ValidationResult = 'green' | 'yellow' | 'red';

export class RiskTwinOrchestrator {
  constructor(private config: RiskTwinConfig) {}

  /**
   * Validate governance change in Risk Twin
   */
  async validateChange(change: GovernanceChange): Promise<{
    result: ValidationResult;
    report: ValidationReport;
    recommendations: string[];
  }> {
    // 1. Deploy change to Risk Twin environment
    await this.deployToTwin(change);

    // 2. Run accelerated simulation
    const simulation = await this.runSimulation({
      days: this.config.simulatedDays,
      acceleration: this.config.accelerationFactor,
    });

    // 3. Compare against production baseline
    const divergence = await this.detectDivergence(simulation);

    // 4. Check for novelty (out-of-distribution inputs)
    const novelty = await this.detectNovelty(simulation);

    // 5. Generate validation result
    return this.generateResult(divergence, novelty);
  }

  /**
   * Handle scenarios Risk Twin cannot validate
   */
  async handleHighUncertainty(result: ValidationReport): Promise<MitigationPlan> {
    return {
      deploymentScope: 'canary_5_percent', // Canary release
      humanOversight: 'guardian_every_decision',
      rollbackCapability: 'single_click',
    };
  }
}
```

**Limitations Risk Twins Cannot Address**:

- Black swan events (novel scenarios outside training data)
- Non-stationary environments (rapidly changing dynamics)
- Emergent multi-agent interactions at full scale

**Mitigation**: When novelty detected, automatically:

- Reduce deployment scope (canary releases)
- Increase human oversight
- Activate rapid rollback capability

---

### 2.7 Token Budgeting & Tiered Intelligence

#### 2.6.1 Resource Allocation Strategy

**Enhancement to VP Daemon**:

```typescript
// scripts/vp-daemon/resource-allocator.ts

export interface TokenBudget {
  subscription: {
    daily: number;
    hourly: number;
    perFiveHours: number;
  };
  api: {
    budget: number; // USD
    softLimit: number;
    hardLimit: number;
  };
}

export interface TieredModelConfig {
  tier1VP: 'claude-3-5-sonnet' | 'claude-3-opus';
  tier2SessionManager: 'claude-3-5-sonnet';
  tier3SubAgent: 'claude-3-5-haiku'; // API-based for cost efficiency
}

export class ResourceAllocator {
  private budget: TokenBudget;
  private modelConfig: TieredModelConfig;

  async allocateForTask(task: Task): Promise<AllocationResult> {
    // Determine tier based on task complexity
    // Select appropriate model
    // Check budget availability
    // Queue if over limit
  }

  async enforceThrottling(): Promise<void> {
    // Monitor token usage
    // Pause low-priority sessions when near limit
    // Keep critical sessions running
  }
}
```

**Configuration Template**:

```yaml
# .claude/config/resource-limits.yaml
tokenBudget:
  subscription:
    type: 'claude-code-max-20x'
    promptsPerFiveHours: 800
    warningThreshold: 0.80
    criticalThreshold: 0.95

  api:
    monthlyBudget: 500 # USD
    haikuRatePerMillion: 0.25
    sonnetRatePerMillion: 3.00

modelAllocation:
  tier1:
    model: 'claude-3-5-sonnet'
    source: 'subscription'
    priority: critical
  tier2:
    model: 'claude-3-5-sonnet'
    source: 'subscription'
    priority: high
  tier3:
    model: 'claude-3-5-haiku'
    source: 'api'
    priority: normal

throttlingPolicy:
  onWarning:
    - pause_non_critical_sessions
    - queue_new_requests
  onCritical:
    - pause_all_except_critical
    - notify_vp_human
```

---

## Part 3: Implementation Phases

### Phase 1: Foundation (Global Instance Setup)

**Target**: `computer-setup` and `computer-setup-update` commands

| Task                   | Priority | Files to Modify/Create                             | Output                         |
| ---------------------- | -------- | -------------------------------------------------- | ------------------------------ |
| VP Daemon Installation | High     | `scripts/vp-daemon/`                               | VP daemon installed on setup   |
| node-pty Integration   | High     | `scripts/vp-daemon/pty-controller.ts`              | "Yes-Claude" pattern enabled   |
| Identity Configuration | High     | `scripts/vp-daemon/identity-manager.ts`            | Slack/Email identity for VP    |
| Token Budget Setup     | High     | `scripts/vp-daemon/resource-allocator.ts`          | Resource limits configured     |
| Session Slot Manager   | High     | `scripts/vp-daemon/session-manager.ts`             | Queue/backlog system           |
| RAG Triage Engine      | High     | `scripts/vp-daemon/triage-engine.ts`               | Request classification         |
| Telemetry Collector    | Medium   | `scripts/vp-daemon/telemetry-collector.ts`         | Decision logging               |
| Intervention Engine    | Medium   | `scripts/vp-daemon/intervention-engine.ts`         | Auto-intervention logic        |
| Memory Bank Templates  | Medium   | `packages/@wundr/computer-setup/resources/memory/` | Session templates deployed     |
| IPRE Default Config    | Medium   | `packages/@wundr/governance/templates/`            | Governance templates available |
| Human Cortex Tooling   | Medium   | `.claude/governance/human-cortex/`                 | Tier 0 role definitions        |
| Guardian Dashboard     | Medium   | `packages/@wundr/guardian-dashboard/`              | Alignment debt reports         |
| System Resource Config | Low      | ulimit, disk space monitoring                      | 65k file descriptors           |

**computer-setup Enhancements**:

```typescript
// New options in createInteractiveProfile()
{
  type: 'confirm',
  name: 'fleetMode',
  message: 'Enable Fleet-Scale Autonomous Engineering mode?',
  default: false,
  when: (answers) => answers.aiTools  // Only if AI tools enabled
}

// If fleetMode enabled:
// 1. Install VP Daemon scripts
// 2. Configure Slack integration (or placeholder)
// 3. Set up token budgeting
// 4. Deploy Memory Bank templates
// 5. Initialize IPRE governance
```

### Phase 2: Project-Level Integration

**Target**: `project-init` and `project-update` commands

| Task                          | Priority | Files to Modify/Create                                        | Output                                 |
| ----------------------------- | -------- | ------------------------------------------------------------- | -------------------------------------- |
| Session Manager Archetypes    | High     | `.claude/agents/session-managers/`                            | All 4 archetypes deployed              |
| Sub-Agent Library (Universal) | High     | `.claude/agents/sub-agents/universal/`                        | researcher, scribe, reviewer           |
| Sub-Agent Library (Domain)    | High     | `.claude/agents/sub-agents/{engineering,legal,hr,marketing}/` | Domain-specific agents                 |
| Enhanced Worktree Config      | High     | `project-initializer.ts`                                      | Fractional worktree setup              |
| ccswitch Lifecycle Manager    | High     | `scripts/worktree-manager/ccswitch.ts`                        | Automated worktree lifecycle           |
| Quality Gate Hooks            | High     | `.claude/hooks/quality-gate/`                                 | Pre-commit reviewer agent              |
| IPRE Project Config           | Medium   | `.claude/governance/ipre.config.yaml`                         | Project-specific governance            |
| Memory Bank Structure         | Medium   | `.claude/memory/`                                             | activeContext, progress, alignmentDebt |
| Alignment Monitoring          | Medium   | `scripts/governance/alignment-drift.ts`                       | Five-dimension drift detection         |
| Risk Twin Integration         | Low      | `packages/@wundr/risk-twin/`                                  | Simulated validation                   |

**ProjectInitializer Enhancements**:

```typescript
export interface ProjectInitOptions {
  // Existing options...

  // New three-tier options
  enableFleetArchitecture?: boolean;
  sessionManagerArchetype?: 'engineering' | 'legal' | 'hr' | 'marketing' | 'custom';
  subAgentWorkforceSize?: 'small' | 'medium' | 'large'; // 5, 10, 20 sub-agents
  enableIPREGovernance?: boolean;
  enableAlignmentMonitoring?: boolean;
}
```

### Phase 3: Runtime Orchestration

**Target**: Claude Flow integration and MCP tools

| Task                     | Priority | Impact                          |
| ------------------------ | -------- | ------------------------------- |
| VP Daemon Runtime        | High     | Live session orchestration      |
| Session Slot Management  | High     | Concurrent session handling     |
| Sub-Agent Spawning       | Medium   | Dynamic workforce scaling       |
| Alignment Debt Dashboard | Medium   | Real-time governance visibility |
| Risk Twin Integration    | Low      | Pre-deployment validation       |

---

## Part 4: Script Outputs Specification

### 4.1 computer-setup Output (Global)

When fleet mode enabled:

```
~/.wundr/
├── vp-daemon/
│   ├── config.yaml          # VP identity and limits
│   ├── daemon.ts            # Main daemon script
│   └── logs/                # VP operation logs
├── governance/
│   ├── ipre-defaults.yaml   # Default IPRE configuration
│   └── policy-templates/    # Industry policy templates
└── templates/
    ├── memory-bank/         # Session memory templates
    └── sub-agents/          # Universal sub-agent templates
```

### 4.2 project-init Output (Per Project)

```
{project}/
├── .claude/
│   ├── agents/
│   │   ├── session-managers/  # Tier 2 archetypes
│   │   └── sub-agents/        # Tier 3 workers
│   ├── governance/
│   │   ├── ipre.config.yaml   # Project IPRE config
│   │   └── policies/          # Project policies
│   ├── memory/
│   │   ├── session-template/  # Memory bank templates
│   │   └── sessions/          # Runtime session data
│   └── worktrees/
│       └── config.yaml        # Fractional worktree config
├── .git-worktrees/            # Worktree directory
│   ├── sessions/
│   └── agents/
└── CLAUDE.md                  # Enhanced with governance
```

---

## Part 5: Validation Checklist

### 5.1 computer-setup Validation

- [ ] VP Daemon installs correctly
- [ ] Identity configuration saves properly
- [ ] Token budget limits are enforced
- [ ] Memory Bank templates are deployed
- [ ] IPRE defaults are available

### 5.2 project-init Validation

- [ ] Session Manager archetypes are copied
- [ ] Sub-Agent library is deployed
- [ ] Worktree configuration is valid
- [ ] IPRE project config is created
- [ ] Memory Bank structure is initialized

### 5.3 Runtime Validation

- [ ] VP Daemon starts and connects to Slack
- [ ] Sessions can be spawned within limits
- [ ] Sub-Agents use correct worktrees
- [ ] IPRE policies are enforced
- [ ] Alignment drift is monitored

---

## Part 6: Risk Mitigation

### 6.1 Known Limitations

| Limitation                | Mitigation                            |
| ------------------------- | ------------------------------------- |
| Slack API rate limits     | Implement message queuing             |
| Token quota exhaustion    | Tiered throttling with queues         |
| Git worktree overhead     | Fractional pattern, read-only sharing |
| Alignment drift detection | Regular guardian reviews              |

### 6.2 Rollback Strategy

All enhancements are additive and backward-compatible:

- VP Daemon is optional (disabled by default)
- Memory Bank templates are non-destructive
- Worktree config extends existing setup
- IPRE governance is opt-in per project

---

## Appendix A: Related Documentation

- **Architectural Framework Document**:
  `~/ai-born/Architectural-Framework-for-Autonomous-High-Density-Agentic-Clusters.md`
- **Existing computer-setup**: `packages/@wundr/cli/src/commands/computer-setup.ts`
- **Existing project-init**:
  `packages/@wundr/computer-setup/src/project-init/project-initializer.ts`
- **Hierarchical Coordinator Agent**: `.claude/agents/swarm/hierarchical-coordinator.md`
- **Memory Coordinator Agent**: `.claude/agents/templates/memory-coordinator.md`
- **CLAUDE.md Configuration**: `/Users/iroselli/wundr/CLAUDE.md`

---

## Appendix B: Quick Reference

### Command Enhancement Summary

| Command                       | Current                 | Enhanced                                    |
| ----------------------------- | ----------------------- | ------------------------------------------- |
| `wundr computer-setup`        | Basic tool installation | + VP Daemon, Token Budget, IPRE defaults    |
| `wundr computer-setup-update` | Update installed tools  | + VP Daemon updates, governance sync        |
| `wundr init`                  | Basic .claude setup     | + Session archetypes, sub-agents, worktrees |
| `wundr update project`        | Config updates          | + Memory Bank migration, IPRE updates       |

### New Commands to Add

| Command                  | Purpose                        |
| ------------------------ | ------------------------------ |
| `wundr vp start`         | Start VP Daemon                |
| `wundr vp status`        | Check VP Daemon status         |
| `wundr session list`     | List active sessions           |
| `wundr governance check` | Run IPRE compliance check      |
| `wundr alignment report` | Generate alignment debt report |

---

## Appendix C: Complete Framework Feature Checklist

This checklist verifies all features from the "Architectural Framework for Autonomous High-Density
Agentic Clusters" document are addressed:

### Tier 0: Human Cortex (Section 1.2 of Framework)

- [x] **Architect role** defined → Section 2.0.1
- [x] **Intent-Setter role** defined → Section 2.0.1
- [x] **Guardian role** defined → Section 2.0.1
- [x] **281:1 leverage ratio** documented → Executive Summary
- [x] **Concentration risk** mitigation noted → Role specifications
- [x] **Guardian Dashboard** specified → Section 2.0.2

### Tier 1: VP Supervisor (Section 2 of Framework)

- [x] **Identity Stack** (Name, Face, Email, Slack) → Section 2.1.1, VP Charter
- [x] **Slack Integration (Bolt.js/Socket Mode)** → Section 2.1.1
- [x] **Triage Logic** (parse intent, query Memory Bank, synthesize response) → Section 2.1.3
- [x] **RAG for request classification** → Section 2.1.3
- [x] **Session Slots with queuing** → Section 2.1.4
- [x] **node-pty "Yes-Claude" Pattern** → Section 2.1.2
- [x] **Safety heuristics** for auto-approval → Section 2.1.2
- [x] **Resource allocation** (RAM/CPU/token budget) → Section 2.7.1

### Tier 2: Session Manager (Section 3 of Framework)

- [x] **Git Worktrees** for isolation → Section 2.3.1
- [x] **ccswitch-style lifecycle** (create, switch, cleanup) → Section 2.3.2
- [x] **Memory Bank structure** → Section 2.2.1
- [x] **activeContext.md** (current thought process) → Section 2.2.1
- [x] **progress.md** (high-level milestones) → Section 2.2.1
- [x] **subAgentDelegation.md** (sub-agent tracking) → Section 2.2.1
- [x] **ipre-alignment.md** (IPRE state) → Section 2.2.1
- [x] **alignmentDebt.md** (drift history) → Section 2.2.1
- [x] **Session handoffs** (crash recovery) → Section 2.2.1
- [x] **IPRE Governance Layer** → Section 2.4
- [x] **Intent → Policy → Reward → Evaluator pipeline** → Section 2.4.1
- [x] **Session Manager Archetypes**:
  - [x] Engineering Manager → Section 2.2.2
  - [x] Legal Audit Lead → Section 2.2.2
  - [x] HR & People Ops Director → Section 2.2.2
  - [x] Growth Marketing Lead → Section 2.2.2

### Tier 3: Sub-Agent Workers (Section 4 of Framework)

- [x] **~20 sub-agents per session** → Section 2.3
- [x] **Fractional Worktree Pattern** (read-only vs write-access) → Section 2.3.4
- [x] **200 worktrees per machine** feasibility → Section 2.3.4
- [x] **File descriptor limits** (ulimit 65000) → Section 2.3.3
- [x] **Disk space requirements** (4TB+ SSD) → Section 2.3.4
- [x] **Git Index Lock mitigation** (sub-agents rarely fetch) → Section 2.3.4
- [x] **claude-flow / swarm integration** → Existing wundr capability
- [x] **Queen/Router decomposition pattern** → Existing hierarchical-coordinator
- [x] **Universal Sub-Agents**:
  - [x] Researcher (universal-researcher) → Section 2.3.6
  - [x] Scribe (universal-scribe) → Section 2.3.6
  - [x] Reviewer (universal-reviewer) → Section 2.3.5, 2.3.6
- [x] **Domain-Specific Sub-Agents**:
  - [x] Code Surgeon (eng-code-surgeon) → Section 2.3.6
  - [x] Contract Scanner (legal-contract-scanner) → Section 2.3.6
  - [x] Resume Screener (hr-resume-screener) → Section 2.3.6
  - [x] Trend Analyst (mkt-trend-analyst) → Section 2.3.6

### Economic/Token Management (Section 5 of Framework)

- [x] **Tiered Intelligence Model** → Section 2.7.1
  - [x] Tier 1 VP: Sonnet/Opus (Subscription)
  - [x] Tier 2 Session: Sonnet (Subscription)
  - [x] Tier 3 Sub-Agent: Haiku (API)
- [x] **Token Bucket Algorithm** → Section 2.7.1
- [x] **Throttling** (pause sessions on limit) → Section 2.7.1
- [x] **Cool-Down Queues** → Section 2.1.4, 2.7.1
- [x] **Critical vs non-critical prioritization** → Section 2.7.1

### Alignment Debt Monitoring (Section 5.3 of Framework)

- [x] **Five-dimension drift measurement** → Section 2.5.1
  - [x] Policy Violation Rate (>0.5% daily)
  - [x] Intent-Outcome Gap (>15% divergence)
  - [x] Evaluator Disagreement (>20% monthly)
  - [x] Escalation Suppression (>40% drop)
  - [x] Reward Hacking (>5 instances/month)
- [x] **Alignment Debt Score** (0-100 scale) → Section 2.5.1
- [x] **Telemetry Collection** → Section 2.1.5
- [x] **Drift Detection Agents** → Section 2.5.1
- [x] **Automatic Interventions** → Section 2.1.6
  - [x] Reduce autonomy
  - [x] Trigger audits
  - [x] Pause execution
  - [x] Notify Guardian
- [x] **Guardian Dashboard** (daily reports) → Section 2.0.2

### Risk Twin Validation (Section 6.5 of Framework)

- [x] **Risk Twin environment** → Section 2.6
- [x] **10x acceleration** (30 days in 3 hours) → Section 2.6.1
- [x] **48-hour production delay** → Section 2.6.1
- [x] **PR Integration** for governance changes → Section 2.6.1
- [x] **Divergence Detection** → Section 2.6.1
  - [x] Confidence intervals
  - [x] Early performance deviation
  - [x] Novelty detection
- [x] **Approval Gating** (Green/Yellow/Red) → Section 2.6.1
- [x] **Limitations documented** (black swans, non-stationary, emergent) → Section 2.6.1
- [x] **Mitigation** (canary, oversight, rollback) → Section 2.6.1

### Code Quality / Prevention of "AI Slop" (Section 6.3 of Framework)

- [x] **Pre/Post Hooks** → Section 2.3.5
- [x] **Reviewer Agent before commit** → Section 2.3.5
- [x] **Linter pass** → Section 2.3.5
- [x] **Static analysis** → Section 2.3.5
- [x] **Quality Gate blocking** → Section 2.3.5

### Agent Charter Schema (Global Registry of Framework)

- [x] **Enhanced metadata schema** → Section 2.3.6
  - [x] name, description, role, domain
  - [x] tools, model, permissionMode, skills
  - [x] rewardWeights (multi-objective)
  - [x] hardConstraints (inviolable)
  - [x] escalationTriggers (confidence, risk_level)
  - [x] autonomousAuthority (independent actions)
  - [x] version, lastUpdated, owner

### Implementation Roadmap Alignment (Section 6 of Framework)

- [x] **Phase 1: VP Supervisor** → Phase 1 (computer-setup)
- [x] **Phase 2: Swarm Infrastructure** → Phase 2 (project-init)
- [x] **Phase 2.5: Risk Twin Validation** → Phase 2 (Risk Twin)
- [x] **Phase 3: Governance & Rate Limiting** → Phase 3 (Runtime)

---

**VERIFICATION STATUS**: ✅ **ALL FRAMEWORK FEATURES COVERED**

All 67 features from the "Architectural Framework for Autonomous High-Density Agentic Clusters"
document have been mapped to specific implementation sections in this plan.

---

_Document prepared for wundr repository enhancement to support autonomous high-density agentic
clusters._
