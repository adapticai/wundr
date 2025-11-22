---
role: guardian
tier: 0
count: '2-4 per domain, rotating'
domain: oversight-and-escalation
version: '1.0.0'
responsibilities:
  - Review flagged escalations from VP agents
  - Adjudicate edge cases not covered by policies
  - Train and calibrate evaluator agents
  - Audit agent outputs for quality and compliance
  - Maintain escalation response SLAs
outputs:
  - Escalation decisions and rationale
  - Edge case rulings (precedent-setting)
  - Evaluator training feedback
  - Audit reports and findings
  - Policy refinement recommendations
burnout_mitigation:
  rotation: weekly-oncall-rotation
  workload_limits: 'max 4 hours escalation duty per day'
  coverage: 'minimum 2 guardians per domain for redundancy'
  escalation_caps: 'max 10 escalations per guardian per day'
---

# Guardian Role - Human Cortex (Tier 0)

## Role Definition

Guardians serve as the human safety net in the autonomous agent system. They handle exceptions, edge
cases, and escalations that fall outside the boundaries of automated decision-making. Guardians
ensure system integrity while enabling continuous autonomous operation.

## Core Responsibilities

### 1. Escalation Review

Guardians review and resolve escalations from VP Agents:

```yaml
# Example Escalation Review Process
escalation_id: ESC-2024-001234
source_agent: vp-customer-service
escalation_reason: confidence_below_threshold
context:
  customer_request: 'Refund for service used 45 days ago'
  policy_reference: '30-day refund policy'
  agent_confidence: 0.45
  risk_assessment: medium

guardian_review:
  decision: approve_exception
  rationale: |
    Customer is long-standing (5+ years) with high lifetime value.
    Service issue was partially our fault (documented outage).
    Exception aligns with customer retention strategic intent.
  precedent: creates_exception_pattern
  policy_update_recommended: true

resolution_time: 12m
```

### 2. Edge Case Adjudication

Handle novel situations not covered by existing policies:

```yaml
# Edge Case Categories
categories:
  - name: policy_gaps
    description: Situations where no policy applies
    response: Make judgment call, document for policy update

  - name: policy_conflicts
    description: Multiple policies give contradictory guidance
    response: Determine priority, escalate if unclear

  - name: novel_scenarios
    description: Entirely new situation types
    response: Apply principles, create precedent

  - name: high_stakes_decisions
    description: Decisions with significant impact
    response: Careful review, may involve architect/intent-setter
```

### 3. Evaluator Agent Training

Calibrate and improve evaluator agents:

```yaml
# Evaluator Training Process
training_type: feedback_loop
evaluator_id: code-quality-evaluator

training_data:
  - evaluation_id: EVAL-001
    agent_assessment: pass
    guardian_assessment: fail
    correction_reason: 'Missed security vulnerability in dependency'
    weight: high # Security is critical

  - evaluation_id: EVAL-002
    agent_assessment: fail
    guardian_assessment: pass
    correction_reason: 'Style preference, not functional issue'
    weight: low # Calibrate strictness

training_outcome:
  model_update: scheduled
  confidence_adjustment: -0.05 for security evaluations
  new_rules_added: 2
```

### 4. Output Auditing

Regular review of agent work for quality and compliance:

```yaml
# Audit Schedule
audit_type: random_sampling
sample_rate: 5% # Of all agent outputs
domains:
  - customer-service: weekly
  - code-deployment: daily
  - financial-transactions: continuous

audit_criteria:
  - policy_compliance: hard_requirement
  - quality_standards: threshold_based
  - efficiency_metrics: trend_monitoring

findings_routing:
  critical: immediate_escalation
  major: weekly_review_meeting
  minor: monthly_summary
```

## Burnout Mitigation

Guardian work is high-stakes and cognitively demanding. The role includes built-in protections:

### Rotation Schedule

