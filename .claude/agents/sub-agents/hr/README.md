---
name: hr-subagents-readme
description: >
  Documentation for HR and people operations sub-agents. This is a reference document, not an active
  agent.
---

# HR & People Ops Sub-Agents

## Overview

This directory contains specialized Tier 3 sub-agents focused on Human Resources and People
Operations functions. These agents support HR workflows while maintaining strict compliance with
employment law, anti-discrimination requirements, and data privacy regulations.

## Available Sub-Agents

| Agent             | Purpose                                       | Tools     | Worktree |
| ----------------- | --------------------------------------------- | --------- | -------- |
| `resume-screener` | Candidate evaluation against job requirements | Read only | None     |
| `policy-advisor`  | HR policy guidance and compliance             | Read only | None     |

## Domain Scope

All agents in this directory operate within the `hr` scope and share these common characteristics:

- **Tier**: 3 (Worker-level sub-agents)
- **Primary Focus**: People operations support
- **Compliance Priority**: Employment law adherence
- **Escalation Path**: HR Session Manager -> VP -> Human Cortex (Guardian)

## Ethical Guidelines

### Anti-Discrimination Requirements

All HR sub-agents MUST:

1. **Never discriminate** based on protected characteristics including but not limited to:
   - Race, color, national origin, ethnicity
   - Gender, sex, sexual orientation, gender identity
   - Age (40+), disability status, genetic information
   - Religion, pregnancy status, veteran status
   - Marital status, citizenship status (where applicable)

2. **Apply consistent criteria** across all evaluations
3. **Document decision rationale** for audit trails
4. **Flag potential bias indicators** for human review
5. **Avoid proxy discrimination** through correlated factors

### Data Privacy

- Handle PII according to applicable regulations (GDPR, CCPA, etc.)
- Minimize data retention and access
- Never share candidate information outside authorized channels
- Escalate any data breach concerns immediately

## Reward Weight Dimensions

HR sub-agents optimize for these weighted objectives:

| Dimension                      | Description                                     | Typical Weight |
| ------------------------------ | ----------------------------------------------- | -------------- |
| `candidate_quality_assessment` | Accuracy of skill/qualification matching        | 0.25-0.35      |
| `role_fit`                     | Alignment between candidate and position        | 0.20-0.30      |
| `time_efficiency`              | Speed of processing without sacrificing quality | 0.15-0.20      |
| `bias_minimization`            | Adherence to fair evaluation practices          | 0.25-0.35      |
| `compliance_adherence`         | Following policy and legal requirements         | 0.10-0.20      |

## Escalation Triggers

Common triggers requiring human intervention:

### Mandatory Escalation

- Executive or leadership role decisions
- Termination recommendations or implications
- Legal compliance concerns
- Discrimination allegations or patterns
- Unusual qualification patterns requiring judgment

### Discretionary Escalation

- Edge cases in policy interpretation
- Cross-jurisdictional considerations
- Sensitive employee relations matters
- Compensation decisions above threshold

## Integration with Session Manager

HR sub-agents report to the HR Operations Director session manager:

```yaml
sessionManager: hr-ops-director
delegationQueue: .claude/memory/sessions/${SESSION_ID}/subAgentDelegation.md
communicationChannel: sync
```

## Usage Examples

### Resume Screening

```bash
# Spawn resume screener for batch evaluation
Task("Resume screener: Evaluate candidate pool against Software Engineer role requirements")
```

### Policy Guidance

```bash
# Get policy guidance for manager question
Task("Policy advisor: Guide manager on PIP process for performance concerns")
```

## Quality Gates

HR sub-agents pass through quality gates before output:

1. **Bias Detection**: Automated check for discriminatory language
2. **Compliance Verification**: Policy alignment validation
3. **Consistency Check**: Cross-reference with previous similar decisions
4. **Reviewer Approval**: For high-stakes decisions

## Related Documentation

- [Three-Tier Architecture Implementation Plan](../../../../../docs/THREE-TIER-ARCHITECTURE-IMPLEMENTATION-PLAN.md)
- [IPRE Governance Configuration](../../governance/ipre.config.yaml)
- [Session Manager: HR Ops Director](../../session-managers/hr-ops-director.md)
