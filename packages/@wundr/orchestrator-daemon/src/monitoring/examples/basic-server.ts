/**
 * Basic Metrics Server Example
 *
 * Demonstrates how to set up a basic Prometheus metrics endpoint
 * with health checks.
 */

import { createMetricsServer, metricsRegistry, daemonMetrics } from '../index';

async function main() {
  // Register metrics
  metricsRegistry.register();

  // Create metrics server
  const server = createMetricsServer(metricsRegistry, {
    port: 9090,
    host: '0.0.0.0',
    version: '1.0.0',
  });

  // Start server
  await server.start();
  console.log('Metrics server started on http://localhost:9090');
  console.log('Endpoints:');
  console.log('  - http://localhost:9090/metrics (Prometheus metrics)');
  console.log('  - http://localhost:9090/health (Health check)');
  console.log('  - http://localhost:9090/ready (Readiness probe)');

  // Simulate some metrics
  setInterval(() => {
    // Update active sessions
    daemonMetrics.sessionsActive.set(
      { orchestrator_id: 'orch-1', session_type: 'claude-code' },
      Math.floor(Math.random() * 10),
    );

    // Record token usage
    daemonMetrics.tokensUsed.inc(
      { orchestrator_id: 'orch-1', model: 'claude-sonnet-4' },
      Math.floor(Math.random() * 1000),
    );

    // Record latency
    daemonMetrics.messageLatency.observe(
      { orchestrator_id: 'orch-1' },
      Math.random() * 2,
    );

    console.log('Updated metrics...');
  }, 5000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(console.error);
