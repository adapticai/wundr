/**
 * Kubernetes Integration Example
 *
 * Demonstrates how to set up metrics server for Kubernetes deployment
 * with liveness and readiness probes.
 */

import {
  createMetricsServer,
  metricsRegistry,
  MetricsCollector,
} from '../index';

/**
 * Application state management
 */
class Application {
  private isInitialized = false;
  private isShuttingDown = false;
  private metricsServer: any;
  private collector: MetricsCollector;

  constructor() {
    this.collector = new MetricsCollector(metricsRegistry);
  }

  async initialize(): Promise<void> {
    console.log('Initializing application...');

    // Register metrics
    metricsRegistry.register();

    // Create metrics server
    this.metricsServer = createMetricsServer(metricsRegistry, {
      port: Number(process.env.METRICS_PORT) || 9090,
      host: '0.0.0.0',
      version: process.env.APP_VERSION || '1.0.0',
      healthChecks: {
        redis: this.checkRedis.bind(this),
        database: this.checkDatabase.bind(this),
        federationRegistry: this.checkFederationRegistry.bind(this),
      },
    });

    // Start metrics server
    await this.metricsServer.start();
    console.log('Metrics server started');

    // Initialize other components
    await this.initializeComponents();

    // Mark as ready
    this.isInitialized = true;
    this.metricsServer.setReady(true);
    console.log('Application initialized and ready');
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    console.log('Shutting down application...');
    this.isShuttingDown = true;

    // Mark as not ready (stop accepting new traffic)
    this.metricsServer?.setReady(false);

    // Wait for in-flight requests to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Close collector
    this.collector.close();

    // Stop metrics server
    await this.metricsServer?.stop();

    console.log('Application shutdown complete');
  }

  private async initializeComponents(): Promise<void> {
    // Simulate component initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async checkRedis(): Promise<boolean> {
    if (this.isShuttingDown) {
      return false;
    }
    // Implement actual Redis check
    return this.isInitialized;
  }

  private async checkDatabase(): Promise<boolean> {
    if (this.isShuttingDown) {
      return false;
    }
    // Implement actual database check
    return this.isInitialized;
  }

  private async checkFederationRegistry(): Promise<boolean> {
    if (this.isShuttingDown) {
      return false;
    }
    // Implement actual federation registry check
    return this.isInitialized;
  }

  async run(): Promise<void> {
    // Simulate application work
    setInterval(() => {
      if (!this.isShuttingDown) {
        this.collector.recordSessionStart('orch-k8s', 'claude-code');
        this.collector.recordTokenUsage('orch-k8s', 'claude-sonnet-4', 1000);
        this.collector.updateNodeLoad('node-1', Math.random());
      }
    }, 5000);
  }
}

async function main() {
  const app = new Application();

  try {
    await app.initialize();
    await app.run();

    console.log('\nKubernetes probes:');
    console.log('  Liveness:  http://localhost:9090/health');
    console.log('  Readiness: http://localhost:9090/ready');
    console.log('  Metrics:   http://localhost:9090/metrics');

    // Setup graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, initiating graceful shutdown...`);
        await app.shutdown();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();

/**
 * Example Kubernetes Deployment YAML:
 *
 * apiVersion: apps/v1
 * kind: Deployment
 * metadata:
 *   name: orchestrator-daemon
 * spec:
 *   replicas: 3
 *   selector:
 *     matchLabels:
 *       app: orchestrator-daemon
 *   template:
 *     metadata:
 *       labels:
 *         app: orchestrator-daemon
 *       annotations:
 *         prometheus.io/scrape: "true"
 *         prometheus.io/port: "9090"
 *         prometheus.io/path: "/metrics"
 *     spec:
 *       containers:
 *       - name: orchestrator-daemon
 *         image: orchestrator-daemon:latest
 *         ports:
 *         - name: metrics
 *           containerPort: 9090
 *           protocol: TCP
 *         env:
 *         - name: METRICS_PORT
 *           value: "9090"
 *         - name: APP_VERSION
 *           value: "1.0.0"
 *         livenessProbe:
 *           httpGet:
 *             path: /health
 *             port: metrics
 *           initialDelaySeconds: 30
 *           periodSeconds: 10
 *           timeoutSeconds: 5
 *           failureThreshold: 3
 *         readinessProbe:
 *           httpGet:
 *             path: /ready
 *             port: metrics
 *           initialDelaySeconds: 10
 *           periodSeconds: 5
 *           timeoutSeconds: 3
 *           failureThreshold: 2
 *         resources:
 *           requests:
 *             cpu: 100m
 *             memory: 128Mi
 *           limits:
 *             cpu: 500m
 *             memory: 512Mi
 * ---
 * apiVersion: v1
 * kind: Service
 * metadata:
 *   name: orchestrator-daemon-metrics
 *   labels:
 *     app: orchestrator-daemon
 * spec:
 *   type: ClusterIP
 *   ports:
 *   - name: metrics
 *     port: 9090
 *     targetPort: metrics
 *     protocol: TCP
 *   selector:
 *     app: orchestrator-daemon
 * ---
 * apiVersion: monitoring.coreos.com/v1
 * kind: ServiceMonitor
 * metadata:
 *   name: orchestrator-daemon
 *   labels:
 *     release: prometheus
 * spec:
 *   selector:
 *     matchLabels:
 *       app: orchestrator-daemon
 *   endpoints:
 *   - port: metrics
 *     interval: 30s
 *     path: /metrics
 */