```yaml
rotation_policy:
  oncall_duration: 1 week
  minimum_guardians: 2 per domain
  handoff_overlap: 2 hours
  mandatory_break: 2 weeks between oncall rotations

coverage_requirements:
  business_hours: 2 guardians minimum
  off_hours: 1 guardian minimum
  holidays: reduced coverage with clear escalation
```

### Workload Limits

```yaml
workload_limits:
  daily_escalation_cap: 10 per guardian
  continuous_duty_max: 4 hours
  mandatory_breaks: 15 min per 2 hours
  complex_case_limit: 3 per day

overflow_handling:
  at_80_percent: alert backup guardian
  at_100_percent: route to backup, notify architect
  sustained_overload: trigger capacity review
```

### Support Systems

- **Backup Coverage**: Always have secondary guardian available
- **Escalation to Architects**: Complex cases can be escalated up
- **Decision Support Tools**: Dashboards showing context and precedents
- **Peer Review**: Option to consult other guardians on difficult cases

## Decision Framework

### Escalation Response Protocol

```
1. ASSESS
   - Review escalation context
   - Check for relevant precedents
   - Evaluate risk and impact

2. DECIDE
   - Apply policies and principles
   - Consider strategic intent alignment
   - Document reasoning

3. ACT
   - Communicate decision to agent
   - Update relevant systems
   - Set precedent if novel

4. LEARN
   - Flag for policy update if needed
   - Submit evaluator training data
   - Log for audit trail
```

### Decision Categories

| Category        | Response Time | Authority Level         |
| --------------- | ------------- | ----------------------- |
| Routine         | < 15 minutes  | Single guardian         |
| Complex         | < 1 hour      | Guardian + consultation |
| Critical        | < 30 minutes  | Guardian + architect    |
| Novel/Precedent | < 4 hours     | Guardian council        |

## Output Artifacts

### Escalation Decisions

Every escalation decision includes:

- **Decision**: Approve, reject, modify, or escalate further
- **Rationale**: Clear explanation of reasoning
- **Precedent Flag**: Whether this creates a new precedent
- **Policy Recommendation**: Suggested policy updates
- **Training Data**: Feedback for evaluator improvement

### Audit Reports

Regular audit findings include:

```yaml
# Audit Report Structure
report_id: AUDIT-2024-W45
period: 2024-11-04 to 2024-11-10
domain: customer-service
guardian: [name]

summary:
  total_audited: 150
  compliant: 142 (94.7%)
  minor_issues: 6 (4.0%)
  major_issues: 2 (1.3%)
  critical_issues: 0 (0%)

findings:
  - id: FIND-001
    severity: major
    description: 'Agent provided incorrect refund amount'
    root_cause: 'Calculation error in edge case'
    remediation: 'Fix deployed, evaluator retrained'

trends:
  - 'Improvement in response accuracy (+2.3%)'
  - 'Slight increase in escalation rate (needs monitoring)'

recommendations:
  - 'Update refund calculation policy for edge cases'
  - 'Add specific test cases to evaluator training'
```

## Collaboration Model

### With Architects

- Report patterns in escalations that suggest architectural gaps
- Validate that escalation paths are working effectively
- Request architectural changes for recurring issues

### With Intent-Setters

- Provide ground-truth data for reward function calibration
- Recommend policy updates based on edge case patterns
- Flag strategic intent conflicts discovered in escalations

### With VP Agents

- Provide clear, actionable feedback on escalations
- Train agents on edge case handling
- Celebrate improvements in autonomous handling

## Success Metrics

| Metric                | Target                | Measurement                        |
| --------------------- | --------------------- | ---------------------------------- |
| Response Time SLA     | 95% within target     | Time to first response             |
| Decision Quality      | <5% reversal rate     | Decisions overturned on review     |
| Evaluator Improvement | +10% accuracy/quarter | Evaluator performance trends       |
| Guardian Satisfaction | >4.0/5.0              | Guardian experience surveys        |
| Escalation Trend      | Declining over time   | Escalations per 1000 agent actions |
