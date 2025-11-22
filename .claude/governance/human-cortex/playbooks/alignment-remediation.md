# Alignment Remediation Playbook

## Purpose

This playbook provides step-by-step procedures for identifying, diagnosing, and remediating
alignment drift in AI agent systems. It ensures consistent, effective responses to alignment issues
while maintaining system integrity and safety.

---

## Understanding Alignment Drift

### Drift Dimensions

| Dimension                   | Description                                 | Measurement             | Healthy Range |
| --------------------------- | ------------------------------------------- | ----------------------- | ------------- |
| **Value Alignment**         | Agent decisions match organizational values | Value consistency score | > 90%         |
| **Policy Compliance**       | Actions follow established policies         | Compliance rate         | > 95%         |
| **Goal Alignment**          | Agent objectives match intended goals       | Goal deviation metric   | < 10%         |
| **Behavioral Consistency**  | Predictable, expected behavior patterns     | Behavior variance       | < 15%         |
| **Ethical Boundaries**      | Respect for ethical constraints             | Boundary respect rate   | 100%          |
| **Communication Alignment** | Tone, style, accuracy of outputs            | Communication score     | > 85%         |

### Drift Severity Levels

| Level        | Debt Score | Action Required                                  |
| ------------ | ---------- | ------------------------------------------------ |
| **Minimal**  | 0-10       | Monitor, no immediate action                     |
| **Low**      | 11-20      | Schedule remediation                             |
| **Moderate** | 21-35      | Prioritize remediation                           |
| **High**     | 36-50      | Immediate remediation                            |
| **Critical** | > 50       | Emergency intervention (see emergency-cortex.md) |

---

## Step-by-Step Remediation by Drift Dimension

### 1. Value Alignment Drift

**Symptoms**:

- Decisions that conflict with organizational values
- Inconsistent prioritization of stakeholder interests
- Outputs that don't reflect company principles

**Diagnosis Checklist**:

- [ ] Review recent decision logs for value conflicts
- [ ] Compare current decisions to baseline value profiles
- [ ] Identify specific values showing drift
- [ ] Check for value hierarchy changes or ambiguities
- [ ] Review any recent prompt or instruction changes

**Remediation Steps**:

```
Step 1: Isolate Affected Decisions
----------------------------------------
- [ ] Identify decision categories showing value drift
- [ ] Quantify the scope (% of decisions affected)
- [ ] Document specific examples with timestamps

Step 2: Root Cause Analysis
----------------------------------------
- [ ] Check for prompt modifications
- [ ] Review any model updates or fine-tuning
- [ ] Analyze input data quality
- [ ] Examine context window utilization
- [ ] Look for conflicting instructions

Step 3: Apply Correction
----------------------------------------
- [ ] Reinforce value statements in system prompts
- [ ] Add explicit value examples to context
- [ ] Implement value-checking guardrails
- [ ] Update decision templates with value guidance
- [ ] Consider prompt restructuring

Step 4: Validate Correction
----------------------------------------
- [ ] Run test scenarios against known value conflicts
- [ ] Compare outputs to baseline expectations
- [ ] Verify improvement in value alignment score
- [ ] Monitor for 24-48 hours post-correction

Step 5: Document and Learn
----------------------------------------
- [ ] Record root cause and solution
- [ ] Update value alignment documentation
- [ ] Share findings with Guardian team
- [ ] Schedule follow-up review in 1 week
```

**Success Criteria**: Value alignment score returns to > 90% and remains stable for 7 days.

---

### 2. Policy Compliance Drift

**Symptoms**:

- Actions violating established policies
- Inconsistent policy interpretation
- Failure to apply policy updates

**Diagnosis Checklist**:

- [ ] Identify specific policies being violated
- [ ] Determine if violations are consistent or sporadic
- [ ] Check policy documentation for ambiguities
- [ ] Review agent's policy knowledge/context
- [ ] Assess if policy conflicts exist

**Remediation Steps**:

