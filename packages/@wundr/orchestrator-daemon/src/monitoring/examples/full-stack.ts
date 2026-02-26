/**
 * Full Stack Monitoring Example
 *
 * Demonstrates complete monitoring setup with:
 * - Metrics Registry
 * - Metrics Collector
 * - Metrics Server with health checks
 * - Simulated orchestrator workload
 */

import {
  createMetricsServer,
  createMetricsCollector,
  metricsRegistry,
  type MetricsServer,
  type MetricsCollector,
} from '../index';

/**
 * Simulated orchestrator workload
 */
class OrchestratorWorkload {
  private collector: MetricsCollector;
  private orchestratorId: string;
  private isRunning = false;
  private workloadInterval?: NodeJS.Timeout;

  constructor(collector: MetricsCollector, orchestratorId: string) {
    this.collector = collector;
    this.orchestratorId = orchestratorId;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    console.log(`Starting workload for ${this.orchestratorId}...`);
    this.isRunning = true;

    // Simulate session start
    this.collector.recordSessionStart(this.orchestratorId, 'claude-code');

    // Simulate periodic work
    this.workloadInterval = setInterval(() => {
      this.simulateWork();
    }, 2000);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log(`Stopping workload for ${this.orchestratorId}...`);
    this.isRunning = false;

    if (this.workloadInterval) {
      clearInterval(this.workloadInterval);
    }

    // Record session end
    this.collector.recordSessionEnd(this.orchestratorId, 'claude-code');
  }

  private async simulateWork(): Promise<void> {
    // Simulate message processing with timing
    const endTimer = this.collector.startTimer();

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    const durationMs = endTimer();
    this.collector.recordMessageLatency(this.orchestratorId, durationMs);

    // Record token usage
    const tokens = Math.floor(Math.random() * 2000) + 500;
    this.collector.recordTokenUsage(
      this.orchestratorId,
      'claude-sonnet-4',
      tokens
    );

    // Simulate tool invocations
    const tools = ['read_file', 'write_file', 'bash', 'grep'];
    const tool = tools[Math.floor(Math.random() * tools.length)];
    const success = Math.random() > 0.1; // 90% success rate

    this.collector.recordToolInvocation(
      this.orchestratorId,
      tool,
      success ? 'success' : 'error'
    );

    // Occasionally record errors
    if (Math.random() < 0.05) {
      this.collector.recordError(this.orchestratorId, 'timeout');
    }

    // Update node load
    const load = Math.random() * 0.8 + 0.2; // 20-100% load
    this.collector.updateNodeLoad(this.orchestratorId, load);

    // Update budget utilization
    const budgetPercent = Math.random() * 80 + 10; // 10-90%
    this.collector.updateBudgetUtilization(
      this.orchestratorId,
      'daily',
      budgetPercent
    );

    // Occasionally record delegations
    if (Math.random() < 0.1) {
      const delegateSuccess = Math.random() > 0.05; // 95% success
      this.collector.recordDelegation(
        this.orchestratorId,
        'orch-federation',
        delegateSuccess ? 'success' : 'error'
      );
    }

    console.log(
      `[${this.orchestratorId}] Processed message in ${durationMs}ms, ` +
        `used ${tokens} tokens, invoked ${tool} (${success ? 'success' : 'error'})`
    );
  }
}

/**
 * Monitoring stack manager
 */
class MonitoringStack {
  private server?: MetricsServer;
  private collector?: MetricsCollector;
  private workloads: OrchestratorWorkload[] = [];
  private statsInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    console.log('Initializing monitoring stack...\n');

    // 1. Register metrics
    metricsRegistry.register();
    console.log('✓ Metrics registry initialized');

    // 2. Create collector with batching
    this.collector = createMetricsCollector(metricsRegistry, {
      enableBatching: true,
      batchFlushInterval: 5000,
      maxBatchSize: 100,
      debug: false,
    });
    console.log('✓ Metrics collector created');

    // 3. Create metrics server with health checks
    this.server = createMetricsServer(metricsRegistry, {
      port: 9090,
      host: '0.0.0.0',
      version: '1.0.6',
      enableCors: true,
      enableLogging: true,
      healthChecks: {
        redis: async () => {
          // Simulate Redis health check
          return Math.random() > 0.05; // 95% uptime
        },
        database: async () => {
          // Simulate database health check
          return Math.random() > 0.02; // 98% uptime
        },
        federationRegistry: async () => {
          // Simulate federation registry health check
          return Math.random() > 0.01; // 99% uptime
        },
      },
    });

