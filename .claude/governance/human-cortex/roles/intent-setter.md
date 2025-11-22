---
role: intent-setter
tier: 0
count: '1-3 per domain'
domain: strategic-direction
version: '1.0.0'
responsibilities:
  - Articulate strategic intent and goals
  - Define hard constraints (inviolable policies)
  - Specify reward function weights and optimization targets
  - Deploy and configure evaluator agents
  - Design IPRE Pipeline configurations
outputs:
  - IPRE Pipeline configurations
  - Policy specifications (hard constraints)
  - Reward function designs
  - Evaluator agent deployment specs
  - Strategic intent documents
  - Success criteria definitions
collaboration:
  architects: Translate intent into architectural requirements
  guardians: Define escalation criteria and edge case handling
---

# Intent-Setter Role - Human Cortex (Tier 0)

## Role Definition

Intent-Setters articulate the strategic direction and constraints that guide autonomous agent
operation. They define **what** the system should achieve and **what it must never do**, without
specifying **how** agents should accomplish tasks.

## Core Responsibilities

### 1. Strategic Intent Articulation

Intent-Setters translate business objectives into clear, measurable goals:

```yaml
# Example Strategic Intent
intent_id: customer-satisfaction-optimization
domain: customer-service
objectives:
  primary: Maximize customer satisfaction scores
  secondary: Minimize response time
  tertiary: Reduce escalation to human agents
success_criteria:
  - CSAT score >= 4.5/5.0
  - Average response time < 2 minutes
  - Human escalation rate < 10%
time_horizon: quarterly
review_cadence: weekly
```

### 2. Hard Constraint Definition (Policies)

Define inviolable rules that agents must never break:

```yaml
# Example Policy Specification
policy_id: data-privacy-constraints
classification: hard-constraint
enforcement: mandatory
violations:
  severity: critical
  response: immediate-halt
constraints:
  - name: pii-protection
    rule: 'Never expose PII in logs or outputs'
    scope: all-agents

  - name: data-retention
    rule: 'Delete customer data after 90 days unless consent given'
    scope: data-processing-agents

  - name: geographic-restrictions
    rule: 'Process EU customer data only in EU regions'
    scope: infrastructure-agents
```

### 3. Reward Function Design

Specify how agent success is measured and weighted:

```yaml
# Example Reward Function
reward_function_id: code-quality-optimization
version: '2.1.0'
components:
  - metric: test_coverage
    weight: 0.25
    target: '>= 80%'

  - metric: code_review_score
    weight: 0.30
    target: '>= 4.0/5.0'

  - metric: deployment_success_rate
    weight: 0.25
    target: '>= 99%'

  - metric: incident_rate
    weight: 0.20
    target: '<= 0.1 per deployment'
    inverse: true # Lower is better

aggregation: weighted_harmonic_mean
normalization: min-max
update_frequency: daily
```

### 4. Evaluator Agent Deployment

Configure agents that assess other agents' work:

```yaml
# Example Evaluator Agent Spec
evaluator_id: code-quality-evaluator
type: autonomous-evaluator
deployment:
  tier: 1
  replicas: 3
  consensus_required: 2
evaluation_criteria:
  - criterion: correctness
    method: automated-testing
    threshold: 100% # All tests must pass

  - criterion: maintainability
    method: static-analysis
    threshold: 'complexity < 10'

  - criterion: security
    method: vulnerability-scan
    threshold: 'no critical/high findings'

actions:
  pass: approve-for-deployment
  fail: return-with-feedback
  uncertain: escalate-to-guardian
```

## IPRE Pipeline Configuration

The Intent-Prompt-Response-Evaluation pipeline is the core execution model:

### Pipeline Structure

```
Intent → Prompt → Response → Evaluation
   ↑                              |
   └──────── Feedback Loop ───────┘
```

### Configuration Example

```yaml
# Example IPRE Pipeline Config
pipeline_id: feature-development
version: '1.0.0'

intent_phase:
  source: product-backlog
  validation: intent-setter-approval
  format: structured-requirement

prompt_phase:
  template_id: feature-implementation
  context_injection:
    - codebase-context
    - architectural-constraints
    - coding-standards
  max_tokens: 8000

response_phase:
  executor: vp-engineering
  timeout: 4h
  checkpoints:
    - design-review: 30m
    - implementation: 3h
    - testing: 30m
  artifacts:
    - code-changes
    - test-suite
    - documentation

evaluation_phase:
  evaluators:
    - code-quality-evaluator
    - security-evaluator
    - performance-evaluator
  consensus: majority
  feedback_integration: automatic
  max_iterations: 3
```

## Output Artifacts

### Policy Specifications

Policies define absolute boundaries:

| Policy Type          | Description                         | Enforcement             |
| -------------------- | ----------------------------------- | ----------------------- |
| Security Policies    | Data protection, access control     | Hard block on violation |
| Compliance Policies  | Regulatory requirements             | Audit trail required    |
| Business Policies    | Brand, legal, financial constraints | Escalation on violation |
| Operational Policies | Resource limits, SLAs               | Automatic throttling    |

### Reward Function Designs

Reward functions guide optimization:

```yaml
# Reward Function Template
name: [descriptive-name]
version: [semver]
domain: [applicable-domain]
components:
  - metric: [measurable-value]
    weight: [0.0-1.0]
    target: [threshold-or-range]
    direction: [maximize|minimize]
constraints:
  - [hard-limits-that-override-optimization]
calibration:
  baseline: [historical-reference]
  adjustment_frequency: [how-often-to-recalibrate]
```

### IPRE Pipeline Configs

Complete pipeline specifications enable autonomous execution cycles:

- **Intent**: What should be accomplished
- **Prompt**: How to frame the task for agents
- **Response**: Expected deliverables and quality bars
- **Evaluation**: How success is measured

## Collaboration Model

### With Architects

- Provide strategic requirements for architectural decisions
- Validate that proposed architectures can achieve intent
- Negotiate trade-offs between competing objectives

### With Guardians

- Define escalation criteria based on policy violations
- Specify edge cases requiring human judgment
- Review guardian decisions to refine policies

### With VP Agents

- Communicate strategic priorities and shifts
- Receive feedback on goal achievability
- Adjust reward functions based on operational data

## Anti-Patterns to Avoid

1. **Over-specification**: Defining "how" instead of "what"
2. **Conflicting Objectives**: Goals that create impossible trade-offs
3. **Unmeasurable Intent**: Goals without clear success criteria
4. **Static Policies**: Never updating constraints based on learning
5. **Reward Hacking Blindness**: Not monitoring for gaming behavior

## Success Metrics

| Metric              | Target                   | Measurement                         |
| ------------------- | ------------------------ | ----------------------------------- |
| Intent Clarity      | >90% agent comprehension | Agent success rate on first attempt |
| Policy Coverage     | 100% critical scenarios  | Gap analysis audits                 |
| Reward Alignment    | <5% gaming incidents     | Detected optimization shortcuts     |
| Pipeline Efficiency | <3 iterations average    | Feedback loop cycles                |
