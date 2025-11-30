# Token Usage Reporter & Cost Calculator

Comprehensive token usage tracking, reporting, and cost estimation system for the Orchestrator Daemon.

## Overview

The Usage Reporter module provides:
- Real-time token usage tracking
- Historical usage analytics and reporting
- Cost estimation with multi-currency support
- Anomaly detection (usage spikes, budget warnings)
- Flexible storage backends (in-memory, PostgreSQL via Prisma)
- Event-driven architecture for monitoring

## Architecture

```
┌─────────────────┐
│ UsageReporter   │
│  - Record usage │◄─── TokenUsageRecord
│  - Generate     │
│    reports      │
│  - Detect       │
│    anomalies    │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ Storage  │
    │ Backend  │
    └────┬─────┘
         │
    ┌────▼────────────┐
    │ CostCalculator  │
    │  - Model pricing│
    │  - Cost calcs   │
    │  - Projections  │
    └─────────────────┘
```

## Quick Start

### Basic Usage

```typescript
import {
  UsageReporter,
  TokenUsageRecord,
  getCostCalculator
} from '@wundr.io/orchestrator-daemon/budget';

// Initialize reporter
const reporter = new UsageReporter({
  enabled: true,
  persistToDatabase: true,
  retentionDays: 90,
  anomalyDetection: {
    enabled: true,
    spikeThreshold: 2.5,
    budgetWarningThreshold: 0.8,
    budgetCriticalThreshold: 0.95
  },
  defaultCurrency: 'USD'
});

// Record usage
const usage: TokenUsageRecord = {
  id: 'usage-123',
  orchestratorId: 'orch-001',
  sessionId: 'session-456',
  timestamp: new Date(),
  modelId: 'claude-sonnet-4-5',
  provider: 'anthropic',
  inputTokens: 1000,
  outputTokens: 500,
  totalTokens: 1500,
  toolName: 'code_execution',
  metadata: { task: 'analysis' }
};

await reporter.recordUsage(usage);
```

### Generate Reports

```typescript
import { ReportParams } from '@wundr.io/orchestrator-daemon/budget';

const reportParams: ReportParams = {
  orchestratorId: 'orch-001',
  startTime: new Date('2025-11-01'),
  endTime: new Date('2025-11-30'),
  granularity: 'daily',
  groupBy: ['model', 'tool'],
  includeAnomalies: true
};

const report = await reporter.getReport(reportParams);

console.log('Usage Summary:', report.summary);
// {
//   totalInputTokens: 100000,
//   totalOutputTokens: 50000,
//   totalTokens: 150000,
//   totalRecords: 120,
//   uniqueOrchestrators: 3,
//   uniqueSessions: 45,
//   averageTokensPerSession: 3333,
//   peakUsageTimestamp: '2025-11-15T14:30:00Z',
//   peakUsageTokens: 25000
// }

console.log('Cost Estimate:', report.costEstimate);
// {
//   totalCost: 0.75,
//   currency: 'USD',
//   breakdown: [
//     {
//       modelId: 'claude-sonnet-4-5',
//       provider: 'anthropic',
//       inputTokens: 100000,
//       outputTokens: 50000,
//       inputCost: 0.30,
//       outputCost: 0.75,
//       totalCost: 1.05,
//       percentage: 100
//     }
//   ],
//   projection: {
//     projectionPeriod: 'monthly',
//     projectedCost: 22.50,
//     confidence: 0.85,
//     basedOnDays: 30
//   }
// }
```

### Cost Estimation

```typescript
const costCalculator = getCostCalculator();

// Get model pricing
const pricing = costCalculator.getModelPricing('claude-sonnet-4-5');
console.log(pricing);
// {
//   modelId: 'claude-sonnet-4-5',
//   provider: 'anthropic',
//   inputTokenCost: 3.0,  // $3 per 1M tokens
//   outputTokenCost: 15.0, // $15 per 1M tokens
//   currency: 'USD',
//   effectiveDate: '2025-01-01'
// }

// Calculate cost for records
const records: TokenUsageRecord[] = [...];
const estimate = costCalculator.calculateCostEstimate(
  records,
  'EUR',  // Target currency
  true,   // Include projection
  'monthly'
);

console.log(`Total cost: €${estimate.totalCost.toFixed(2)}`);
```

### Budget Monitoring

