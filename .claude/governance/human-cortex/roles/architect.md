---
role: architect
tier: 0
count: '3-5 per organization'
domain: system-design
version: '1.0.0'
responsibilities:
  - Design VP-Session-SubAgent hierarchy
  - Define coordination protocols between agent tiers
  - Structure Memory Bank architectures for context persistence
  - Specify isolation architectures for security boundaries
  - Configure Risk Twin validation and shadow execution models
  - Document escalation logic and exception handling
outputs:
  - Agent charters defining capabilities and authorities
  - Coordination patterns for inter-agent communication
  - Escalation logic specifications
  - System architecture documentation
  - Memory Bank schema definitions
  - Isolation boundary specifications
concentration_risk:
  mitigation: Memory Bank continuity
  strategy: All architectural decisions documented in persistent stores
  redundancy: Multiple architects with overlapping domain knowledge
---

# Architect Role - Human Cortex (Tier 0)

## Role Definition

Architects design the structural foundation that enables autonomous agent operation. They create the
blueprints, protocols, and constraints that allow VP Agents and their subordinates to function
without constant human oversight.

## Core Responsibilities

### 1. VP-Session-SubAgent Hierarchy Design

Architects define the three-tier agent structure:

```
VP Agents (Tier 1)
├── Domain scope and authority
├── Coordination responsibilities
└── Escalation thresholds

Session Agents (Tier 2)
├── Task execution boundaries
├── Resource allocation limits
└── Quality checkpoints

SubAgents (Tier 2)
├── Specialized capabilities
├── Isolation requirements
└── Communication protocols
```

### 2. Coordination Protocol Design

Define how agents communicate and collaborate:

- **Synchronous Protocols**: Direct agent-to-agent communication patterns
- **Asynchronous Protocols**: Message queue and event-driven coordination
- **Consensus Mechanisms**: Decision-making protocols for distributed agents
- **Conflict Resolution**: Handling competing priorities and resource contention

### 3. Memory Bank Architecture

Structure persistent storage for agent context:

- **Schema Design**: Define data structures for different memory types
- **Access Patterns**: Specify read/write permissions by agent tier
- **Retention Policies**: Configure how long different data persists
- **Synchronization**: Design cross-agent memory sharing protocols

### 4. Isolation Architecture

Specify security and operational boundaries:

- **Execution Sandboxes**: Define isolated execution environments
- **Resource Quotas**: Set limits on compute, memory, and network usage
- **Data Boundaries**: Specify what data each agent can access
- **Blast Radius Containment**: Limit impact of agent failures

### 5. Risk Twin Validation

Configure shadow execution for risk assessment:

- **Twin Deployment**: Parallel execution environments for validation
- **Divergence Detection**: Identify when twin results differ
- **Rollback Triggers**: Define conditions for automatic rollback
- **Confidence Scoring**: Quantify certainty in agent decisions

## Output Artifacts

### Agent Charters

```yaml
# Example Agent Charter Structure
agent_id: vp-engineering
tier: 1
domain: software-development
authorities:
  - Approve code deployments under $X impact
  - Allocate compute resources within budget
  - Spawn session agents for defined task types
constraints:
  - Cannot modify production data directly
  - Must escalate security-related decisions
  - Cannot exceed allocated budget
escalation_triggers:
  - Confidence score below 0.7
  - Impact estimate exceeds authority threshold
  - Novel situation not covered by training
```

### Coordination Patterns

```yaml
# Example Coordination Pattern
pattern_id: parallel-review
participants:
  - code-review-agent
  - security-scan-agent
  - performance-test-agent
coordination_type: fork-join
timeout: 30m
failure_handling: partial-success-allowed
aggregation: consensus-required
```

### Escalation Logic

```yaml
# Example Escalation Logic
escalation_id: high-risk-deployment
triggers:
  - risk_score > 0.8
  - affected_users > 10000
  - revenue_impact > $50000
escalation_path:
  level_1: vp-engineering
  level_2: guardian-oncall
  level_3: architect-council
response_sla:
  level_1: 15m
  level_2: 1h
  level_3: 4h
```

## Concentration Risk Mitigation

### Problem

Loss of an architect should not halt system operation or prevent future evolution.

### Mitigation Strategies

1. **Memory Bank Continuity**
   - All architectural decisions recorded with rationale
   - Design patterns documented with context and alternatives considered
   - Decision logs capture the "why" not just the "what"

2. **Knowledge Distribution**
   - 3-5 architects per organization ensures redundancy
   - Overlapping domain expertise prevents single points of failure
   - Regular architecture reviews share knowledge across team

3. **Living Documentation**
   - Architecture Decision Records (ADRs) for significant choices
   - Runbooks for common architectural modifications
   - Automated documentation generation from system state

## Collaboration

### With Intent-Setters

- Translate strategic intent into architectural constraints
- Validate that architecture can support desired outcomes
- Propose technical alternatives for business requirements

### With Guardians

- Design escalation paths that guardians can effectively handle
- Create audit trails that support guardian reviews
- Define edge cases that require guardian judgment

### With VP Agents

- Receive feedback on architectural constraints
- Monitor architectural effectiveness metrics
- Iterate on designs based on operational experience

## Success Metrics

| Metric                              | Target                    | Measurement                           |
| ----------------------------------- | ------------------------- | ------------------------------------- |
| Architecture Documentation Coverage | >95%                      | Percentage of components with ADRs    |
| Knowledge Redundancy                | 2+ architects per domain  | Domain expertise mapping              |
| Design Effectiveness                | <5% escalation rate       | Escalations due to architectural gaps |
| Memory Bank Utilization             | >80% decision persistence | Decisions captured vs. made           |
