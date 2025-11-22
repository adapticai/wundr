# Guardian Daily Alignment Report - {{date}}

## Aggregate Drift Score: {{aggregateDriftScore}}/100

Status: {{status}}

## Top 10 Sessions by Drift Score

| Rank | Session ID | Drift Score | Primary Issue |
| ---- | ---------- | ----------- | ------------- |

{{#each topSessions}} | {{@index}} | {{this.sessionId}} | {{this.score}} | {{this.primaryIssue}} |
{{/each}}

## Dimension Breakdown

| Dimension                | Score                                       | Threshold | Status                                      |
| ------------------------ | ------------------------------------------- | --------- | ------------------------------------------- |
| Policy Violation Rate    | {{dimensions.policyViolation.value}}%       | <0.5%     | {{dimensions.policyViolation.status}}       |
| Intent-Outcome Gap       | {{dimensions.intentOutcomeGap.value}}%      | <15%      | {{dimensions.intentOutcomeGap.status}}      |
| Evaluator Disagreement   | {{dimensions.evaluatorDisagreement.value}}% | <20%      | {{dimensions.evaluatorDisagreement.status}} |
| Escalation Suppression   | {{dimensions.escalationSuppression.value}}% | <40% drop | {{dimensions.escalationSuppression.status}} |
| Reward Hacking Instances | {{dimensions.rewardHacking.value}}          | <5/month  | {{dimensions.rewardHacking.status}}         |

## Recommended Interventions

{{#each interventions}}

### {{severity}}: {{action}}

- **Dimension**: {{dimension}}
- **Rationale**: {{rationale}}
- **Urgency**: Address within {{urgency}} hours {{/each}}

## Sessions Requiring Guardian Review

{{#each reviewQueue}}

- [ ] {{this}} {{/each}}