```
Step 1: Policy Violation Analysis
----------------------------------------
- [ ] Catalog all policy violations in past 7 days
- [ ] Categorize by policy type and severity
- [ ] Identify patterns (time, context, input type)
- [ ] Calculate violation rate by category

Step 2: Policy Context Review
----------------------------------------
- [ ] Verify policy documents are current
- [ ] Check agent's access to policy information
- [ ] Review policy injection in prompts
- [ ] Identify any policy documentation gaps

Step 3: Apply Policy Reinforcement
----------------------------------------
- [ ] Update system prompts with explicit policy rules
- [ ] Add policy examples to few-shot context
- [ ] Implement pre-action policy verification
- [ ] Create policy decision trees for complex cases
- [ ] Add policy violation detection guardrails

Step 4: Test Compliance
----------------------------------------
- [ ] Run policy compliance test suite
- [ ] Test edge cases and ambiguous scenarios
- [ ] Verify correct handling of policy conflicts
- [ ] Confirm violation detection is working

Step 5: Establish Monitoring
----------------------------------------
- [ ] Set up automated policy compliance checks
- [ ] Configure alerts for violation patterns
- [ ] Schedule regular policy review cycles
- [ ] Document compliance baseline
```

**Success Criteria**: Policy compliance rate returns to > 95% with no critical violations for 14
days.

---

### 3. Goal Alignment Drift

**Symptoms**:

- Agent pursuing unintended objectives
- Optimization for wrong metrics
- Task completion without meeting actual goals

**Diagnosis Checklist**:

- [ ] Compare agent objectives to intended goals
- [ ] Review goal specification clarity
- [ ] Check for goal gaming or proxy optimization
- [ ] Analyze outcome vs intention correlation
- [ ] Examine feedback loop integrity

**Remediation Steps**:

```
Step 1: Goal Specification Audit
----------------------------------------
- [ ] Document intended goals explicitly
- [ ] Identify all proxy metrics being used
- [ ] Map agent behavior to goal achievement
- [ ] Find gaps between specification and intent

Step 2: Misalignment Identification
----------------------------------------
- [ ] Identify specific goal deviations
- [ ] Quantify deviation magnitude
- [ ] Determine if deviation is harmful or neutral
- [ ] Check for Goodhart's Law effects

Step 3: Goal Realignment
----------------------------------------
- [ ] Clarify goal specifications
- [ ] Add multiple success metrics
- [ ] Implement goal verification checks
- [ ] Update reward/feedback mechanisms
- [ ] Add human-in-loop for goal interpretation

Step 4: Outcome Verification
----------------------------------------
- [ ] Test goal achievement on real scenarios
- [ ] Verify agent understands updated goals
- [ ] Check for unintended side effects
- [ ] Confirm goal-outcome correlation improves

Step 5: Continuous Goal Monitoring
----------------------------------------
- [ ] Implement goal tracking metrics
- [ ] Set up deviation alerts
- [ ] Schedule periodic goal reviews
- [ ] Document goal evolution over time
```

**Success Criteria**: Goal deviation metric < 10% with confirmed positive outcomes for 14 days.

---

### 4. Behavioral Consistency Drift

**Symptoms**:

- Unpredictable agent responses
- Inconsistent handling of similar inputs
- Variance in quality or style

**Diagnosis Checklist**:

- [ ] Measure output variance across similar inputs
- [ ] Identify inconsistent behavior patterns
- [ ] Check for temperature/randomness settings
- [ ] Review context management consistency
- [ ] Analyze input preprocessing stability

**Remediation Steps**:

```
Step 1: Variance Analysis
----------------------------------------
- [ ] Collect output samples for similar inputs
- [ ] Measure variance metrics
- [ ] Identify high-variance scenarios
- [ ] Document consistency expectations

Step 2: Source Identification
----------------------------------------
- [ ] Review model parameters (temperature, etc.)
- [ ] Check context window management
- [ ] Analyze input normalization
- [ ] Review caching and state management

Step 3: Consistency Enhancement
----------------------------------------
- [ ] Adjust generation parameters for consistency
- [ ] Implement output templating where appropriate
- [ ] Standardize input preprocessing
- [ ] Add consistency verification layer
- [ ] Use structured output formats

Step 4: Validation Testing
----------------------------------------
- [ ] Run identical inputs multiple times
- [ ] Measure output consistency
- [ ] Verify acceptable variance levels
- [ ] Test edge cases and variations

Step 5: Monitoring Setup
----------------------------------------
- [ ] Implement variance tracking
- [ ] Set consistency thresholds
- [ ] Configure drift detection alerts
- [ ] Establish baseline metrics
```

