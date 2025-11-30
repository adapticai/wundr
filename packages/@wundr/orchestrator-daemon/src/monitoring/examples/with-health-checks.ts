/**
 * Metrics Server with Health Checks Example
 *
 * Demonstrates how to set up a metrics server with custom health checks
 * for Redis, database, and federation registry.
 */

import { createMetricsServer, metricsRegistry } from '../index';

// Simulated health check functions
async function checkRedisHealth(): Promise<boolean> {
  try {
    // In a real implementation, this would ping Redis
    // Example: await redisClient.ping()
    console.log('Checking Redis health...');
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // In a real implementation, this would query the database
    // Example: await db.query('SELECT 1')
    console.log('Checking database health...');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

async function checkFederationRegistryHealth(): Promise<boolean> {
  try {
    // In a real implementation, this would check federation registry
    // Example: await federationRegistry.isHealthy()
    console.log('Checking federation registry health...');
    return true;
  } catch (error) {
    console.error('Federation registry health check failed:', error);
    return false;
  }
}

async function main() {
  // Register metrics
  metricsRegistry.register();

  // Create metrics server with health checks
  const server = createMetricsServer(metricsRegistry, {
    port: 9090,
    host: '0.0.0.0',
    version: '1.0.0',
    enableCors: true,
    enableLogging: true,
    healthChecks: {
      redis: checkRedisHealth,
      database: checkDatabaseHealth,
      federationRegistry: checkFederationRegistryHealth,
    },
  });

  // Start server
  await server.start();
  console.log('Metrics server with health checks started on http://localhost:9090');
  console.log('\nEndpoints:');
  console.log('  - GET http://localhost:9090/metrics');
  console.log('  - GET http://localhost:9090/health');
  console.log('  - GET http://localhost:9090/ready');

  console.log('\nTry these commands:');
  console.log('  curl http://localhost:9090/health | jq');
  console.log('  curl http://localhost:9090/metrics');
  console.log('  curl http://localhost:9090/ready | jq');

  // Simulate readiness state changes
  setTimeout(() => {
    console.log('\nSimulating not ready state...');
    server.setReady(false);
  }, 10000);

  setTimeout(() => {
    console.log('\nSimulating ready state...');
    server.setReady(true);
  }, 20000);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    server.setReady(false); // Mark as not ready
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for in-flight requests
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
