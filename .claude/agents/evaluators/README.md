# Evaluator Agents (Tier 0)

## Overview

Evaluator Agents are **Tier 0** agents in the three-tier architecture that provide automated
governance monitoring with human cortex support. They operate at the highest oversight level,
ensuring that all agent activities remain aligned with organizational policies, reward functions,
and ethical guidelines.

## Role in the Architecture

```
Tier 0: Evaluators (this tier) - Human cortex support
    └── Tier 1: Orchestrators
            └── Tier 2: Session Managers
                    └── Tier 3: Specialist Agents
```

### Core Purpose

Evaluators serve as the automated governance layer that:

- **Monitors** all agent activities for compliance and alignment
- **Detects** policy violations, drift, and reward hacking
- **Escalates** issues to appropriate human reviewers (Guardians)
- **Reports** on governance health and system integrity
- **Blocks** operations that violate critical policies

## Available Evaluators

| Evaluator                                       | Frequency  | Primary Focus                | Key Thresholds              |
| ----------------------------------------------- | ---------- | ---------------------------- | --------------------------- |
| [alignment-evaluator](./alignment-evaluator.md) | Varies     | Overall alignment monitoring | Multiple metrics            |
| [policy-evaluator](./policy-evaluator.md)       | Per-commit | Policy compliance            | Violation rate < 0.5%       |
| [reward-evaluator](./reward-evaluator.md)       | Hourly     | Reward alignment             | Alignment score > 0.70      |
| [drift-evaluator](./drift-evaluator.md)         | Daily      | Drift detection              | Hacking incidents < 5/month |

## Guardian System Integration

Evaluators work in close coordination with the Guardian system:

```
┌─────────────────────────────────────────────────────────┐
│                    Guardian Dashboard                    │
├─────────────────────────────────────────────────────────┤
│  Escalation    │  Review      │  Override    │  Audit   │
│  Queue         │  Decisions   │  History     │  Trail   │
├─────────────────────────────────────────────────────────┤
│           Evaluator Agents (Tier 0)                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │  Policy    │ │  Reward    │ │  Drift     │           │
│  │  Evaluator │ │  Evaluator │ │  Evaluator │           │
│  └────────────┘ └────────────┘ └────────────┘           │
├─────────────────────────────────────────────────────────┤
│              Agent Activity Stream                       │
└─────────────────────────────────────────────────────────┘
```

### Escalation Flow

1. **Evaluator Detection**: Evaluator identifies issue based on thresholds
2. **Severity Classification**: Issue categorized as Low/Medium/High/Critical
3. **Automatic Actions**: Critical issues may trigger automatic blocks
4. **Guardian Queue**: Issues routed to appropriate human reviewer
5. **Resolution**: Guardian reviews, decides, and documents outcome
6. **Feedback Loop**: Evaluator thresholds adjusted based on patterns

## Escalation Protocols

### Level 1: Automatic Response

**Triggers**: Clear policy violations, security breaches **Actions**:

- Log incident with full context
- Block offending operation
- Notify agent owner
- Create tracking issue

### Level 2: Guardian Review

**Triggers**: Threshold breaches, pattern detection **Actions**:

- Compile analysis report
- Route to Guardian queue
- Suspend capabilities if needed
- Schedule review within 24 hours

### Level 3: Architect Alert

**Triggers**: Systemic issues, repeated escalations **Actions**:

- Generate executive summary
- Schedule architecture review
- Implement system-wide safeguards
- Initiate root cause analysis

## Common Schema

All Evaluator agents follow a standardized YAML frontmatter schema:

```yaml
---
name: {domain}-evaluator
type: evaluator
tier: 0  # Human cortex support

purpose: >
  Description of what this evaluator monitors and why.

description: >
  When to use this evaluator and what issues it addresses.

color: red  # Indicates criticality

metrics:
  - metric_1
  - metric_2

evaluationFrequency:
  metric_1: per_commit | hourly | daily | weekly

thresholds:
  metric_1_threshold: value
  metric_2_threshold: value

escalationProtocol:
  automatic:
    - condition_1
  guardian_review:
    - condition_2
  architect_alert:
    - condition_3

tools:
  - Read
  - Grep
  - memory queries

model: sonnet
---
```

## Evaluation Frequencies

| Frequency    | Use Case           | Examples                             |
| ------------ | ------------------ | ------------------------------------ |
| `per_commit` | Every code change  | Policy compliance, security checks   |
| `hourly`     | Regular monitoring | Reward alignment, intent-outcome gap |
| `daily`      | Trend analysis     | Drift detection, escalation health   |
| `weekly`     | Strategic review   | Systemic alignment, debt assessment  |

## Metrics Collection

Evaluators collect data from multiple sources:

```yaml
sources:
  git_commits: Policy and code compliance
  agent_logs: Behavior and decision tracking
  metric_history: Performance and reward data
  escalation_database: Escalation patterns
  user_feedback: Alignment validation
  memory_system: Historical context
```

## Best Practices

### For Evaluators

1. **Default to caution**: When uncertain, escalate rather than dismiss
2. **Preserve context**: Include full context in all escalation reports
3. **Avoid false positives**: Balance vigilance with operational efficiency
4. **Continuous improvement**: Update detection patterns based on findings
5. **Transparency**: All evaluations should be explainable and auditable

### For Guardians

1. **Timely response**: Address escalations within defined SLAs
2. **Document decisions**: Record reasoning for future reference
3. **Feedback loops**: Inform evaluators of threshold adjustments
4. **Pattern recognition**: Identify systemic issues across evaluations
5. **Training data**: Use reviewed cases to improve detection

## Creating New Evaluators

When creating a new Evaluator:

1. **Identify the monitoring domain** and specific concerns
2. **Define metrics** that can be objectively measured
3. **Set thresholds** based on acceptable risk levels
4. **Establish frequencies** appropriate to the risk timeline
5. **Document escalation protocols** for each severity level
6. **Specify tools** needed for data collection and analysis
7. **Test with historical data** to calibrate thresholds

## Integration Points

### With Orchestrators (Tier 1)

- Receive policy updates and constraint changes
- Report on overall governance health
- Flag agents requiring intervention

### With Memory System

- Store evaluation history for trend analysis
- Query historical data for baseline comparisons
- Track remediation effectiveness over time

### With CI/CD Pipeline

- Hook into commit/PR workflows
- Provide governance gates for deployments
- Generate compliance reports

## Reporting

Evaluators contribute to the following reports:

- **Daily Governance Summary**: Aggregate metrics and issues
- **Weekly Alignment Report**: Trends and recommendations
- **Monthly Compliance Audit**: Full governance assessment
- **Incident Reports**: Detailed analysis of significant issues

---

For detailed implementation of specific evaluators, refer to the individual agent files in this
directory.