```typescript
// Monitor budget status
const budgetStatus = await reporter.getBudgetStatus(
  'orch-001',
  'daily',
  100000  // Daily token limit
);

console.log(budgetStatus);
// {
//   orchestratorId: 'orch-001',
//   period: 'daily',
//   limit: 100000,
//   used: 75000,
//   remaining: 25000,
//   percentage: 75,
//   status: 'warning',
//   resetAt: '2025-11-30T00:00:00Z'
// }

// Listen for budget events
reporter.on('budget-warning', (status) => {
  console.warn(`Budget warning for ${status.orchestratorId}: ${status.percentage}% used`);
});

reporter.on('budget-exceeded', (status) => {
  console.error(`Budget exceeded for ${status.orchestratorId}!`);
});
```

### Anomaly Detection

```typescript
// Detect anomalies
const anomalies = await reporter.detectAnomalies('orch-001');

for (const anomaly of anomalies) {
  console.log(`${anomaly.severity.toUpperCase()}: ${anomaly.description}`);
  console.log(`Expected: ${anomaly.expectedValue}, Actual: ${anomaly.actualValue}`);
  console.log(`Deviation: ${anomaly.deviationPercentage.toFixed(1)}%`);
}

// Listen for anomaly events
reporter.on('anomaly-detected', (anomaly) => {
  if (anomaly.severity === 'critical') {
    // Send alert
    alertOps({
      title: 'Critical Usage Anomaly',
      message: anomaly.description,
      orchestratorId: anomaly.orchestratorId
    });
  }
});
```

## Custom Storage Backend

Implement the `UsageStorage` interface for database persistence:

```typescript
import { UsageStorage, TokenUsageRecord } from '@wundr.io/orchestrator-daemon/budget';
import { PrismaClient } from '@prisma/client';

class PrismaUsageStorage implements UsageStorage {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async saveUsageRecord(record: TokenUsageRecord): Promise<void> {
    await this.prisma.tokenUsage.create({
      data: {
        id: record.id,
        orchestratorId: record.orchestratorId,
        sessionId: record.sessionId,
        timestamp: record.timestamp,
        modelId: record.modelId,
        provider: record.provider,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
        toolName: record.toolName,
        toolCallId: record.toolCallId,
        metadata: record.metadata as any
      }
    });
  }

  async getUsageRecords(params: {
    orchestratorId?: string;
    sessionId?: string;
    startTime: Date;
    endTime: Date;
  }): Promise<TokenUsageRecord[]> {
    const records = await this.prisma.tokenUsage.findMany({
      where: {
        orchestratorId: params.orchestratorId,
        sessionId: params.sessionId,
        timestamp: {
          gte: params.startTime,
          lte: params.endTime
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    return records.map(r => ({
      ...r,
      metadata: r.metadata as Record<string, unknown>
    }));
  }

  async deleteOldRecords(olderThan: Date): Promise<number> {
    const result = await this.prisma.tokenUsage.deleteMany({
      where: {
        timestamp: { lt: olderThan }
      }
    });
    return result.count;
  }
}

// Use custom storage
const storage = new PrismaUsageStorage();
const reporter = new UsageReporter({}, storage);
```

## Prisma Schema

Add to your `schema.prisma`:

```prisma
model TokenUsage {
  id             String   @id @default(cuid())
  orchestratorId String
  sessionId      String
  timestamp      DateTime @default(now())
  modelId        String
  provider       String
  inputTokens    Int
  outputTokens   Int
  totalTokens    Int
  toolName       String?
  toolCallId     String?
  metadata       Json?

  @@index([orchestratorId, timestamp])
  @@index([sessionId, timestamp])
  @@index([modelId, timestamp])
  @@index([timestamp])
  @@map("token_usage")
}
```

## Custom Model Pricing

Add custom or updated model pricing:

```typescript
import { ModelPricing } from '@wundr.io/orchestrator-daemon/budget';

const customPricing: ModelPricing[] = [
  {
    modelId: 'custom-model-v1',
    provider: 'custom',
    inputTokenCost: 5.0,
    outputTokenCost: 10.0,
    currency: 'USD',
    effectiveDate: new Date('2025-12-01')
  }
];

const calculator = getCostCalculator(customPricing);

// Or add pricing dynamically
calculator.addCustomPricing({
  modelId: 'claude-sonnet-5',
  provider: 'anthropic',
  inputTokenCost: 2.5,
  outputTokenCost: 12.5,
  currency: 'USD',
  effectiveDate: new Date('2026-01-01')
});
```

## Configuration Options

