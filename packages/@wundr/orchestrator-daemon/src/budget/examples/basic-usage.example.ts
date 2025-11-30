/**
 * Basic Usage Reporter Examples
 *
 * This file demonstrates common usage patterns for the
 * token usage reporter and cost calculator.
 */

import {
  UsageReporter,
  CostCalculator,
  getCostCalculator,
  TokenUsageRecord,
  ReportParams,
  BudgetStatus,
} from '../index';

/**
 * Example 1: Basic Setup and Usage Recording
 */
async function example1_basicSetup() {
  console.log('=== Example 1: Basic Setup ===\n');

  // Create reporter with default config
  const reporter = new UsageReporter({
    enabled: true,
    persistToDatabase: false, // Using in-memory for demo
    retentionDays: 30,
    defaultCurrency: 'USD',
  });

  // Record some usage
  const usage: TokenUsageRecord = {
    id: 'usage-001',
    orchestratorId: 'orch-analytics',
    sessionId: 'session-abc123',
    timestamp: new Date(),
    modelId: 'claude-sonnet-4-5',
    provider: 'anthropic',
    inputTokens: 5000,
    outputTokens: 2000,
    totalTokens: 7000,
    toolName: 'code_analysis',
  };

  await reporter.recordUsage(usage);
  console.log('✓ Usage recorded successfully');

  // Calculate cost
  const calculator = getCostCalculator();
  const cost = calculator.calculateRecordCost(usage);
  console.log(`Cost: $${cost.toFixed(4)}`);
  // Expected: $0.0450 (5K * $3/1M + 2K * $15/1M)

  reporter.shutdown();
}

/**
 * Example 2: Generate Usage Report
 */
async function example2_generateReport() {
  console.log('\n=== Example 2: Generate Report ===\n');

  const reporter = new UsageReporter();

  // Simulate a week of usage
  const startTime = new Date('2025-11-01');
  const endTime = new Date('2025-11-07');

  for (let day = 0; day < 7; day++) {
    for (let session = 0; session < 5; session++) {
      const usage: TokenUsageRecord = {
        id: `usage-${day}-${session}`,
        orchestratorId: 'orch-backend',
        sessionId: `session-${day}-${session}`,
        timestamp: new Date(startTime.getTime() + day * 24 * 60 * 60 * 1000),
        modelId: day % 2 === 0 ? 'claude-sonnet-4-5' : 'claude-3-haiku',
        provider: 'anthropic',
        inputTokens: 3000 + Math.random() * 2000,
        outputTokens: 1500 + Math.random() * 1000,
        totalTokens: 4500 + Math.random() * 3000,
        toolName: ['code_gen', 'testing', 'analysis'][session % 3],
      };
      await reporter.recordUsage(usage);
    }
  }

  // Generate report
  const params: ReportParams = {
    orchestratorId: 'orch-backend',
    startTime,
    endTime,
    granularity: 'daily',
    groupBy: ['model', 'tool'],
  };

  const report = await reporter.getReport(params);

  console.log('Report Summary:');
  console.log(`  Total tokens: ${report.summary.totalTokens.toLocaleString()}`);
  console.log(`  Total sessions: ${report.summary.uniqueSessions}`);
  console.log(`  Avg tokens/session: ${Math.round(report.summary.averageTokensPerSession)}`);

  console.log('\nCost Estimate:');
  console.log(`  Total cost: $${report.costEstimate.totalCost.toFixed(2)}`);
  console.log(`  Projected monthly: $${report.costEstimate.projection?.projectedCost.toFixed(2)}`);

  console.log('\nTop Models:');
  report.breakdown
    .filter((b) => b.type === 'model')
    .slice(0, 3)
    .forEach((item) => {
      console.log(`  ${item.key}: ${item.percentage.toFixed(1)}% ($${item.cost?.toFixed(2)})`);
    });

  reporter.shutdown();
}

/**
 * Example 3: Budget Monitoring with Events
 */
