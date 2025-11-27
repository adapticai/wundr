---
name: marketing-subagents-readme
description: >
  Documentation for growth marketing sub-agents for trends, content, and analytics. This is a
  reference document, not an active agent.
---

# Growth Marketing Sub-Agents

This directory contains specialized sub-agents for growth marketing operations within the Wundr
platform. These agents are designed to work as Tier 3 domain specialists that support the broader
marketing and content strategy.

## Overview

The Growth Marketing sub-agents focus on:

- Social media trend monitoring and analysis
- Content generation and optimization
- Brand consistency enforcement
- A/B testing strategy development
- Competitive intelligence gathering

## Available Sub-Agents

### 1. Trend Analyst (`trend-analyst.md`)

**Purpose**: Social trend monitoring and market intelligence specialist

**Key Capabilities**:

- Real-time social channel monitoring
- Competitor activity tracking
- Trend identification and classification
- Actionable insight generation
- Crisis and opportunity detection

**Autonomous Authority**:

- Monitor social channels without approval
- Track competitor activity independently
- Generate standard trend reports

**Escalation Triggers**:

- Major trend shifts (>30% change)
- Competitor strategic alerts
- Potential crisis detection
- Low-confidence predictions (<60%)

### 2. Copywriter (`copywriter.md`)

**Purpose**: Content generation specialist for marketing copy

**Key Capabilities**:

- Blog post drafting and optimization
- Social media content creation
- Email marketing copy
- A/B testing variant generation
- Brand voice consistency enforcement

**Autonomous Authority**:

- Draft routine social media posts
- Create blog post drafts
- Generate email subject lines
- Produce A/B test variants

**Escalation Triggers**:

- Brand-sensitive content requiring approval
- Legal claims or compliance concerns
- Direct competitor mentions
- High-value campaign content

## Sub-Agent Schema

All marketing sub-agents follow the standard sub-agent YAML frontmatter schema:

```yaml
---
name: agent-name
description: Brief description
scope: marketing
tier: 3
tools: [Tool1, Tool2, Tool3]
model: sonnet

rewardWeights:
  metric_name: weight_value

hardConstraints:
  - 'Constraint description'

escalationTriggers:
  trigger_name:
    condition: 'Trigger condition'
    escalateTo: 'Target agent or tier'
    priority: high|medium|low

autonomousAuthority:
  - 'Action that can be performed without approval'

worktreeRequirement: none|required|optional
---
```

## Integration Points

### With Core Agents

- **Planner**: Receives marketing task decomposition
- **Researcher**: Provides market research and data gathering
- **Reviewer**: Quality checks on generated content

### With Other Sub-Agents

- **Data Analysts**: Receive performance metrics
- **Product Designers**: Coordinate on brand consistency
- **UX Researchers**: Align content with user insights

## Workflow Examples

### Trend Analysis Workflow

```
1. Trend Analyst monitors social channels
2. Detects emerging trend or competitor activity
3. If major shift detected -> Escalate to planner
4. Otherwise -> Generate trend report autonomously
5. Store insights in memory for team access
```

### Content Generation Workflow

```
1. Copywriter receives content brief
2. Check for brand-sensitive elements
3. If sensitive -> Escalate for approval
4. Otherwise -> Generate content autonomously
5. Apply A/B testing recommendations
6. Submit for review
```

## Best Practices

1. **Data Attribution**: Always cite sources for trend data
2. **Correlation vs Causation**: Clearly distinguish in analysis
3. **Confidence Levels**: Flag predictions below 60% confidence
4. **Brand Consistency**: Reference brand guidelines for all content
5. **Competitor Mentions**: Escalate direct competitor references
6. **Legal Compliance**: Flag any claims requiring verification

## Performance Metrics

### Trend Analyst

- `trend_accuracy`: Accuracy of trend predictions
- `timeliness`: Speed of trend detection
- `actionability`: Usefulness of insights
- `relevance`: Alignment with business goals

### Copywriter

- `brand_consistency`: Adherence to brand voice
- `engagement_rate`: Content performance metrics
- `conversion_impact`: Effect on business outcomes
- `production_efficiency`: Speed of content generation

## Directory Structure

```
marketing/
  README.md              # This file
  trend-analyst.md       # Social trend monitoring specialist
  copywriter.md          # Content generation specialist
```

## Future Additions

Planned sub-agents for this domain:

- `campaign-optimizer.md` - Campaign performance optimization
- `audience-analyst.md` - Audience segmentation and insights
- `seo-specialist.md` - Search engine optimization
- `email-strategist.md` - Email marketing automation
