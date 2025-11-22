---
title: Human Cortex Governance
tier: 0
type: overview
description: Tier 0 Human Cortex responsibilities and governance model
version: '1.0.0'
---

# Human Cortex - Tier 0 Governance

## Overview

The Human Cortex represents Tier 0 in the three-tier autonomous agent architecture. Unlike
traditional management roles, the Human Cortex does not directly manage agents but instead
**architects the conditions for autonomous operation**.

## Core Philosophy

The Human Cortex operates on the principle of **design for autonomy, intervene by exception**:

1. **Design Phase**: Humans architect systems, protocols, and constraints that enable agents to
   operate autonomously
2. **Runtime Phase**: Agents execute within designed parameters without human intervention
3. **Exception Phase**: Humans engage only when escalation thresholds are breached

## Tier 0 Responsibilities

### What Human Cortex Does

- **Architects** the VP-Session-SubAgent hierarchy
- **Designs** coordination protocols and communication patterns
- **Structures** Memory Bank systems for context persistence
- **Specifies** isolation architectures for security boundaries
- **Validates** Risk Twin configurations and shadow execution models
- **Sets** strategic intent and hard policy constraints
- **Deploys** evaluator agents for autonomous quality control

### What Human Cortex Does NOT Do

- Micromanage individual agent tasks
- Make routine operational decisions
- Directly execute work that agents can perform
- Monitor every agent action in real-time

## Governance Model

```
Human Cortex (Tier 0)
    |
    |-- Architects: Design system structure
    |-- Intent-Setters: Define goals and constraints
    |-- Guardians: Handle escalations and audits
    |
    v
VP Agents (Tier 1) - Domain orchestration
    |
    v
Session/SubAgents (Tier 2) - Task execution
```

## Key Artifacts

Human Cortex produces governance artifacts that enable autonomous operation:

| Artifact                | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| Agent Charters          | Define agent capabilities, boundaries, and authorities |
| Coordination Patterns   | Specify inter-agent communication protocols            |
| Escalation Logic        | Define when and how issues escalate to humans          |
| IPRE Pipeline Configs   | Configure Intent-Prompt-Response-Evaluation cycles     |
| Policy Specifications   | Hard constraints agents must never violate             |
| Reward Function Designs | Define success metrics and optimization targets        |

## Roles

The Human Cortex comprises three specialized roles:

1. **[Architect](roles/architect.md)** - Designs the structural foundation for autonomous operation
2. **[Intent-Setter](roles/intent-setter.md)** - Articulates strategic goals and constraints
3. **[Guardian](roles/guardian.md)** - Reviews escalations and maintains system integrity

## Design Principles

### 1. Autonomy by Default

Systems should operate without human intervention under normal conditions. Human involvement is the
exception, not the rule.

### 2. Explicit Boundaries

All constraints, policies, and escalation thresholds must be explicitly defined and documented.
Agents should never have to guess about boundaries.

### 3. Memory Bank Continuity

Human knowledge and decisions persist in Memory Banks, ensuring continuity even when specific humans
are unavailable.

### 4. Concentration Risk Mitigation

No single human should be a single point of failure. Knowledge, authority, and capabilities are
distributed and documented.

### 5. Structured Escalation

Escalation paths are well-defined with clear criteria. Agents know exactly when to escalate and to
whom.

## Success Metrics

Human Cortex effectiveness is measured by:

- **Autonomy Rate**: Percentage of tasks completed without human intervention
- **Escalation Quality**: Escalations are appropriate and actionable
- **System Uptime**: Architecture enables continuous operation
- **Knowledge Persistence**: Memory Banks capture institutional knowledge
- **Recovery Speed**: Time to restore operations after disruptions

## Related Documentation

- [Three-Tier Architecture Implementation Plan](../../../docs/THREE-TIER-ARCHITECTURE-IMPLEMENTATION-PLAN.md)
- [Architect Role](roles/architect.md)
- [Intent-Setter Role](roles/intent-setter.md)
- [Guardian Role](roles/guardian.md)
