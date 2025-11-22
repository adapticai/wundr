# Legal Domain Sub-Agents

This directory contains specialized sub-agents for legal document analysis, compliance monitoring,
and risk assessment within the Wundr agent ecosystem.

## Overview

Legal domain sub-agents operate at Tier 3 (specialist level) and are designed to assist with
contract review, risk identification, and compliance monitoring. These agents are read-only by
design and explicitly do not provide legal advice.

## Available Sub-Agents

| Agent                                     | Purpose           | Primary Focus                                             |
| ----------------------------------------- | ----------------- | --------------------------------------------------------- |
| [contract-scanner](./contract-scanner.md) | Contract Analysis | Term extraction, obligation tracking, deviation detection |
| [risk-analyst](./risk-analyst.md)         | Risk Assessment   | Regulatory compliance, pattern detection, risk scoring    |

## Architecture

### Tier Structure

All legal sub-agents operate at Tier 3 (Specialist) within the agent hierarchy:

```
Tier 1: Coordinators (orchestration)
Tier 2: Domain Leads (strategy)
Tier 3: Specialists (legal sub-agents) <-- This level
Tier 4: Task Executors (basic operations)
```

### Hard Constraints (All Legal Sub-Agents)

1. **Never provide legal advice** - All outputs are for informational purposes only
2. **Read-only operations** - Cannot modify source documents
3. **Human review required** - High-value or complex matters require human oversight
4. **Audit trail** - All analyses are logged for compliance purposes

### Escalation Protocol

Legal sub-agents escalate to human review when:

- Contract value exceeds defined thresholds
- Unusual or non-standard clauses detected
- Regulatory compliance concerns identified
- Ambiguous terms that could have significant legal implications
- Cross-jurisdictional complexity detected

## Integration

### With Other Agents

Legal sub-agents coordinate with:

- **Compliance Coordinator** - For regulatory requirement validation
- **Risk Manager** - For enterprise risk aggregation
- **Document Processor** - For document ingestion and OCR
- **Audit Logger** - For compliance audit trails

### MCP Tools Used

- `Read` - Document content extraction
- `WebFetch` - External reference lookup (regulations, case law)
- `memory_store` - Analysis result persistence
- `neural_patterns` - Risk pattern recognition

## Reward Weights

Legal sub-agents are optimized for:

| Metric               | Weight | Description                               |
| -------------------- | ------ | ----------------------------------------- |
| accuracy             | 0.30   | Correctness of extracted information      |
| compliance_detection | 0.25   | Identification of compliance requirements |
| risk_identification  | 0.25   | Recognition of potential risks            |
| clarity              | 0.20   | Clear, actionable output formatting       |

## Usage Examples

### Contract Analysis

```bash
# Invoke contract scanner for a specific document
npx claude-flow@alpha agent spawn --type contract-scanner \
  --task "Analyze vendor agreement at /docs/contracts/vendor-2024.pdf"
```

### Risk Assessment

```bash
# Invoke risk analyst for compliance review
npx claude-flow@alpha agent spawn --type risk-analyst \
  --task "Assess regulatory compliance risks in procurement process"
```

## Best Practices

1. **Always verify** - Cross-reference extracted data with source documents
2. **Document assumptions** - Log any interpretive decisions made during analysis
3. **Escalate uncertainty** - When in doubt, escalate for human review
4. **Maintain context** - Preserve document lineage and version information
5. **Regular calibration** - Periodically review and update risk scoring models

## Compliance Notes

- These agents are tools to assist legal professionals, not replace them
- All significant findings should be reviewed by qualified legal counsel
- Outputs should be treated as preliminary analysis requiring validation
- Data handling must comply with applicable privacy regulations

## Related Documentation

- [Agent Hierarchy Overview](../../README.md)
- [Sub-Agent Metadata Schema](../README.md)
- [Escalation Protocols](../../docs/escalation.md)
- [Compliance Framework](../../docs/compliance.md)