**Success Criteria**: Behavioral variance < 15% across standardized test scenarios.

---

### 5. Ethical Boundary Drift

**Symptoms**:

- Outputs approaching ethical limits
- Weakened refusal behaviors
- Boundary testing patterns

**Diagnosis Checklist**:

- [ ] Review boundary violation incidents
- [ ] Check boundary definition clarity
- [ ] Analyze boundary approach frequency
- [ ] Examine jailbreak attempt handling
- [ ] Verify safety layer integrity

**Remediation Steps**:

```
Step 1: IMMEDIATE ASSESSMENT (Critical Priority)
----------------------------------------
- [ ] Document all boundary incidents
- [ ] Assess severity and impact
- [ ] Determine if actual violations occurred
- [ ] Notify Safety Officer if violations confirmed

Step 2: Boundary Audit
----------------------------------------
- [ ] Review all ethical boundaries defined
- [ ] Check boundary implementation in prompts
- [ ] Test boundary enforcement mechanisms
- [ ] Identify weakened or missing boundaries

Step 3: Boundary Reinforcement
----------------------------------------
- [ ] Strengthen boundary language in prompts
- [ ] Add explicit refusal examples
- [ ] Implement multi-layer boundary checks
- [ ] Update content filtering rules
- [ ] Add boundary monitoring triggers

Step 4: Adversarial Testing
----------------------------------------
- [ ] Run red-team boundary tests
- [ ] Test known jailbreak patterns
- [ ] Verify refusal consistency
- [ ] Check edge case handling

Step 5: Continuous Protection
----------------------------------------
- [ ] Implement real-time boundary monitoring
- [ ] Set up immediate alerts for approaches
- [ ] Schedule regular boundary audits
- [ ] Document boundary evolution
```

**Success Criteria**: 100% boundary respect rate with no violations for 30 days.

---

### 6. Communication Alignment Drift

**Symptoms**:

- Tone inconsistency
- Style deviations
- Accuracy degradation in outputs

**Diagnosis Checklist**:

- [ ] Analyze communication quality metrics
- [ ] Review tone and style samples
- [ ] Check accuracy of factual outputs
- [ ] Compare to communication guidelines
- [ ] Identify specific deviation patterns

**Remediation Steps**:

```
Step 1: Communication Quality Assessment
----------------------------------------
- [ ] Sample recent communications
- [ ] Score against quality rubric
- [ ] Identify specific quality gaps
- [ ] Document deviation examples

Step 2: Root Cause Analysis
----------------------------------------
- [ ] Review communication guidelines
- [ ] Check style guide implementation
- [ ] Analyze context and examples used
- [ ] Examine prompt structure

Step 3: Communication Correction
----------------------------------------
- [ ] Update communication guidelines in prompts
- [ ] Add style examples to context
- [ ] Implement tone verification
- [ ] Add quality checks for outputs
- [ ] Refine factual accuracy guardrails

Step 4: Quality Validation
----------------------------------------
- [ ] Test communication across scenarios
- [ ] Verify tone consistency
- [ ] Check factual accuracy
- [ ] Confirm style adherence

Step 5: Ongoing Quality Management
----------------------------------------
- [ ] Implement communication scoring
- [ ] Set quality thresholds
- [ ] Configure degradation alerts
- [ ] Schedule regular quality reviews
```

**Success Criteria**: Communication score > 85% with consistent quality for 14 days.

---

## When to Pause vs Continue Operations

### Continue Operations When:

- [ ] Drift is in Minimal (0-10) or Low (11-20) range
- [ ] Drift is isolated to non-critical functions
- [ ] No safety or ethical boundaries are affected
- [ ] Human oversight can compensate for drift
- [ ] Remediation can be applied without disruption

