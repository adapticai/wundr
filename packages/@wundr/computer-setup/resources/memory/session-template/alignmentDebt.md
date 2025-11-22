# Alignment Debt Tracker - Session {{SESSION_ID}}

## Five-Dimension Drift Tracking

### 1. Policy Violation Rate

- Current rate: {{POLICY_VIOLATION_RATE}}%
- Baseline: {{POLICY_BASELINE}}%
- Drift: {{POLICY_DRIFT}}
- Severity: {{POLICY_SEVERITY}}
- Trend (7-day): {{POLICY_TREND}}

**Recent Violations:** | Timestamp | Violation Type | Severity | Resolved | Resolution |
|-----------|----------------|----------|----------|------------| | {{PV_1_TIME}} | {{PV_1_TYPE}} |
{{PV_1_SEVERITY}} | {{PV_1_RESOLVED}} | {{PV_1_RESOLUTION}} | | {{PV_2_TIME}} | {{PV_2_TYPE}} |
{{PV_2_SEVERITY}} | {{PV_2_RESOLVED}} | {{PV_2_RESOLUTION}} |

---

### 2. Intent-Outcome Gap

- Current gap: {{INTENT_OUTCOME_GAP}}%
- Acceptable threshold: {{INTENT_THRESHOLD}}%
- Drift: {{INTENT_DRIFT}}
- Severity: {{INTENT_SEVERITY}}
- Trend (7-day): {{INTENT_TREND}}

**Gap Analysis:** | Intent | Expected Outcome | Actual Outcome | Gap Score | Root Cause |
|--------|------------------|----------------|-----------|------------| | {{IOG_1_INTENT}} |
{{IOG_1_EXPECTED}} | {{IOG_1_ACTUAL}} | {{IOG_1_GAP}} | {{IOG_1_CAUSE}} | | {{IOG_2_INTENT}} |
{{IOG_2_EXPECTED}} | {{IOG_2_ACTUAL}} | {{IOG_2_GAP}} | {{IOG_2_CAUSE}} |

---

### 3. Evaluator Disagreement

- Disagreement rate: {{EVALUATOR_DISAGREEMENT}}%
- Acceptable threshold: {{EVALUATOR_THRESHOLD}}%
- Drift: {{EVALUATOR_DRIFT}}
- Severity: {{EVALUATOR_SEVERITY}}
- Trend (7-day): {{EVALUATOR_TREND}}

**Disagreement Instances:** | Evaluator A | Evaluator B | Item | Score A | Score B | Delta |
Resolution | |-------------|-------------|------|---------|---------|-------|------------| |
{{ED_1_EVAL_A}} | {{ED_1_EVAL_B}} | {{ED_1_ITEM}} | {{ED_1_SCORE_A}} | {{ED_1_SCORE_B}} |
{{ED_1_DELTA}} | {{ED_1_RESOLUTION}} | | {{ED_2_EVAL_A}} | {{ED_2_EVAL_B}} | {{ED_2_ITEM}} |
{{ED_2_SCORE_A}} | {{ED_2_SCORE_B}} | {{ED_2_DELTA}} | {{ED_2_RESOLUTION}} |

---

### 4. Escalation Suppression

- Suppression rate: {{ESCALATION_SUPPRESSION}}%
- Acceptable threshold: {{ESCALATION_THRESHOLD}}%
- Drift: {{ESCALATION_DRIFT}}
- Severity: {{ESCALATION_SEVERITY}}
- Trend (7-day): {{ESCALATION_TREND}}

**Suppression Log:** | Timestamp | Issue | Should Escalate | Was Escalated | Suppression Reason |
|-----------|-------|-----------------|---------------|-------------------| | {{ES_1_TIME}} |
{{ES_1_ISSUE}} | {{ES_1_SHOULD}} | {{ES_1_WAS}} | {{ES_1_REASON}} | | {{ES_2_TIME}} | {{ES_2_ISSUE}}
| {{ES_2_SHOULD}} | {{ES_2_WAS}} | {{ES_2_REASON}} |

---

### 5. Reward Hacking

- Hacking incidents: {{REWARD_HACKING_COUNT}}
- Detection rate: {{HACKING_DETECTION}}%
- Drift: {{HACKING_DRIFT}}
- Severity: {{HACKING_SEVERITY}}
- Trend (7-day): {{HACKING_TREND}}

**Detected Patterns:** | Timestamp | Pattern Type | Description | Impact | Mitigation |
|-----------|--------------|-------------|--------|------------| | {{RH_1_TIME}} | {{RH_1_TYPE}} |
{{RH_1_DESC}} | {{RH_1_IMPACT}} | {{RH_1_MITIGATION}} | | {{RH_2_TIME}} | {{RH_2_TYPE}} |
{{RH_2_DESC}} | {{RH_2_IMPACT}} | {{RH_2_MITIGATION}} |

---

## Composite Alignment Debt Score

| Dimension              | Weight         | Score         | Weighted Score       |
| ---------------------- | -------------- | ------------- | -------------------- |
| Policy Violation Rate  | {{WEIGHT_PV}}  | {{SCORE_PV}}  | {{WEIGHTED_PV}}      |
| Intent-Outcome Gap     | {{WEIGHT_IOG}} | {{SCORE_IOG}} | {{WEIGHTED_IOG}}     |
| Evaluator Disagreement | {{WEIGHT_ED}}  | {{SCORE_ED}}  | {{WEIGHTED_ED}}      |
| Escalation Suppression | {{WEIGHT_ES}}  | {{SCORE_ES}}  | {{WEIGHTED_ES}}      |
| Reward Hacking         | {{WEIGHT_RH}}  | {{SCORE_RH}}  | {{WEIGHTED_RH}}      |
| **TOTAL**              | 1.00           | -             | {{TOTAL_DEBT_SCORE}} |

## Debt Status

- Total alignment debt: {{TOTAL_ALIGNMENT_DEBT}}
- Debt ceiling: {{DEBT_CEILING}}
- Status: {{DEBT_STATUS}}
- Action required: {{ACTION_REQUIRED}}

## Remediation Plan

### Immediate Actions

{{IMMEDIATE_ACTIONS}}

### Short-term Fixes (1-7 days)

{{SHORT_TERM_FIXES}}

### Long-term Improvements

{{LONG_TERM_IMPROVEMENTS}}

## Audit Trail

- Last audit: {{LAST_AUDIT}}
- Auditor: {{AUDITOR}}
- Findings: {{AUDIT_FINDINGS}}
- Next scheduled audit: {{NEXT_AUDIT}}
