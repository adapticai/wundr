/**
 * Example: MetricsCollector Usage
 *
 * Demonstrates how to use the MetricsCollector for recording
 * orchestrator metrics with batching and timing utilities.
 */

import { MetricsRegistry, createMetricsCollector } from '../index';

async function example() {
  // Create metrics registry
  const registry = new MetricsRegistry();
  registry.register();

  // Create metrics collector with batching enabled
  const collector = createMetricsCollector(registry, {
    enableBatching: true,
    batchFlushInterval: 5000, // Flush every 5 seconds
    maxBatchSize: 100, // Auto-flush when batch reaches 100 updates
    debug: true, // Enable debug logging
  });

  // Example 1: Record session lifecycle
  console.log('Example 1: Session lifecycle');
  collector.recordSessionStart('orch-1', 'claude-code');

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 1000));

  collector.recordSessionEnd('orch-1', 'claude-code');

  // Example 2: Record token usage
  console.log('\nExample 2: Token usage');
  collector.recordTokenUsage('orch-1', 'claude-sonnet-3.5', 1500);
  collector.recordTokenUsage('orch-1', 'claude-sonnet-3.5', 800);
  collector.recordTokenUsage('orch-2', 'claude-opus-3', 2500);

  // Example 3: Record message latency
  console.log('\nExample 3: Message latency');
  collector.recordMessageLatency('orch-1', 150); // 150ms
  collector.recordMessageLatency('orch-1', 230); // 230ms
  collector.recordMessageLatency('orch-2', 95);  // 95ms

  // Example 4: Use timer utility
  console.log('\nExample 4: Timer utility');
  const endTimer = collector.startTimer();

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 500));

  const durationMs = endTimer({ orchestrator_id: 'orch-1' });
  console.log(`Task completed in ${durationMs}ms`);

  // Record the timing
  collector.recordMessageLatency('orch-1', durationMs);

  // Example 5: Wrap function with automatic timing
  console.log('\nExample 5: Function timing');
  async function processTask() {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { status: 'completed' };
  }

  const result = await collector.withMetrics(
    processTask,
    { orchestrator_id: 'orch-1' },
  );
  console.log('Task result:', result);

  // Example 6: Record tool invocations
  console.log('\nExample 6: Tool invocations');
  collector.recordToolInvocation('orch-1', 'file_read', 'success');
  collector.recordToolInvocation('orch-1', 'bash_exec', 'success');
  collector.recordToolInvocation('orch-1', 'api_call', 'error');
  collector.recordToolInvocation('orch-2', 'file_write', 'timeout');

  // Example 7: Record delegations
  console.log('\nExample 7: Federation delegations');
  collector.recordDelegation('orch-1', 'orch-2', 'success');
  collector.recordDelegation('orch-1', 'orch-3', 'rejected');
  collector.recordDelegation('orch-2', 'orch-3', 'success');

  // Example 8: Record errors
  console.log('\nExample 8: Error recording');
  collector.recordError('orch-1', 'timeout_error');
  collector.recordError('orch-1', 'api_error');
  collector.recordError('orch-2', 'memory_limit_exceeded');

  // Example 9: Update resource metrics
  console.log('\nExample 9: Resource metrics');
  collector.updateNodeLoad('node-1', 0.65); // 65% load
  collector.updateNodeLoad('node-2', 0.42); // 42% load
  collector.updateBudgetUtilization('orch-1', 'daily', 75.5); // 75.5% daily budget used
  collector.updateBudgetUtilization('orch-2', 'monthly', 42.0); // 42% monthly budget used

  // Flush all pending batched updates
  console.log('\nFlushing batched updates...');
  collector.flush();

  // Example 10: Get aggregated statistics
  console.log('\nExample 10: Aggregated statistics');
  const stats = await collector.getAggregatedStats('orch-1');
  console.log('Aggregated stats for orch-1:', JSON.stringify(stats, null, 2));

  // Example 11: Export metrics in Prometheus format
  console.log('\nExample 11: Prometheus metrics export');
  const prometheusMetrics = await registry.collect();
  console.log('Prometheus format (first 500 chars):', prometheusMetrics.substring(0, 500));

  // Cleanup
  console.log('\nCleaning up...');
  collector.close();

  console.log('\nMetricsCollector example completed!');
}

// Run the example
if (require.main === module) {
  example().catch(console.error);
}

export { example };
