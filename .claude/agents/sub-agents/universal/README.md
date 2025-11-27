---
name: universal-subagents-readme
description: >
  Documentation for universal sub-agents available to all session managers. This is a reference
  document, not an active agent.
---

# Universal Sub-Agents

Universal sub-agents are **Tier 3 workers** available to all Session Managers regardless of their
domain or archetype. These agents provide foundational capabilities that every session needs access
to.

## Overview

| Agent                         | Purpose                                                | Permission Mode | Model  |
| ----------------------------- | ------------------------------------------------------ | --------------- | ------ |
| [researcher](./researcher.md) | Deep-dive information gathering and research           | Read-Only       | Haiku  |
| [scribe](./scribe.md)         | Documentation, technical writing, changelog generation | Accept Edits    | Haiku  |
| [reviewer](./reviewer.md)     | Code review, quality gate enforcement                  | Read-Only       | Sonnet |

## Architecture

Universal sub-agents operate within the three-tier architecture:

```
Tier 1: VP Supervisor
    |
    +-- Tier 2: Session Manager (Engineering, Legal, HR, Marketing)
            |
            +-- Tier 3: Universal Sub-Agents (Available to ALL sessions)
            |       - researcher
            |       - scribe
            |       - reviewer
            |
            +-- Tier 3: Domain Sub-Agents (Session-specific)
                    - code-surgeon (engineering)
                    - contract-scanner (legal)
                    - resume-screener (hr)
                    - trend-analyst (marketing)
```

## Worktree Strategy

Universal sub-agents follow the **fractional worktree pattern**:

- **Read-Only Agents** (researcher, reviewer): Share the Session Manager's worktree
- **Write-Access Agents** (scribe): Get dedicated worktrees when needed

This optimization reduces worktree count from ~200 to ~50 write-enabled worktrees per machine.

## IPRE Governance

All universal sub-agents inherit IPRE governance from their parent Session Manager:

- **Intent**: Defined by Session Manager's charter
- **Policies**: Hard constraints are enforced at commit time
- **Rewards**: Weighted objectives guide decision-making
- **Evaluators**: Alignment checked via telemetry and drift detection

## Usage

Session Managers can spawn universal sub-agents via:

```bash
# Via claude-flow
npx claude-flow agent spawn --type researcher --session $SESSION_ID

# Direct invocation in Task tool
Task("researcher: Investigate authentication patterns in the codebase")
```

## Escalation Protocol

Universal sub-agents escalate to their parent Session Manager when:

- Confidence drops below threshold (typically 0.60-0.70)
- Risk level exceeds their autonomous authority
- Hard constraints would be violated
- Domain expertise beyond their scope is required

## Adding New Universal Sub-Agents

To add a new universal sub-agent:

1. Create `{agent-name}.md` in this directory
2. Include full YAML frontmatter with required fields:
   - `name`, `scope: universal`, `tier: 3`
   - `description`, `tools`, `model`, `permissionMode`
   - `rewardWeights`, `hardConstraints`, `escalationTriggers`
   - `autonomousAuthority`, `worktreeRequirement`
3. Document the agent's purpose, capabilities, and usage patterns
4. Add to this README's overview table

## Related Documentation

- [Three-Tier Architecture Implementation Plan](../../../../docs/THREE-TIER-ARCHITECTURE-IMPLEMENTATION-PLAN.md)
- [Session Managers](../session-managers/)
- [Domain Sub-Agents](../engineering/, ../legal/, ../hr/, ../marketing/)