### Pause Specific Functions When:

- [ ] Drift is Moderate (21-35) in that function
- [ ] Function outputs are unreliable
- [ ] Function interacts with critical systems
- [ ] Remediation requires function isolation

### Pause System-Wide When:

- [ ] Drift is High (36-50) or Critical (>50)
- [ ] Multiple dimensions show simultaneous drift
- [ ] Safety boundaries are compromised
- [ ] Root cause is unknown
- [ ] Drift is spreading across components

### Pause Decision Matrix

| Condition                        | Action                                     |
| -------------------------------- | ------------------------------------------ |
| Single dimension, Low drift      | Continue + Monitor                         |
| Single dimension, Moderate drift | Continue + Active Remediation              |
| Single dimension, High drift     | Pause function + Remediate                 |
| Multiple dimensions, any level   | Assess dependencies, consider system pause |
| Safety/Ethics affected           | Immediate pause until resolved             |
| Unknown root cause + High drift  | System pause until diagnosed               |

---

## Retraining Evaluator Agents

### When Retraining is Needed

- Evaluator accuracy drops below 85%
- Systematic false positives/negatives detected
- New drift patterns not being caught
- Evaluator bias identified
- Evaluation criteria have changed

### Retraining Process

```
Phase 1: Data Collection
----------------------------------------
- [ ] Gather labeled drift examples (min 100)
- [ ] Include both drift and non-drift samples
- [ ] Cover all drift dimensions
- [ ] Validate label accuracy with Guardians
- [ ] Balance dataset across categories

Phase 2: Evaluation
----------------------------------------
- [ ] Benchmark current evaluator performance
- [ ] Identify specific failure modes
- [ ] Document expected improvements
- [ ] Set success criteria

Phase 3: Retraining
----------------------------------------
- [ ] Update training data
- [ ] Adjust evaluation prompts/criteria
- [ ] Fine-tune if using custom model
- [ ] Run training validation

Phase 4: Validation
----------------------------------------
- [ ] Test on held-out dataset
- [ ] Compare to benchmark performance
- [ ] Verify improvements meet criteria
- [ ] Check for new failure modes

Phase 5: Deployment
----------------------------------------
- [ ] Deploy retrained evaluator to staging
- [ ] Run parallel evaluation with production
- [ ] Validate consistency and improvements
- [ ] Gradual rollout to production

Phase 6: Monitoring
----------------------------------------
- [ ] Track evaluator performance metrics
- [ ] Compare to pre-retraining baseline
- [ ] Set up regression alerts
- [ ] Schedule next evaluation cycle
```

### Retraining Quality Gates

| Gate                    | Requirement                            |
| ----------------------- | -------------------------------------- |
| Data Quality            | > 95% label accuracy verified          |
| Performance Improvement | > 5% accuracy gain on test set         |
| No Regression           | No dimension accuracy drops > 2%       |
| Bias Check              | No systematic bias identified          |
| Production Validation   | 24-hour parallel run shows improvement |

---

## Policy Update Procedures

### When Policy Updates are Needed

- Recurring drift from ambiguous policies
- Policy conflicts causing confusion
- External requirements changed
- Business objectives evolved
- Gap identified in policy coverage

### Policy Update Process

```
Step 1: Proposal
----------------------------------------
- [ ] Document policy gap or issue
- [ ] Propose specific policy change
- [ ] Assess impact on existing operations
- [ ] Identify affected components

Step 2: Review
----------------------------------------
- [ ] Policy Architect reviews proposal
- [ ] Guardian team provides input
- [ ] Legal/Compliance review (if applicable)
- [ ] Stakeholder feedback collected

Step 3: Approval
----------------------------------------
- [ ] Human Cortex Lead approves
- [ ] Change documented in policy changelog
- [ ] Effective date determined
- [ ] Communication plan created

Step 4: Implementation
----------------------------------------
- [ ] Update policy documentation
- [ ] Update agent prompts and context
- [ ] Update evaluator criteria
- [ ] Update monitoring thresholds

Step 5: Deployment
----------------------------------------
- [ ] Deploy to staging environment
- [ ] Validate policy enforcement
- [ ] Gradual rollout to production
- [ ] Monitor for issues

Step 6: Communication
----------------------------------------
- [ ] Notify all Guardians
- [ ] Update training materials
- [ ] Communicate to stakeholders
- [ ] Archive old policy version
```