    await this.server.start();
    console.log('✓ Metrics server started on http://localhost:9090\n');

    // 4. Create workload simulators
    const orchestratorIds = ['orch-1', 'orch-2', 'orch-3'];
    for (const id of orchestratorIds) {
      const workload = new OrchestratorWorkload(this.collector, id);
      this.workloads.push(workload);
    }
    console.log(`✓ Created ${this.workloads.length} workload simulators\n`);

    this.printInstructions();
  }

  startWorkloads(): void {
    console.log('Starting all workloads...\n');
    this.workloads.forEach(w => w.start());

    // Print stats periodically
    this.statsInterval = setInterval(() => {
      this.printStats();
    }, 10000);
  }

  stopWorkloads(): void {
    console.log('\nStopping all workloads...\n');
    this.workloads.forEach(w => w.stop());

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
  }

  async shutdown(): Promise<void> {
    console.log('\nShutting down monitoring stack...\n');

    this.stopWorkloads();

    if (this.collector) {
      this.collector.close();
      console.log('✓ Collector closed');
    }

    if (this.server) {
      await this.server.stop();
      console.log('✓ Server stopped');
    }

    console.log('\nShutdown complete');
  }

  private printInstructions(): void {
    console.log('━'.repeat(70));
    console.log('MONITORING ENDPOINTS');
    console.log('━'.repeat(70));
    console.log('');
    console.log('  Metrics:   http://localhost:9090/metrics');
    console.log('  Health:    http://localhost:9090/health');
    console.log('  Readiness: http://localhost:9090/ready');
    console.log('');
    console.log('━'.repeat(70));
    console.log('QUICK COMMANDS');
    console.log('━'.repeat(70));
    console.log('');
    console.log('  # View all metrics');
    console.log('  curl http://localhost:9090/metrics');
    console.log('');
    console.log('  # Check health status');
    console.log('  curl http://localhost:9090/health | jq');
    console.log('');
    console.log('  # Check readiness');
    console.log('  curl http://localhost:9090/ready | jq');
    console.log('');
    console.log('  # Filter specific metric');
    console.log(
      '  curl -s http://localhost:9090/metrics | grep orchestrator_sessions'
    );
    console.log('');
    console.log('  # Watch metrics update (requires watch command)');
    console.log(
      '  watch -n 2 "curl -s http://localhost:9090/metrics | grep sessions_active"'
    );
    console.log('');
    console.log('━'.repeat(70));
    console.log('');
  }

  private async printStats(): Promise<void> {
    console.log('\n━'.repeat(70));
    console.log('AGGREGATED STATISTICS');
    console.log('━'.repeat(70));

    if (!this.collector) {
      return;
    }

    for (const workload of this.workloads) {
      const orchestratorId = (workload as any).orchestratorId;
      const stats = await this.collector.getAggregatedStats(orchestratorId);

      console.log(`\n${orchestratorId}:`);
      console.log(`  Sessions:       ${stats.totalSessions}`);
      console.log(`  Tokens:         ${stats.totalTokens.toLocaleString()}`);
      console.log(`  Avg Latency:    ${stats.avgLatency.toFixed(2)}ms`);
      console.log(`  Tool Calls:     ${stats.toolInvocations}`);
      console.log(
        `  Success Rate:   ${
          stats.toolInvocations > 0
            ? (
                (stats.successfulToolCalls / stats.toolInvocations) *
                100
              ).toFixed(1)
            : 0
        }%`
      );
      console.log(`  Delegations:    ${stats.delegations}`);
    }

    console.log('\n' + '━'.repeat(70) + '\n');
  }
}

/**
 * Main function
 */
async function main() {
  const stack = new MonitoringStack();

  try {
    // Initialize monitoring stack
    await stack.initialize();

    // Start simulated workloads
    stack.startWorkloads();

    // Handle graceful shutdown
    const shutdown = async () => {
      await stack.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start monitoring stack:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { MonitoringStack, OrchestratorWorkload };
