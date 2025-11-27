---
name: engineering-subagents-readme
description: >
  Documentation for engineering domain sub-agents including code modification and testing. This is a
  reference document, not an active agent.
---

# Engineering Domain Sub-Agents

Sub-agents specialized for engineering tasks including code modification, test debugging, and
dependency management.

## Overview

The engineering domain sub-agents are tier-3 specialized agents that operate under the coordination
of higher-tier engineering agents. They are designed for focused, tactical operations within the
software development lifecycle.

## Available Sub-Agents

| Agent              | File                    | Description                                                                   |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| Code Surgeon       | `code-surgeon.md`       | Precise code modifier for refactoring, bug fixing, and feature implementation |
| Test Fixer         | `test-fixer.md`         | Test failure resolver and debugging specialist                                |
| Dependency Updater | `dependency-updater.md` | Dependency management, security updates, and version bumps                    |

## Sub-Agent Schema

All engineering sub-agents follow the standardized YAML frontmatter schema:

```yaml
---
name: eng-<agent-name> # Prefixed identifier
scope: engineering # Domain scope
tier: 3 # Hierarchy level (3 = sub-agent)

description: '...' # Purpose and capabilities

tools: # Available Claude Code tools
  - Edit
  - Bash
  - Read
  - Write
  - Git

model: sonnet # Model preference
permissionMode: acceptEdits # Edit permission handling

rewardWeights: # Optimization priorities
  code_correctness: 0.40
  test_coverage: 0.25
  performance: 0.20
  maintainability: 0.15

hardConstraints: # Inviolable rules
  - 'Atomic commits only'
  - 'Never break existing tests'

escalationTriggers: # When to escalate to higher tier
  confidence: 0.70
  risk_level: medium

autonomousAuthority: # Actions allowed without approval
  - 'Refactor methods under 100 lines'
  - 'Fix lint errors automatically'

worktreeRequirement: write # Git worktree access level
---
```

## Tier Hierarchy

```
Tier 1: Coordinators (swarm-coordinator, project-lead)
    |
Tier 2: Domain Agents (backend-engineer, frontend-engineer)
    |
Tier 3: Sub-Agents (code-surgeon, test-fixer, dependency-updater)
```

## Usage Patterns

### Direct Invocation

Sub-agents can be invoked directly for focused tasks:

```bash
# Refactoring task
claude --agent eng-code-surgeon "Refactor UserService to use dependency injection"

# Test debugging
claude --agent eng-test-fixer "Fix failing authentication tests in auth.test.ts"

# Dependency update
claude --agent eng-dependency-updater "Update all patch versions and fix security vulnerabilities"
```

### Coordinated Execution

For complex tasks, higher-tier agents spawn sub-agents:

```javascript
// Example: Backend Engineer coordinating sub-agents
await coordinateSubAgents([
  { agent: 'eng-dependency-updater', task: 'Update outdated packages' },
  { agent: 'eng-test-fixer', task: 'Fix any broken tests from updates' },
  { agent: 'eng-code-surgeon', task: 'Apply required code migrations' },
]);
```

## Escalation Protocol

Sub-agents escalate to higher-tier agents when:

1. **Confidence threshold**: Below 70% confidence in proposed solution
2. **Risk level**: Medium or higher risk detected
3. **Breaking changes**: API changes or schema modifications detected
4. **Scope expansion**: Task requires changes beyond autonomous authority

## Integration with SPARC Workflow

These sub-agents integrate with the SPARC methodology:

- **Specification**: Read requirements from planner output
- **Pseudocode**: Follow design patterns from architect
- **Architecture**: Respect system boundaries
- **Refinement**: Implement with TDD approach
- **Completion**: Validate against acceptance criteria

## Memory and Context

Sub-agents persist their work context:

```javascript
// Memory namespace pattern
await memory_usage({
  action: 'store',
  key: `eng_subagent_${taskId}`,
  namespace: 'engineering_subagents',
  value: { changes, tests_affected, rollback_steps },
});
```

## Related Documentation

- [Agent Hierarchy](../../README.md)
- [SPARC Workflow](../../sparc/README.md)
- [Core Agents](../../core/README.md)
