# @wundr.io/token-budget

Token budget management for LLM context - comprehensive cost calculation, usage tracking, and optimization suggestions for AI agents.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [TokenBudgetManager](#tokenbudgetmanager)
  - [CostCalculator](#costcalculator)
  - [UsageTracker](#usagetracker)
- [Budget Allocation Strategies](#budget-allocation-strategies)
- [Token Counting and Tracking](#token-counting-and-tracking)
- [Context Window Optimization](#context-window-optimization)
- [Priority-Based Allocation](#priority-based-allocation)
- [Integration with JIT Tools and Context Engineering](#integration-with-jit-tools-and-context-engineering)
- [Configuration](#configuration)
- [Events](#events)
- [Types](#types)
- [License](#license)

## Overview

`@wundr.io/token-budget` provides a complete solution for managing token consumption in LLM-powered applications. It enables:

- **Cost Calculation**: Accurate pricing across multiple models (Claude, GPT-4, etc.)
- **Usage Tracking**: Session-based tracking with filtering, aggregation, and export
- **Budget Enforcement**: Hard and soft limits with warning thresholds
- **Optimization Suggestions**: Intelligent recommendations to reduce costs
- **Context Window Management**: Tools to optimize prompt and context sizes
- **Event-Driven Architecture**: React to budget events in real-time

## Installation

```bash
npm install @wundr.io/token-budget
# or
yarn add @wundr.io/token-budget
# or
pnpm add @wundr.io/token-budget
```

## Quick Start

```typescript
import { TokenBudgetManager, createBudgetManager } from '@wundr.io/token-budget';

// Create a budget manager with limits
const manager = createBudgetManager({
  limits: {
    maxTotalTokens: 100000,
    maxCostUsd: 10,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
});

// Check budget before making an API call
const check = manager.checkBudget({
  inputTokens: 5000,
  outputTokens: 2000,
  model: 'claude-sonnet-4-20250514',
});

if (check.withinBudget) {
  // Proceed with the LLM call
  const response = await callLLM(prompt);

  // Record actual usage
  manager.recordUsage({
    model: 'claude-sonnet-4-20250514',
    inputTokens: 5000,
    outputTokens: 1800,
  });
} else {
  console.log('Budget exceeded:', check.warnings);
  console.log('Suggestions:', check.suggestions);
}

// Get current status
const status = manager.getBudgetStatus();
console.log(`Used: ${status.utilizationPercent}%`);
console.log(`Cost: $${status.costUsedUsd.toFixed(4)}`);
```

## Core Concepts

### Budget Limits

Define constraints on token usage and costs:

```typescript
const limits = {
  maxTotalTokens: 1000000,      // Total tokens (input + output)
  maxInputTokens: 800000,       // Input tokens only
  maxOutputTokens: 200000,      // Output tokens only
  maxCostUsd: 100,              // Maximum cost in USD
  timeWindowMs: 3600000,        // Rolling 1-hour window
  warningThreshold: 0.8,        // Warn at 80% utilization
  criticalThreshold: 0.95,      // Critical at 95% utilization
};
```

### Status Levels

The budget manager tracks four status levels:

| Status | Description |
|--------|-------------|
| `ok` | Below warning threshold |
| `warning` | Between warning and critical thresholds |
| `critical` | Between critical threshold and limit |
| `exceeded` | Budget limit exceeded |

### Model Pricing

Built-in pricing for popular models (as of 2025):

| Model | Input (per 1K) | Output (per 1K) | Context Window |
|-------|----------------|-----------------|----------------|
| claude-sonnet-4-20250514 | $0.003 | $0.015 | 200K |
| claude-sonnet-4-5-20250929 | $0.003 | $0.015 | 200K |
| claude-opus-4-20250514 | $0.015 | $0.075 | 200K |
| claude-3-haiku-20240307 | $0.00025 | $0.00125 | 200K |
| gpt-4-turbo | $0.01 | $0.03 | 128K |
| gpt-4o | $0.005 | $0.015 | 128K |
| gpt-4o-mini | $0.00015 | $0.0006 | 128K |

## API Reference

### TokenBudgetManager

The main class that combines cost calculation, usage tracking, and optimization.

#### Constructor

```typescript
const manager = new TokenBudgetManager(config?: Partial<TokenBudgetConfig>);
```

#### Methods

##### checkBudget(options)

Checks if an operation would be within budget.

```typescript
const result = manager.checkBudget({
  inputTokens: 5000,
  outputTokens: 2000,
  model: 'claude-sonnet-4-20250514',
  includeCurrentUsage: true,
});

// Result:
// {
//   withinBudget: boolean,
//   status: BudgetStatus,
//   estimatedCostUsd: number,
//   warnings: string[],
//   suggestions: OptimizationSuggestion[],
// }
```

##### recordUsage(options)

Records token usage and updates budget status.

```typescript
const status = manager.recordUsage({
  model: 'claude-sonnet-4-20250514',
  inputTokens: 5000,
  outputTokens: 1800,
  taskId: 'task-123',
  operationType: 'chat',
  cacheHit: false,
  metadata: { endpoint: '/api/chat' },
});
```

##### getBudgetStatus()

Returns current budget status.

```typescript
const status = manager.getBudgetStatus();
// {
//   totalTokensUsed: number,
//   inputTokensUsed: number,
//   outputTokensUsed: number,
//   costUsedUsd: number,
//   totalTokensRemaining?: number,
//   costRemainingUsd?: number,
//   utilizationPercent: number,
//   status: 'ok' | 'warning' | 'critical' | 'exceeded',
//   operationCount: number,
//   avgTokensPerOperation: number,
//   avgCostPerOperation: number,
//   lastUpdated: Date,
// }
```

##### suggestOptimization()

Generates optimization suggestions based on usage patterns.

```typescript
const suggestions = manager.suggestOptimization();
// Returns array of OptimizationSuggestion objects
```

##### resetBudget()

Clears usage history and resets tracking.

```typescript
manager.resetBudget();
```

##### updateConfig(config)

Updates budget configuration.

```typescript
manager.updateConfig({
  limits: { maxCostUsd: 200 },
});
```

##### onEvent(handler) / offEvent(handler)

Registers/removes event handlers.

```typescript
manager.onEvent((event) => {
  if (event.type === 'budget:warning') {
    console.log('Budget warning!', event.payload);
  }
});
```

##### exportAsJson()

Exports budget data as JSON.

```typescript
const json = manager.exportAsJson();
```

#### Factory Functions

```typescript
// Basic manager
const manager = createBudgetManager(config);

// Strict limits
const strictManager = createStrictBudgetManager(maxTokens, maxCostUsd);

// Session-specific
const sessionManager = createSessionBudgetManager(sessionId, agentId, config);
```

### CostCalculator

Standalone cost calculation utilities.

```typescript
import { CostCalculator, createCostCalculator } from '@wundr.io/token-budget';

const calculator = createCostCalculator();

// Calculate cost
const cost = calculator.calculateCost({
  model: 'claude-sonnet-4-20250514',
  inputTokens: 1000,
  outputTokens: 500,
  cacheHit: false,
});

// Estimate with cache probability
const estimate = calculator.estimateCost({
  model: 'claude-sonnet-4-20250514',
  inputTokens: 1000,
  estimatedOutputTokens: 500,
  cacheHitProbability: 0.3,
});

// Compare models
const comparisons = calculator.compareModels(1000, 500);
// Returns models sorted by cost (cheapest first)

// Calculate batch cost
const batchResult = calculator.calculateBatchCost(usageRecords);

// Add custom pricing
calculator.addPricing({
  modelId: 'custom-model',
  inputCostPer1K: 0.002,
  outputCostPer1K: 0.01,
  contextWindow: 100000,
  isCached: false,
  cacheDiscount: 0,
});

// Calculate cache savings
const savings = calculator.calculateCacheSavings('claude-sonnet-4-20250514', 1000, 500);
```

#### Utility Functions

```typescript
import {
  quickCostCalculation,
  estimateTokensFromText,
  formatCost
} from '@wundr.io/token-budget';

// Quick calculation without creating a calculator
const cost = quickCostCalculation('claude-sonnet-4-20250514', 1000, 500);

// Estimate tokens from text (rough: ~4 chars per token)
const tokens = estimateTokensFromText('Hello, world!'); // ~4 tokens

// Format cost for display
const formatted = formatCost(0.00123); // "$0.0012"
```

### UsageTracker

Session-based usage tracking.

```typescript
import { UsageTracker, createUsageTracker } from '@wundr.io/token-budget';

const tracker = createUsageTracker({
  sessionId: 'session-123',
  agentId: 'agent-456',
});

// Record usage
const usage = tracker.recordUsage({
  model: 'claude-sonnet-4-20250514',
  inputTokens: 1000,
  outputTokens: 500,
  taskId: 'task-789',
  operationType: 'chat',
  cacheHit: false,
  metadata: { user: 'user-123' },
});

// Get usage history with filtering
const history = tracker.getUsageHistory({
  startTime: new Date('2024-01-01'),
  endTime: new Date(),
  model: 'claude-sonnet-4-20250514',
  limit: 100,
  offset: 0,
  sortDirection: 'desc',
});

// Get session summary
const summary = tracker.getSessionSummary();
// {
//   sessionId: string,
//   startTime: Date,
//   totalInputTokens: number,
//   totalOutputTokens: number,
//   totalTokens: number,
//   totalCostUsd: number,
//   operationCount: number,
//   byModel: { [model]: { ... } },
//   byOperationType: { [type]: { ... } },
//   cacheHitRate: number,
//   peakTokensPerMinute: number,
// }

// Get current totals (fast)
const totals = tracker.getCurrentTotals();

// Get usage in time window
const windowUsage = tracker.getUsageInWindow(3600000); // Last hour

// Get current rate
const rate = tracker.getCurrentRate();
// { tokensPerMinute, costPerMinute, operationsPerMinute, sessionDurationMinutes }

// Export data
const json = tracker.exportAsJson();
const csv = tracker.exportAsCsv();

// End session
const finalSummary = tracker.endSession();
```

## Budget Allocation Strategies

### Fixed Budget

Set hard limits that cannot be exceeded:

```typescript
const manager = createBudgetManager({
  limits: {
    maxTotalTokens: 100000,
    maxCostUsd: 10,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
});
```

### Time-Windowed Budget

Rolling budget that resets after a time period:

```typescript
const manager = createBudgetManager({
  limits: {
    maxTotalTokens: 50000,
    maxCostUsd: 5,
    timeWindowMs: 3600000, // 1 hour rolling window
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
});
```

### Per-Agent Budget

Track and limit usage per agent:

```typescript
const agentBudgets = new Map<string, TokenBudgetManager>();

function getAgentBudget(agentId: string): TokenBudgetManager {
  if (!agentBudgets.has(agentId)) {
    agentBudgets.set(agentId, createSessionBudgetManager(
      `session-${Date.now()}`,
      agentId,
      {
        limits: {
          maxTotalTokens: 10000,
          maxCostUsd: 1,
        },
      }
    ));
  }
  return agentBudgets.get(agentId)!;
}
```

### Tiered Budget

Different limits based on operation type:

```typescript
const tierLimits = {
  chat: { maxTokens: 50000, maxCost: 5 },
  embedding: { maxTokens: 100000, maxCost: 2 },
  function_call: { maxTokens: 20000, maxCost: 3 },
};

function checkTierBudget(
  manager: TokenBudgetManager,
  operationType: string,
  inputTokens: number,
  outputTokens: number
): boolean {
  const summary = manager.getUsageTracker().getSessionSummary();
  const tierUsage = summary.byOperationType[operationType] || { totalTokens: 0, costUsd: 0 };
  const limits = tierLimits[operationType] || tierLimits.chat;

  return (
    tierUsage.totalTokens + inputTokens + outputTokens <= limits.maxTokens &&
    tierUsage.costUsd <= limits.maxCost
  );
}
```

## Token Counting and Tracking

### Estimating Tokens

```typescript
import { estimateTokensFromText } from '@wundr.io/token-budget';

// Rough estimation (~4 chars per token for English)
const promptTokens = estimateTokensFromText(prompt);

// For more accurate counting, use a proper tokenizer
// This package provides rough estimates for budget planning
```

### Tracking by Model

```typescript
const summary = manager.getUsageTracker().getSessionSummary();

// Usage breakdown by model
for (const [model, stats] of Object.entries(summary.byModel)) {
  console.log(`${model}:`);
  console.log(`  Input tokens: ${stats.inputTokens}`);
  console.log(`  Output tokens: ${stats.outputTokens}`);
  console.log(`  Cost: $${stats.costUsd.toFixed(4)}`);
  console.log(`  Operations: ${stats.operationCount}`);
}
```

### Tracking by Operation Type

```typescript
const summary = manager.getUsageTracker().getSessionSummary();

// Usage breakdown by operation type
// Types: 'chat', 'completion', 'embedding', 'function_call', 'tool_use', 'other'
for (const [opType, stats] of Object.entries(summary.byOperationType)) {
  console.log(`${opType}: ${stats.totalTokens} tokens, $${stats.costUsd.toFixed(4)}`);
}
```

### Historical Analysis

```typescript
const tracker = manager.getUsageTracker();

// Get last 24 hours
const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recentHistory = tracker.getUsageHistory({
  startTime: dayAgo,
  sortDirection: 'desc',
});

// Analyze patterns
const hourlyBuckets = new Map<number, number>();
for (const record of recentHistory) {
  const hour = record.timestamp.getHours();
  hourlyBuckets.set(hour, (hourlyBuckets.get(hour) || 0) + record.totalTokens);
}
```

## Context Window Optimization

### Monitoring Context Usage

```typescript
const manager = createBudgetManager({
  defaultModel: 'claude-sonnet-4-20250514',
  limits: {
    maxTotalTokens: 200000, // Match context window
    warningThreshold: 0.7,  // Warn at 70% to leave room
  },
});

// Check before adding to context
const check = manager.checkBudget({ inputTokens: newContextSize });
if (check.warnings.length > 0) {
  console.log('Consider trimming context:', check.suggestions);
}
```

### Context Trimming Strategies

```typescript
// Get suggestions when context is large
const suggestions = manager.suggestOptimization();

for (const suggestion of suggestions) {
  if (suggestion.type === 'reduce_context') {
    console.log(`Suggestion: ${suggestion.title}`);
    console.log(`Steps: ${suggestion.steps.join(', ')}`);
    console.log(`Estimated savings: ${suggestion.estimatedSavingsPercent}%`);
  }
}
```

### Multi-Model Context Management

```typescript
const calculator = createCostCalculator();

// Compare context costs across models
const comparisons = calculator.compareModels(contextSize, estimatedOutput);

// Find best model for large context
const affordableModels = comparisons.filter(m => {
  const pricing = calculator.getPricing(m.model);
  return pricing?.contextWindow && pricing.contextWindow >= contextSize;
});

console.log('Models that support this context size:');
for (const model of affordableModels) {
  console.log(`${model.model}: $${model.cost.toFixed(4)}`);
}
```

## Priority-Based Allocation

### Priority Queue Pattern

```typescript
interface PrioritizedRequest {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  inputTokens: number;
  outputTokens: number;
  model: string;
}

function processWithPriority(
  manager: TokenBudgetManager,
  requests: PrioritizedRequest[]
): PrioritizedRequest[] {
  // Sort by priority
  const sorted = [...requests].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });

  const approved: PrioritizedRequest[] = [];

  for (const request of sorted) {
    const check = manager.checkBudget({
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
      model: request.model,
    });

    if (check.withinBudget) {
      approved.push(request);
      // Pre-allocate budget (will be confirmed with recordUsage later)
    } else if (request.priority === 'critical') {
      // Critical requests might bypass budget
      console.warn(`Critical request ${request.id} exceeds budget`);
      approved.push(request);
    } else {
      console.log(`Skipping ${request.priority} request ${request.id}: ${check.warnings[0]}`);
    }
  }

  return approved;
}
```

### Reserved Budget Pattern

```typescript
// Reserve budget for critical operations
const totalBudget = 100; // USD
const reservedForCritical = totalBudget * 0.2; // 20% reserved
const availableForGeneral = totalBudget * 0.8;

const criticalManager = createStrictBudgetManager(50000, reservedForCritical);
const generalManager = createStrictBudgetManager(200000, availableForGeneral);

function routeRequest(priority: string): TokenBudgetManager {
  return priority === 'critical' ? criticalManager : generalManager;
}
```

## Integration with JIT Tools and Context Engineering

### Just-In-Time Context Loading

```typescript
import { TokenBudgetManager } from '@wundr.io/token-budget';

interface ContextSource {
  id: string;
  priority: number;
  estimatedTokens: number;
  load: () => Promise<string>;
}

async function loadContextWithBudget(
  manager: TokenBudgetManager,
  sources: ContextSource[],
  maxContextTokens: number
): Promise<string[]> {
  // Sort by priority
  const sorted = [...sources].sort((a, b) => b.priority - a.priority);

  const loadedContext: string[] = [];
  let usedTokens = 0;

  for (const source of sorted) {
    const check = manager.checkBudget({
      inputTokens: usedTokens + source.estimatedTokens,
      outputTokens: 0,
    });

    if (usedTokens + source.estimatedTokens <= maxContextTokens && check.withinBudget) {
      const content = await source.load();
      loadedContext.push(content);
      usedTokens += source.estimatedTokens;
    } else {
      console.log(`Skipping context source ${source.id}: budget constraint`);
    }
  }

  return loadedContext;
}
```

### Dynamic Context Compression

```typescript
function compressContextForBudget(
  manager: TokenBudgetManager,
  context: string,
  targetUtilization: number = 0.7
): string {
  const status = manager.getBudgetStatus();
  const limits = manager.getConfig().limits;

  if (!limits.maxTotalTokens) return context;

  const availableTokens = limits.maxTotalTokens * targetUtilization - status.totalTokensUsed;
  const currentTokens = estimateTokensFromText(context);

  if (currentTokens <= availableTokens) {
    return context;
  }

  // Compress by ratio
  const ratio = availableTokens / currentTokens;
  const targetLength = Math.floor(context.length * ratio);

  // Simple truncation - in production, use smarter summarization
  return context.slice(0, targetLength) + '...';
}
```

### Integration with RAG Systems

```typescript
interface RAGResult {
  content: string;
  relevanceScore: number;
  tokenCount: number;
}

function selectRAGResultsWithBudget(
  manager: TokenBudgetManager,
  results: RAGResult[],
  maxContextTokens: number
): RAGResult[] {
  // Sort by relevance
  const sorted = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);

  const selected: RAGResult[] = [];
  let totalTokens = 0;

  for (const result of sorted) {
    const check = manager.checkBudget({
      inputTokens: totalTokens + result.tokenCount,
      outputTokens: 2000, // Estimated response
    });

    if (totalTokens + result.tokenCount <= maxContextTokens && check.withinBudget) {
      selected.push(result);
      totalTokens += result.tokenCount;
    }
  }

  return selected;
}
```

### Streaming with Budget Monitoring

```typescript
async function streamWithBudgetMonitoring(
  manager: TokenBudgetManager,
  streamGenerator: AsyncGenerator<string>,
  maxOutputTokens: number
): Promise<string> {
  let output = '';
  let estimatedTokens = 0;

  for await (const chunk of streamGenerator) {
    output += chunk;
    estimatedTokens = estimateTokensFromText(output);

    // Check if we're approaching limits
    const status = manager.getBudgetStatus();
    if (status.status === 'critical' || estimatedTokens >= maxOutputTokens) {
      console.warn('Stopping stream: approaching budget limit');
      break;
    }
  }

  return output;
}
```

## Configuration

### Full Configuration Options

```typescript
interface TokenBudgetConfig {
  // Default model for cost calculations
  defaultModel: string; // Default: 'claude-sonnet-4-20250514'

  // Budget limits
  limits: {
    maxTotalTokens?: number;     // Max total tokens
    maxInputTokens?: number;     // Max input tokens
    maxOutputTokens?: number;    // Max output tokens
    maxCostUsd?: number;         // Max cost in USD
    timeWindowMs?: number;       // Rolling time window (ms)
    warningThreshold: number;    // Warning threshold (0-1), default 0.8
    criticalThreshold: number;   // Critical threshold (0-1), default 0.95
  };

  // Custom model pricing
  pricingOverrides: ModelPricing[];

  // Features
  enableOptimizations: boolean;  // Enable suggestions, default true
  enableTracking: boolean;       // Enable usage tracking, default true

  // Identifiers
  sessionId?: string;
  agentId?: string;

  // Custom data
  metadata: Record<string, unknown>;
}
```

### Custom Model Pricing

```typescript
const manager = createBudgetManager({
  pricingOverrides: [
    {
      modelId: 'my-custom-model',
      inputCostPer1K: 0.001,
      outputCostPer1K: 0.005,
      contextWindow: 50000,
      isCached: true,
      cacheDiscount: 0.5, // 50% discount on cached requests
    },
  ],
});
```

## Events

Subscribe to budget events for real-time monitoring:

```typescript
manager.onEvent((event) => {
  switch (event.type) {
    case 'usage:recorded':
      console.log('Usage recorded:', event.payload.usage);
      break;
    case 'budget:warning':
      console.log('WARNING: Approaching budget limit');
      break;
    case 'budget:critical':
      console.log('CRITICAL: Near budget limit');
      break;
    case 'budget:exceeded':
      console.log('EXCEEDED: Budget limit reached');
      break;
    case 'session:started':
      console.log('Session started');
      break;
    case 'session:ended':
      console.log('Session ended:', event.payload.details);
      break;
    case 'optimization:suggested':
      console.log('Suggestions:', event.payload.suggestions);
      break;
  }
});
```

## Types

### Key Types

```typescript
// Operation types
type OperationType = 'chat' | 'completion' | 'embedding' | 'function_call' | 'tool_use' | 'other';

// Budget status levels
type BudgetStatusLevel = 'ok' | 'warning' | 'critical' | 'exceeded';

// Optimization types
type OptimizationType =
  | 'reduce_context'
  | 'use_smaller_model'
  | 'enable_caching'
  | 'batch_requests'
  | 'truncate_output'
  | 'compress_input'
  | 'use_streaming'
  | 'reduce_frequency'
  | 'other';

// Priority levels
type SuggestionPriority = 'low' | 'medium' | 'high' | 'critical';

// Difficulty levels
type SuggestionDifficulty = 'easy' | 'medium' | 'hard';
```

### Zod Schemas

All types have corresponding Zod schemas for runtime validation:

```typescript
import {
  ModelPricingSchema,
  BudgetLimitSchema,
  TokenBudgetConfigSchema,
  TokenUsageSchema,
  BudgetStatusSchema,
  OptimizationSuggestionSchema,
  SessionUsageSummarySchema,
} from '@wundr.io/token-budget';

// Validate configuration
const config = TokenBudgetConfigSchema.parse(userInput);

// Validate usage record
const usage = TokenUsageSchema.parse(externalData);
```

## License

MIT