```typescript
interface UsageReporterConfig {
  enabled: boolean;                    // Enable/disable reporter (default: true)
  persistToDatabase: boolean;          // Save to database (default: true)
  retentionDays: number;              // Days to keep records (default: 90)
  aggregationIntervals: Array<        // Report intervals
    'hourly' | 'daily' | 'weekly' | 'monthly'
  >;
  anomalyDetection: {
    enabled: boolean;                 // Enable anomaly detection (default: true)
    spikeThreshold: number;           // Std deviations for spike (default: 2.5)
    windowSize: number;               // Data points to analyze (default: 100)
    minDataPoints: number;            // Min data for detection (default: 10)
    budgetWarningThreshold: number;   // Warning at % of budget (default: 0.8)
    budgetCriticalThreshold: number;  // Critical at % of budget (default: 0.95)
  };
  defaultCurrency: 'USD' | 'EUR' | 'GBP';
}
```

## Events

The UsageReporter emits the following events:

- `usage-recorded`: Fired when usage is recorded
- `anomaly-detected`: Fired when anomaly is detected
- `budget-warning`: Fired at warning threshold
- `budget-exceeded`: Fired when budget exceeded

## Supported Models

Default pricing includes:

**Anthropic:**
- claude-sonnet-4-5: $3/15 per 1M tokens (in/out)
- claude-3-opus: $15/75 per 1M tokens
- claude-3-sonnet: $3/15 per 1M tokens
- claude-3-haiku: $0.25/1.25 per 1M tokens

**OpenAI:**
- gpt-4-turbo: $10/30 per 1M tokens
- gpt-4: $30/60 per 1M tokens
- gpt-3.5-turbo: $0.5/1.5 per 1M tokens

**Google:**
- gemini-pro: $0.5/1.5 per 1M tokens
- gemini-ultra: $10/30 per 1M tokens

## Best Practices

1. **Use database storage in production**: In-memory storage is only for testing
2. **Set appropriate retention**: Balance between analytics needs and storage costs
3. **Monitor budget events**: Set up alerts for warnings and exceeded budgets
4. **Customize anomaly thresholds**: Adjust based on your usage patterns
5. **Regular cleanup**: The reporter auto-cleans old records based on retentionDays
6. **Shutdown properly**: Call `reporter.shutdown()` before process exit

## Example: Production Setup

```typescript
import { UsageReporter } from '@wundr.io/orchestrator-daemon/budget';
import { PrismaUsageStorage } from './storage';
import { sendSlackAlert, sendPagerDuty } from './alerting';

// Initialize with production config
const reporter = new UsageReporter(
  {
    enabled: true,
    persistToDatabase: true,
    retentionDays: 365,
    anomalyDetection: {
      enabled: true,
      spikeThreshold: 3.0,
      budgetWarningThreshold: 0.75,
      budgetCriticalThreshold: 0.90
    },
    defaultCurrency: 'USD'
  },
  new PrismaUsageStorage()
);

// Set up monitoring
reporter.on('budget-warning', async (status) => {
  await sendSlackAlert({
    channel: '#ops-alerts',
    message: `⚠️ Budget warning: ${status.orchestratorId} at ${status.percentage}%`
  });
});

reporter.on('budget-exceeded', async (status) => {
  await sendPagerDuty({
    severity: 'critical',
    summary: `Budget exceeded: ${status.orchestratorId}`,
    details: status
  });
});

reporter.on('anomaly-detected', async (anomaly) => {
  if (anomaly.severity === 'critical') {
    await sendPagerDuty({
      severity: 'warning',
      summary: anomaly.description,
      details: anomaly
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  reporter.shutdown();
  process.exit(0);
});
```

## API Reference

### UsageReporter

#### Methods

- `recordUsage(usage: TokenUsageRecord): Promise<void>`
- `getReport(params: ReportParams): Promise<UsageReport>`
- `getCostEstimate(params: CostParams): Promise<CostEstimate>`
- `detectAnomalies(orchestratorId: string): Promise<Anomaly[]>`
- `getBudgetStatus(orchestratorId: string, period: BudgetPeriod, limit: number): Promise<BudgetStatus>`
- `shutdown(): void`

### CostCalculator

#### Methods

- `addCustomPricing(pricing: ModelPricing): void`
- `getModelPricing(modelId: string): ModelPricing | null`
- `calculateRecordCost(record: TokenUsageRecord, currency?: Currency): number`
- `calculateCostEstimate(records: TokenUsageRecord[], currency?: Currency, includeProjection?: boolean, projectionPeriod?: Period): CostEstimate`
- `convertCurrency(amount: number, from: Currency, to: Currency): number`
- `getAllPricing(): ModelPricing[]`
- `getCostPer1KTokens(modelId: string, type: 'input' | 'output'): number | null`

## License

MIT
