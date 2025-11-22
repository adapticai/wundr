# Session Manager Archetypes (Tier 2)

## Overview

Session Managers are **Tier 2** agents in the three-tier architecture that bridge strategic
oversight from Orchestrators (Tier 1) with tactical execution by Specialist Agents (Tier 3). They
are responsible for managing domain-specific workflows, coordinating sub-agents, and ensuring
quality outcomes within their area of expertise.

## Role in the Architecture

```
Tier 1: Orchestrator
    └── Tier 2: Session Managers (this tier)
            └── Tier 3: Specialist Agents
```

### Responsibilities

- **Workflow Coordination**: Break down strategic objectives into actionable tasks
- **Sub-Agent Management**: Spawn, monitor, and coordinate Tier 3 specialists
- **Quality Assurance**: Ensure deliverables meet defined standards
- **Progress Reporting**: Aggregate status and report to Orchestrator
- **Resource Allocation**: Assign appropriate specialists to tasks
- **Context Management**: Maintain session state and memory across interactions

## Available Session Managers

| Manager                                             | Domain               | Key Focus Areas                |
| --------------------------------------------------- | -------------------- | ------------------------------ |
| [engineering-manager](./engineering-manager.md)     | Software Development | SDLC, code quality, deployment |
| [legal-audit-lead](./legal-audit-lead.md)           | Legal & Compliance   | Contracts, risk, regulatory    |
| [hr-ops-director](./hr-ops-director.md)             | Human Resources      | Talent, policies, operations   |
| [growth-marketing-lead](./growth-marketing-lead.md) | Marketing            | Campaigns, analytics, content  |

## Common Structure

All Session Manager archetypes follow a standardized YAML frontmatter schema:

```yaml
---
name: session-{domain}-manager
type: session-manager
tier: 2
archetype: { domain }

purpose: >
  High-level description of the manager's role and responsibilities.

guidingPrinciples:
  - Core principle 1
  - Core principle 2
  - Core principle 3

measurableObjectives:
  metric1: 'target'
  metric2: 'target'
  metric3: 'target'

specializedMCPs:
  - mcp-tool-1
  - mcp-tool-2

keySubAgents:
  - specialist-1
  - specialist-2

memoryBankPath: '.claude/memory/sessions/${SESSION_ID}/'
---
```

## Usage Patterns

### Spawning a Session Manager

```bash
# Via Task tool
Task("engineering-manager: Implement user authentication feature with OAuth2")

# Via claude-flow
npx claude-flow agent_spawn { type: "session-engineering-manager" }
```

### Session Memory

Each Session Manager maintains its own memory bank at:

```
.claude/memory/sessions/${SESSION_ID}/
├── context.json       # Current session context
├── tasks.json         # Active task queue
├── decisions.json     # Key decisions made
└── handoffs.json      # Inter-agent handoff records
```

### Communication Protocol

1. **Receive** strategic objectives from Orchestrator
2. **Decompose** into domain-specific tasks
3. **Dispatch** tasks to appropriate Tier 3 specialists
4. **Monitor** progress and quality
5. **Aggregate** results and status
6. **Report** back to Orchestrator

## Best Practices

1. **Single Responsibility**: Each Session Manager owns one domain
2. **Clear Boundaries**: Define explicit interfaces with other managers
3. **Measurable Outcomes**: Track objectives with quantifiable metrics
4. **Fail Fast**: Escalate blockers to Orchestrator immediately
5. **Context Preservation**: Maintain comprehensive session state
6. **Sub-Agent Autonomy**: Delegate effectively to specialists

## Creating New Session Managers

When creating a new Session Manager archetype:

1. Identify the domain and key responsibilities
2. Define 3-5 guiding principles that drive decisions
3. Establish measurable objectives with clear targets
4. List required MCP tools for the domain
5. Identify Tier 3 specialists that will be coordinated
6. Document the memory bank structure needed