async function example3_budgetMonitoring() {
  console.log('\n=== Example 3: Budget Monitoring ===\n');

  const reporter = new UsageReporter({
    anomalyDetection: {
      enabled: true,
      budgetWarningThreshold: 0.7, // Warn at 70%
      budgetCriticalThreshold: 0.9, // Critical at 90%
      spikeThreshold: 2.5,
      windowSize: 100,
      minDataPoints: 5,
    },
  });

  // Set up event listeners
  reporter.on('budget-warning', (status: BudgetStatus) => {
    console.log(`⚠️  WARNING: ${status.orchestratorId} at ${status.percentage.toFixed(1)}% of budget`);
  });

  reporter.on('budget-exceeded', (status: BudgetStatus) => {
    console.log(`🚨 CRITICAL: ${status.orchestratorId} exceeded budget!`);
  });

  // Simulate usage approaching budget
  const dailyLimit = 100000; // 100K tokens/day
  const orchestratorId = 'orch-frontend';

  // Use 60% of budget - should be fine
  await reporter.recordUsage({
    id: 'usage-1',
    orchestratorId,
    sessionId: 'session-1',
    timestamp: new Date(),
    modelId: 'claude-3-haiku',
    provider: 'anthropic',
    inputTokens: 40000,
    outputTokens: 20000,
    totalTokens: 60000,
  });

  let status = await reporter.getBudgetStatus(orchestratorId, 'daily', dailyLimit);
  console.log(`Status after 60% usage: ${status.status} (${status.percentage.toFixed(1)}%)`);

  // Use another 20% - should trigger warning
  await reporter.recordUsage({
    id: 'usage-2',
    orchestratorId,
    sessionId: 'session-2',
    timestamp: new Date(),
    modelId: 'claude-3-haiku',
    provider: 'anthropic',
    inputTokens: 13333,
    outputTokens: 6667,
    totalTokens: 20000,
  });

  status = await reporter.getBudgetStatus(orchestratorId, 'daily', dailyLimit);

  // Use another 25% - should trigger critical
  await reporter.recordUsage({
    id: 'usage-3',
    orchestratorId,
    sessionId: 'session-3',
    timestamp: new Date(),
    modelId: 'claude-3-haiku',
    provider: 'anthropic',
    inputTokens: 16667,
    outputTokens: 8333,
    totalTokens: 25000,
  });

  status = await reporter.getBudgetStatus(orchestratorId, 'daily', dailyLimit);

  reporter.shutdown();
}

/**
 * Example 4: Multi-Currency Cost Comparison
 */
async function example4_multiCurrency() {
  console.log('\n=== Example 4: Multi-Currency Comparison ===\n');

  const reporter = new UsageReporter();
  const calculator = getCostCalculator();

  // Record some usage
  const usage: TokenUsageRecord = {
    id: 'usage-mc',
    orchestratorId: 'orch-global',
    sessionId: 'session-mc',
    timestamp: new Date(),
    modelId: 'gpt-4-turbo',
    provider: 'openai',
    inputTokens: 10000,
    outputTokens: 5000,
    totalTokens: 15000,
  };

  await reporter.recordUsage(usage);

  // Calculate in different currencies
  const costUSD = calculator.calculateRecordCost(usage, 'USD');
  const costEUR = calculator.calculateRecordCost(usage, 'EUR');
  const costGBP = calculator.calculateRecordCost(usage, 'GBP');

  console.log('Cost Comparison:');
  console.log(`  USD: $${costUSD.toFixed(4)}`);
  console.log(`  EUR: €${costEUR.toFixed(4)}`);
  console.log(`  GBP: £${costGBP.toFixed(4)}`);

  // Manual calculation verification
  // Input: 10K * $10/1M = $0.10
  // Output: 5K * $30/1M = $0.15
  // Total: $0.25
  console.log('\nExpected USD: $0.2500');

  reporter.shutdown();
}

/**
 * Example 5: Custom Model Pricing
 */
async function example5_customPricing() {
  console.log('\n=== Example 5: Custom Model Pricing ===\n');

  const calculator = getCostCalculator();

  // Add custom model pricing
  calculator.addCustomPricing({
    modelId: 'custom-model-v1',
    provider: 'custom',
    inputTokenCost: 5.0,
    outputTokenCost: 10.0,
    currency: 'USD',
    effectiveDate: new Date(),
  });

  // Use the custom model
  const reporter = new UsageReporter({}, undefined, calculator);

  const usage: TokenUsageRecord = {
    id: 'usage-custom',
    orchestratorId: 'orch-custom',
    sessionId: 'session-custom',
    timestamp: new Date(),
    modelId: 'custom-model-v1',
    provider: 'custom',
    inputTokens: 20000,
    outputTokens: 10000,
    totalTokens: 30000,
  };

  await reporter.recordUsage(usage);

  const cost = calculator.calculateRecordCost(usage);
  console.log(`Custom model cost: $${cost.toFixed(4)}`);
  // Expected: 20K * $5/1M + 10K * $10/1M = $0.10 + $0.10 = $0.20

  // List all available pricing
  console.log('\nAll Available Models:');
  calculator.getAllPricing().forEach((pricing) => {
    console.log(`  ${pricing.modelId} (${pricing.provider}): $${pricing.inputTokenCost}/$${pricing.outputTokenCost} per 1M tokens`);
  });

  reporter.shutdown();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  await example1_basicSetup();
  await example2_generateReport();
  await example3_budgetMonitoring();
  await example4_multiCurrency();
  await example5_customPricing();
  console.log('\n✓ All examples completed successfully!\n');
}

// Export for direct usage
export {
  example1_basicSetup,
  example2_generateReport,
  example3_budgetMonitoring,
  example4_multiCurrency,
  example5_customPricing,
  runAllExamples,
};

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
