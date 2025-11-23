# @wundr.io/governance

AI governance and alignment monitoring for the Wundr platform, implementing the **IPRE** governance framework: **Intent**, **Policies**, **Rewards**, and **Evaluators**.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [IPRE Framework](#ipre-framework)
  - [Intent](#intent)
  - [Policies](#policies)
  - [Rewards](#rewards)
  - [Evaluators](#evaluators)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [IntentParser](#intentparser)
  - [PolicyEngine](#policyengine)
  - [RewardCalculator](#rewardcalculator)
  - [EvaluatorAgent](#evaluatoragent)
- [VP Daemon Integration](#vp-daemon-integration)
- [Configuration](#configuration)
- [Examples](#examples)

## Overview

The `@wundr.io/governance` package provides a comprehensive framework for monitoring AI system alignment, ensuring policy compliance, and detecting behavioral drift. It implements the IPRE governance model which structures AI governance into four interconnected layers:

1. **Intent** - The strategic mission and values that guide AI behavior
2. **Policies** - Hard constraints that must never be violated (security, compliance, operational)
3. **Rewards** - Weighted objectives that incentivize desired behaviors
4. **Evaluators** - Monitoring agents that continuously assess alignment

## Installation

```bash
npm install @wundr.io/governance
# or
pnpm add @wundr.io/governance
# or
yarn add @wundr.io/governance
```

## IPRE Framework

### Intent

The **Intent** layer defines the organization's strategic purpose and core values. It answers the question: "What are we trying to achieve?"

```typescript
import { IntentParser, createIntentParser } from '@wundr.io/governance';

// Parse intent from YAML
const parser = createIntentParser();
const intent = parser.parseFromYAML(`
mission: "Build AI systems that augment human capabilities while maintaining safety"
values:
  - transparency
  - user_privacy
  - reliability
  - innovation
constraints:
  - "Never compromise user data security"
  - "Always provide explainable outputs"
goals:
  - "Achieve 99.9% uptime"
  - "Reduce false positive rate below 1%"
`);

// Validate the intent
const validation = parser.validate(intent);
if (!validation.valid) {
  console.error('Intent validation errors:', validation.errors);
}

// Convert to system prompt context
const promptContext = parser.toPromptContext(intent);
```

**Intent Interface:**

```typescript
interface Intent {
  mission: string;           // The organization's primary purpose
  values: string[];          // Core principles guiding decisions
  constraints?: string[];    // Boundaries that must be respected
  goals?: string[];          // Strategic objectives to achieve
}
```

### Policies

The **Policies** layer defines hard constraints that AI agents must never violate. Policies are organized into three categories:

- **Security** - Prevent security vulnerabilities (secrets in code, SQL injection, XSS, command injection)
- **Compliance** - Ensure regulatory and process compliance (PR reviews, no force pushes, test coverage)
- **Operational** - Maintain operational excellence (deployment windows, rollback plans)

```typescript
import { PolicyEngine } from '@wundr.io/governance';

const engine = new PolicyEngine({
  debug: true,
  maxHistorySize: 10000,
  defaultSeverity: 'medium',
  defaultBlocking: true,
});

// Check an agent action against all policies
const result = engine.checkAction({
  id: 'action-1',
  sessionId: 'session-123',
  agentId: 'coder-1',
  type: 'commit',
  description: 'Add user authentication',
  timestamp: new Date(),
  codeContent: 'const apiKey = "sk-secret123"', // This will trigger sec-001
});

if (!result.allowed) {
  console.log('Action blocked!');
  for (const violation of result.violations) {
    console.log(`- [${violation.severity}] ${violation.message}`);
  }
}
```

**Default Security Policies:**

| Policy ID | Name | Description | Severity |
|-----------|------|-------------|----------|
| sec-001 | No secrets in code | Prevents hardcoded secrets, API keys, passwords | Critical |
| sec-002 | No SQL injection | Prevents SQL injection vulnerabilities | Critical |
| sec-003 | No XSS | Prevents cross-site scripting vulnerabilities | High |
| sec-004 | No command injection | Prevents command injection vulnerabilities | Critical |

**Default Compliance Policies:**

| Policy ID | Name | Description | Severity |
|-----------|------|-------------|----------|
| comp-001 | All changes require PR review | Ensures code goes through review | High |
| comp-002 | No force pushes | Prevents force pushes to protected branches | Critical |
| comp-003 | Test coverage minimum 80% | Ensures adequate test coverage | Medium |

**Default Operational Policies:**

| Policy ID | Name | Description | Severity |
|-----------|------|-------------|----------|
| ops-001 | No Friday deployments after 2pm | Prevents risky late Friday deployments | High |
| ops-002 | Rollback plan required | Requires rollback plan for production changes | High |

**Adding Custom Policies:**

```typescript
engine.loadPolicies({
  security: [
    {
      id: 'sec-custom-001',
      name: 'No eval usage',
      description: 'Prevents use of eval() which can be a security risk',
      pattern: 'eval\\s*\\(',
      severity: 'high',
      blocking: true,
    },
  ],
  compliance: [
    {
      name: 'Changelog required',
      description: 'All PRs must update the changelog',
      validatorName: 'changelog_check',
      severity: 'medium',
      blocking: false,
    },
  ],
});
```

### Rewards

The **Rewards** layer implements weighted objective scoring to incentivize desired behaviors. It calculates composite scores across multiple dimensions:

```typescript
import { RewardCalculator, createRewardCalculator } from '@wundr.io/governance';

// Create calculator with default weights
const calculator = createRewardCalculator();

// Or customize weights (must sum to 1.0)
const customCalculator = createRewardCalculator({
  customer_value: 0.40,        // 40%
  code_quality: 0.25,          // 25%
  delivery_speed: 0.15,        // 15%
  technical_debt_reduction: 0.15, // 15%
  documentation: 0.05,         // 5%
});

// Calculate score from metrics (0-100 scale)
const score = calculator.calculateScore({
  customer_value: 85,
  code_quality: 92,
  delivery_speed: 78,
  technical_debt_reduction: 65,
  documentation: 88,
});

console.log(`Overall Score: ${score.overall}`);
console.log('Breakdown:', score.byDimension);
```

**Default Weight Configuration:**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| customer_value | 0.35 | Value delivered to customers |
| code_quality | 0.25 | Code maintainability and correctness |
| delivery_speed | 0.20 | Velocity of feature delivery |
| technical_debt_reduction | 0.15 | Progress on reducing tech debt |
| documentation | 0.05 | Quality and completeness of docs |

**Score Comparison and Analysis:**

```typescript
// Compare current score against a baseline
const comparison = calculator.compareToBaseline(currentScore, baselineScore);

console.log(`Overall change: ${comparison.overallDelta}`);
console.log(`Improved: ${comparison.improved}`);
console.log('Significant changes:', comparison.significantChanges);

// Identify areas needing improvement
const improvementAreas = calculator.identifyImprovementAreas(currentScore);
console.log('Focus on:', improvementAreas);
```

### Evaluators

The **Evaluators** layer provides monitoring agents that continuously assess alignment across three dimensions:

1. **Policy Compliance** - Checks adherence to defined policies
2. **Reward Alignment** - Verifies scores meet expected thresholds
3. **Drift Detection** - Monitors for behavioral drift over time

```typescript
import {
  EvaluatorAgent,
  createEvaluator,
  createEvaluatorSuite,
  runEvaluatorSuite,
} from '@wundr.io/governance';

// Create individual evaluator
const policyEvaluator = createEvaluator('policy_compliance', {
  threshold: 0.8,
  frequency: 'per_commit',
  action: 'block_on_violation',
});

// Create evaluation context
const context = {
  evaluationId: 'eval-001',
  timestamp: new Date(),
  source: 'commit',
  repository: 'my-project',
  branch: 'feature/new-feature',
  commitSha: 'abc123',
  changedFiles: ['src/auth.ts', 'src/utils.ts'],
};

// Run evaluation
const result = await policyEvaluator.evaluate(context);

if (!result.passed) {
  console.log('Evaluation failed!');
  console.log('Score:', result.score);
  console.log('Issues:', result.issues);
  console.log('Recommendations:', result.recommendations);
  console.log('Action:', result.action);
}
```

**Evaluator Types and Defaults:**

| Type | Frequency | Threshold | Action |
|------|-----------|-----------|--------|
| policy_compliance | per_commit | 0.8 | block_on_violation |
| reward_alignment | hourly | 0.85 | escalate_to_guardian |
| drift_detection | daily | 0.9 | alert_architect |

**Running Multiple Evaluators:**

```typescript
// Create a complete evaluator suite
const suite = createEvaluatorSuite();
const evaluators = [
  suite.policyCompliance,
  suite.rewardAlignment,
  suite.driftDetection,
];

// Run all evaluators in parallel
const aggregatedResult = await runEvaluatorSuite(evaluators, context);

console.log(`Overall passed: ${aggregatedResult.passed}`);
console.log(`Overall score: ${aggregatedResult.overallScore}`);
console.log(`Critical issues: ${aggregatedResult.criticalIssues.length}`);
```

## Quick Start

```typescript
import {
  createIntentParser,
  PolicyEngine,
  createRewardCalculator,
  createEvaluatorSuite,
  runEvaluatorSuite,
  type IPREConfig,
} from '@wundr.io/governance';

// 1. Define Intent
const parser = createIntentParser();
const intent = parser.parseFromYAML(`
mission: "Deliver secure, reliable AI-powered trading solutions"
values:
  - security_first
  - regulatory_compliance
  - user_trust
`);

// 2. Initialize Policy Engine
const policyEngine = new PolicyEngine({ debug: true });

// 3. Set up Reward Calculator
const rewardCalculator = createRewardCalculator();

// 4. Create Evaluator Suite
const evaluators = createEvaluatorSuite();

// 5. Check an action
const action = {
  id: 'action-001',
  sessionId: 'session-001',
  agentId: 'trading-agent',
  type: 'commit',
  description: 'Update trading algorithm',
  timestamp: new Date(),
  codeContent: '// safe code here',
};

const policyResult = policyEngine.checkAction(action);

if (policyResult.allowed) {
  // Calculate rewards
  const metrics = {
    customer_value: 90,
    code_quality: 85,
    delivery_speed: 80,
    technical_debt_reduction: 70,
    documentation: 75,
  };
  const score = rewardCalculator.calculateScore(metrics);
  console.log(`Reward score: ${score.overall}`);
} else {
  console.log('Action blocked by policy:', policyResult.violations);
}
```

## API Reference

### IntentParser

**Constructor:**

```typescript
new IntentParser(config?: IntentParserConfig)
```

| Config Option | Type | Default | Description |
|---------------|------|---------|-------------|
| strict | boolean | true | Enforce strict validation |
| conflictRules | ConflictRule[] | default rules | Custom conflict detection rules |
| maxValues | number | Infinity | Maximum number of values allowed |
| maxConstraints | number | Infinity | Maximum number of constraints |
| maxGoals | number | Infinity | Maximum number of goals |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| parseFromYAML(content: string) | Intent | Parse intent from YAML string |
| parseFromJSON(content: string) | Intent | Parse intent from JSON string |
| parseFromFile(path: string) | Promise\<Intent\> | Parse intent from file (.yaml, .yml, .json) |
| validate(intent: Intent) | ValidationResult | Validate an intent object |
| extractValues(intent: Intent) | string[] | Extract values array |
| extractMission(intent: Intent) | string | Extract mission string |
| toPromptContext(intent: Intent) | string | Convert to system prompt context |

### PolicyEngine

**Constructor:**

```typescript
new PolicyEngine(config?: PolicyEngineConfig)
```

| Config Option | Type | Default | Description |
|---------------|------|---------|-------------|
| debug | boolean | false | Enable debug logging |
| maxHistorySize | number | 10000 | Maximum violations to track |
| defaultSeverity | ViolationSeverity | 'medium' | Default severity for new policies |
| defaultBlocking | boolean | true | Default blocking behavior |
| customValidators | Record\<string, Function\> | {} | Custom validator functions |
| logger | PolicyEngineLogger | undefined | Custom logger |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| loadPolicies(config: PolicyConfig) | void | Load additional policies |
| checkAction(action: AgentAction) | PolicyCheckResult | Check action against all policies |
| isBlocked(action: AgentAction) | boolean | Quick check if action is blocked |
| getViolations(action: AgentAction) | PolicyViolation[] | Get violations without recording |
| recordViolation(violation: PolicyViolation) | void | Record a violation |
| getViolationHistory(sessionId?: string) | PolicyViolation[] | Get violation history |
| getViolationRate(timeWindowMs?: number) | number | Calculate violations per hour |
| getPolicies() | PolicySet | Get all policies |
| setPolicyEnabled(policyId: string, enabled: boolean) | void | Enable/disable a policy |
| clearViolationHistory(sessionId?: string) | void | Clear violation history |
| getViolationStats() | ViolationStats | Get violation statistics |

### RewardCalculator

**Constructor:**

```typescript
new RewardCalculator(weights?: Partial<RewardWeights>)
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| calculateScore(metrics: RewardMetrics) | RewardScore | Calculate weighted score |
| getWeightedScore(dimension: string, value: number) | number | Get single dimension weighted score |
| normalizeScores(scores: Record\<string, number\>) | Record\<string, number\> | Normalize scores to sum to 100 |
| updateWeights(newWeights: Partial\<RewardWeights\>) | void | Update weight configuration |
| getWeights() | RewardWeights | Get current weights |
| compareToBaseline(current: RewardScore, baseline: RewardScore) | ScoreComparison | Compare against baseline |
| identifyImprovementAreas(score: RewardScore) | string[] | Find areas needing improvement |

### EvaluatorAgent

**Constructor:**

```typescript
new EvaluatorAgent(config: EvaluatorConfig)
```

| Config Option | Type | Required | Description |
|---------------|------|----------|-------------|
| evaluatorType | EvaluatorType | Yes | Type of evaluator |
| frequency | EvaluationFrequency | Yes | How often to run |
| threshold | number | Yes | Score threshold (0-1) |
| action | ViolationAction | Yes | Action on violation |
| name | string | No | Evaluator instance name |
| options | EvaluatorOptions | No | Additional options |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| evaluate(context: EvaluationContext) | Promise\<EvaluationResult\> | Run evaluation |
| checkPolicyCompliance(context: EvaluationContext) | Promise\<ComplianceResult\> | Check policy compliance |
| checkRewardAlignment(context: EvaluationContext, rewardScore: RewardScore) | Promise\<AlignmentResult\> | Check reward alignment |
| detectDrift(context: EvaluationContext, patterns: string[]) | Promise\<DriftResult\> | Detect drift |
| shouldTriggerAction(result: EvaluationResult) | boolean | Check if action needed |
| getRecommendedAction(result: EvaluationResult) | string | Get recommended action |
| getEvaluatorType() | EvaluatorType | Get evaluator type |
| getFrequency() | EvaluationFrequency | Get frequency |
| getThreshold() | number | Get threshold |
| getAction() | ViolationAction | Get configured action |
| getName() | string | Get evaluator name |

## VP Daemon Integration

The governance package is designed to integrate with the **VP (Virtual Processor) Daemon** for real-time policy enforcement. The VP Daemon acts as a middleware layer that intercepts AI agent actions and enforces governance policies.

### Integration Architecture

```
+-------------------+     +------------+     +------------------+
|    AI Agent       | --> | VP Daemon  | --> | Target System    |
|  (Coder, etc.)    |     | (Enforcer) |     | (Git, Deploy)    |
+-------------------+     +------------+     +------------------+
                               |
                               v
                    +-------------------+
                    | @wundr/governance |
                    |  - PolicyEngine   |
                    |  - EvaluatorAgent |
                    |  - RewardCalc     |
                    +-------------------+
```

### VP Daemon Integration Example

```typescript
import { PolicyEngine, createEvaluatorSuite } from '@wundr.io/governance';

class VPDaemon {
  private policyEngine: PolicyEngine;
  private evaluators: ReturnType<typeof createEvaluatorSuite>;

  constructor() {
    this.policyEngine = new PolicyEngine({
      debug: process.env.NODE_ENV === 'development',
    });
    this.evaluators = createEvaluatorSuite();
  }

  async interceptAction(action: AgentAction): Promise<InterceptResult> {
    // 1. Check against hard policies
    const policyResult = this.policyEngine.checkAction(action);

    if (!policyResult.allowed) {
      return {
        allowed: false,
        reason: 'Policy violation',
        violations: policyResult.violations,
      };
    }

    // 2. Run continuous evaluation (async, non-blocking)
    this.runAsyncEvaluation(action);

    // 3. Allow the action to proceed
    return { allowed: true };
  }

  private async runAsyncEvaluation(action: AgentAction): Promise<void> {
    const context = this.actionToContext(action);

    // Run policy compliance check
    const complianceResult = await this.evaluators.policyCompliance.evaluate(context);

    if (!complianceResult.passed) {
      this.alertOnViolation(complianceResult);
    }

    // Run drift detection (daily)
    if (this.shouldRunDriftDetection()) {
      const driftResult = await this.evaluators.driftDetection.evaluate(context);
      if (!driftResult.passed) {
        this.alertOnDrift(driftResult);
      }
    }
  }
}
```

### Pre-Commit Hook Integration

```typescript
// .husky/pre-commit or similar
import { PolicyEngine } from '@wundr.io/governance';

async function preCommitCheck(): Promise<void> {
  const engine = new PolicyEngine();

  const stagedFiles = await getStagedFiles();
  const codeContent = await getFileContents(stagedFiles);

  const result = engine.checkAction({
    id: `commit-${Date.now()}`,
    sessionId: 'pre-commit',
    agentId: 'git-hook',
    type: 'commit',
    description: 'Pre-commit check',
    timestamp: new Date(),
    affectedFiles: stagedFiles,
    codeContent,
  });

  if (!result.allowed) {
    console.error('Commit blocked due to policy violations:');
    for (const violation of result.violations) {
      console.error(`  - [${violation.severity}] ${violation.message}`);
    }
    process.exit(1);
  }
}

preCommitCheck();
```

## Configuration

### Complete IPRE Configuration Type

```typescript
interface IPREConfig {
  version: string;
  intent: Intent;
  policies: Policy;
  rewards: Rewards;
  evaluators: EvaluatorConfig[];
  metadata?: IPREMetadata;
}
```

### Example Configuration File

```yaml
# ipre.config.yaml
version: "1.0.0"
intent:
  mission: "Build secure, reliable AI trading systems"
  values:
    - security_first
    - regulatory_compliance
    - transparency
    - user_trust
  constraints:
    - "Never expose customer financial data"
    - "Always comply with SEC regulations"
  goals:
    - "Maintain 99.99% uptime"
    - "Achieve SOC2 compliance"

policies:
  security:
    - id: "sec-custom-001"
      name: "No raw SQL queries"
      pattern: "execute.*SELECT.*FROM"
      severity: "critical"
      blocking: true

  compliance:
    - id: "comp-custom-001"
      name: "Require approval for trades > $1M"
      validatorName: "large_trade_approval"
      severity: "high"
      blocking: true

  operational:
    - id: "ops-custom-001"
      name: "No deployments during market hours"
      validatorName: "market_hours_check"
      severity: "high"
      blocking: true

rewards:
  weights:
    customer_value: 0.30
    code_quality: 0.25
    security_posture: 0.25
    operational_excellence: 0.15
    compliance: 0.05
  threshold: 75
  frequency: "hourly"

evaluators:
  - id: "eval-001"
    name: "Trading Policy Compliance"
    type: "static"
    frequency: "realtime"
    threshold: 0.95
    action: "block"
    enabled: true

metadata:
  createdAt: "2024-01-01T00:00:00Z"
  updatedAt: "2024-01-15T10:30:00Z"
  author: "governance-team"
  description: "IPRE configuration for Wundr trading platform"
```

## Examples

### Full Governance Workflow

```typescript
import {
  createIntentParser,
  PolicyEngine,
  createRewardCalculator,
  createEvaluatorSuite,
  runEvaluatorSuite,
} from '@wundr.io/governance';

async function runGovernanceWorkflow() {
  // Initialize all components
  const intentParser = createIntentParser();
  const policyEngine = new PolicyEngine({ debug: true });
  const rewardCalculator = createRewardCalculator();
  const evaluatorSuite = createEvaluatorSuite();

  // Load intent from file
  const intent = await intentParser.parseFromFile('./ipre-intent.yaml');
  const promptContext = intentParser.toPromptContext(intent);
  console.log('Intent loaded:', intent.mission);

  // Define an agent action
  const action = {
    id: 'action-trading-001',
    sessionId: 'trading-session-001',
    agentId: 'trading-agent-alpha',
    type: 'trade_execution',
    description: 'Execute buy order for AAPL',
    timestamp: new Date(),
    metadata: {
      symbol: 'AAPL',
      quantity: 100,
      orderType: 'market',
    },
  };

  // Step 1: Policy Check (synchronous, blocking)
  const policyResult = policyEngine.checkAction(action);

  if (!policyResult.allowed) {
    console.error('Action blocked by policies:');
    policyResult.violations.forEach(v => {
      console.error(`  - ${v.policy.name}: ${v.message}`);
    });
    return;
  }

  console.log('Policy check passed');

  // Step 2: Calculate Reward Score
  const metrics = {
    customer_value: 88,
    code_quality: 92,
    delivery_speed: 85,
    technical_debt_reduction: 72,
    documentation: 80,
  };

  const rewardScore = rewardCalculator.calculateScore(metrics);
  console.log(`Reward Score: ${rewardScore.overall.toFixed(2)}`);

  // Step 3: Run Evaluator Suite
  const context = {
    evaluationId: `eval-${Date.now()}`,
    timestamp: new Date(),
    source: 'manual' as const,
    repository: 'trading-system',
    metadata: { action: action.id },
  };

  const evaluators = [
    evaluatorSuite.policyCompliance,
    evaluatorSuite.rewardAlignment,
    evaluatorSuite.driftDetection,
  ];

  const suiteResult = await runEvaluatorSuite(evaluators, context);

  console.log(`Suite Result: ${suiteResult.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Overall Score: ${(suiteResult.overallScore * 100).toFixed(1)}%`);

  if (suiteResult.criticalIssues.length > 0) {
    console.log('Critical Issues:');
    suiteResult.criticalIssues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
  }

  // Step 4: Get Violation Statistics
  const stats = policyEngine.getViolationStats();
  console.log('\nViolation Statistics:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  By Category: ${JSON.stringify(stats.byCategory)}`);
  console.log(`  Blocking: ${stats.blockingCount}`);
}

runGovernanceWorkflow().catch(console.error);
```

## License

MIT
