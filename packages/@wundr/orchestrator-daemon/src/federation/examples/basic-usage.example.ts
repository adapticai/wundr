/**
 * Federation Registry - Basic Usage Example
 *
 * Demonstrates how to use the FederationRegistry for multi-orchestrator coordination.
 */

import { FederationRegistry } from '../registry';

import type { RegistryOrchestratorMetadata, FederationRegistryConfig } from '../registry-types';

async function main() {
  // Configuration
  const config: FederationRegistryConfig = {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'neolith',
    },
    heartbeatTimeout: 30000, // 30 seconds
    staleTimeout: 300000, // 5 minutes
    cleanupInterval: 60000, // 1 minute
  };

  // Create registry
  const registry = new FederationRegistry(config);

  // Listen for events
  registry.on('orchestrator:registered', (metadata) => {
    console.log(`✅ Orchestrator registered: ${metadata.name} (${metadata.id})`);
  });

  registry.on('orchestrator:deregistered', (id) => {
    console.log(`❌ Orchestrator deregistered: ${id}`);
  });

  registry.on('orchestrator:status_changed', (id, oldStatus, newStatus) => {
    console.log(`🔄 Status changed for ${id}: ${oldStatus} → ${newStatus}`);
  });

  registry.on('orchestrator:unhealthy', (id, lastHeartbeat) => {
    console.log(`⚠️  Orchestrator ${id} is unhealthy (last heartbeat: ${lastHeartbeat})`);
  });

  registry.on('heartbeat:received', (id, timestamp) => {
    console.log(`💓 Heartbeat from ${id} at ${timestamp}`);
  });

  // Register orchestrators
  const orchestrator1: RegistryOrchestratorMetadata = {
    id: 'orch-us-east-1',
    name: 'US East Primary',
    capabilities: ['text-generation', 'code-completion', 'analysis'],
    region: 'us-east-1',
    tier: 'production',
    maxSessions: 100,
    currentSessions: 0,
    tokensUsed: 0,
    tokenLimit: 10000000,
    status: 'online',
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
    metadata: {
      version: '1.0.0',
    },
  };

  const orchestrator2: RegistryOrchestratorMetadata = {
    id: 'orch-us-west-2',
    name: 'US West Secondary',
    capabilities: ['text-generation', 'code-completion'],
    region: 'us-west-2',
    tier: 'staging',
    maxSessions: 50,
    currentSessions: 0,
    tokensUsed: 0,
    tokenLimit: 5000000,
    status: 'online',
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
    metadata: {
      version: '1.0.0',
    },
  };

  const orchestrator3: RegistryOrchestratorMetadata = {
    id: 'orch-eu-west-1',
    name: 'EU West Primary',
    capabilities: ['text-generation', 'analysis', 'research'],
    region: 'eu-west-1',
    tier: 'production',
    maxSessions: 75,
    currentSessions: 0,
    tokensUsed: 0,
    tokenLimit: 7500000,
    status: 'online',
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
    metadata: {
      version: '1.0.0',
    },
  };

  await registry.registerOrchestrator(orchestrator1);
  await registry.registerOrchestrator(orchestrator2);
  await registry.registerOrchestrator(orchestrator3);

  console.log('\n📊 Registry Status:');

  // Get all orchestrators
  const allOrchestrators = await registry.getAllOrchestrators();
  console.log(`\nTotal orchestrators: ${allOrchestrators.length}`);

  // Find orchestrators by capability
  console.log('\n🔍 Finding orchestrators with code-completion capability:');
  const codeCompletionOrchestrators = await registry.getOrchestratorsByCapability([
    'code-completion',
  ]);
  codeCompletionOrchestrators.forEach(orch => {
    console.log(`  - ${orch.name} (${orch.id}) in ${orch.region}`);
  });

  // Find orchestrators by region
  console.log('\n🌍 Finding orchestrators in us-east-1:');
  const usEastOrchestrators = await registry.getOrchestratorsByRegion('us-east-1');
  usEastOrchestrators.forEach(orch => {
    console.log(`  - ${orch.name} (${orch.id})`);
  });

  // Complex query
  console.log('\n🎯 Complex query: production orchestrators with text-generation:');
  const productionOrchestrators = await registry.queryOrchestrators({
    capabilities: ['text-generation'],
    status: ['online'],
    minAvailableSessions: 20,
  });
  productionOrchestrators.forEach(orch => {
    console.log(`  - ${orch.name} (${orch.id}) - ${orch.maxSessions} max sessions`);
  });

  // Simulate session load
  console.log('\n📈 Simulating session load...');
  await registry.updateMetrics('orch-us-east-1', {
    currentSessions: 45,
    tokensUsed: 2500000,
  });

  // Get metrics
  const metrics = await registry.getOrchestratorMetrics('orch-us-east-1');
  if (metrics) {
    console.log('\n📊 Metrics for orch-us-east-1:');
    console.log(`  Load: ${(metrics.load * 100).toFixed(1)}%`);
    console.log(`  Sessions: ${metrics.sessions} / ${orchestrator1.maxSessions}`);
    console.log(`  Token utilization: ${(metrics.tokenUtilization * 100).toFixed(1)}%`);
    console.log(`  Uptime: ${(metrics.uptime / 1000).toFixed(0)}s`);
  }

  // Get healthy orchestrators
  console.log('\n💚 Healthy orchestrators:');
  const healthyOrchestrators = await registry.getHealthyOrchestrators();
  healthyOrchestrators.forEach(orch => {
    console.log(`  - ${orch.name} (${orch.status})`);
  });

  // Simulate heartbeat
  console.log('\n💓 Sending heartbeat for orch-us-east-1...');
  await registry.updateHeartbeat('orch-us-east-1');

  // Change status to busy
  console.log('\n🔄 Changing orch-us-west-2 status to busy...');
  await registry.updateStatus('orch-us-west-2', 'busy');

  // Health check
  const healthy = await registry.healthCheck();
  console.log(`\n🏥 Registry health check: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  await registry.deregisterOrchestrator('orch-eu-west-1');

  // Wait a bit for events to process
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Disconnect
  await registry.disconnect();
  console.log('\n✅ Example completed');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