### Policy Change Categories

| Category      | Review Level                     | Approval Required                     |
| ------------- | -------------------------------- | ------------------------------------- |
| Clarification | Guardian Team                    | Senior Guardian                       |
| Minor Update  | Guardian Team + Policy Architect | Human Cortex Lead                     |
| Major Change  | Full Review                      | Executive Sponsor                     |
| Emergency     | Expedited                        | Human Cortex Lead + Document Post-Hoc |

---

## Success Criteria for Remediation

### General Success Criteria

All remediations must meet these criteria before being considered complete:

1. **Metric Recovery**: Affected metrics return to healthy range
2. **Stability**: Metrics remain stable for required duration
3. **No Side Effects**: No new drift introduced in other dimensions
4. **Root Cause Resolved**: Underlying cause addressed, not just symptoms
5. **Documentation Complete**: Full remediation documented
6. **Monitoring Active**: Ongoing monitoring in place
7. **Knowledge Captured**: Learnings recorded for future reference

### Dimension-Specific Success Criteria Summary

| Dimension              | Key Metric        | Target | Stability Period |
| ---------------------- | ----------------- | ------ | ---------------- |
| Value Alignment        | Consistency Score | > 90%  | 7 days           |
| Policy Compliance      | Compliance Rate   | > 95%  | 14 days          |
| Goal Alignment         | Deviation Metric  | < 10%  | 14 days          |
| Behavioral Consistency | Variance          | < 15%  | 7 days           |
| Ethical Boundaries     | Respect Rate      | 100%   | 30 days          |
| Communication          | Quality Score     | > 85%  | 14 days          |

### Remediation Sign-Off Checklist

Before closing a remediation:

- [ ] All success criteria met
- [ ] Stability period completed without regression
- [ ] Documentation reviewed and complete
- [ ] Monitoring dashboards updated
- [ ] Team notified of resolution
- [ ] Post-mortem scheduled (for High/Critical)
- [ ] Related incidents linked
- [ ] Knowledge base updated

---

## Appendix: Remediation Templates

### Remediation Ticket Template

```markdown
## Alignment Remediation: [TICKET-ID]

### Summary

**Dimension**: [affected dimension] **Severity**: [level] **Detected**: [timestamp] **Assigned**:
[guardian]

### Current State

- Drift Score: [score]
- Affected Metrics: [list]
- Symptoms: [description]

### Root Cause Analysis

[Analysis findings]

### Remediation Plan

1. [Step 1]
2. [Step 2]
3. [Step 3]

### Progress

- [ ] Step 1 complete
- [ ] Step 2 complete
- [ ] Step 3 complete

### Validation

- [ ] Metrics recovered
- [ ] Stability confirmed
- [ ] No side effects

### Resolution

**Status**: [Open/In Progress/Resolved] **Resolved**: [timestamp] **Duration**: [time to resolve]
```

### Post-Remediation Report Template

```markdown
## Post-Remediation Report: [TICKET-ID]

### Overview

- **Issue**: [brief description]
- **Dimension**: [affected dimension]
- **Duration**: [time from detection to resolution]
- **Impact**: [scope and severity]

### Timeline

| Time  | Event                 |
| ----- | --------------------- |
| [T+0] | Drift detected        |
| [T+X] | Investigation started |
| [T+Y] | Root cause identified |
| [T+Z] | Remediation applied   |
| [T+W] | Resolution confirmed  |

### Root Cause

[Detailed explanation]

### Resolution

[What was done to fix it]

### Prevention

[How to prevent recurrence]

### Lessons Learned

- [Lesson 1]
- [Lesson 2]

### Action Items

- [ ] [Action 1]
- [ ] [Action 2]
```
