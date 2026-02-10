/**
 * LoadBalancer Usage Examples
 */

import { LoadBalancer } from '../load-balancer';

import type { LoadBalancerNode } from '../load-balancer';

/**
 * Example 1: Basic Round-Robin Load Balancing
 */
function basicRoundRobin() {
  console.log('\n=== Example 1: Basic Round-Robin ===\n');

  const lb = new LoadBalancer('round-robin');

  // Add nodes
  const nodes: LoadBalancerNode[] = [
    {
      id: 'node-1',
      endpoint: 'http://10.0.1.10:8787',
      region: 'us-east-1',
      capabilities: ['session-management', 'task-execution'],
      capacity: 1.0,
    },
    {
      id: 'node-2',
      endpoint: 'http://10.0.1.11:8787',
      region: 'us-east-1',
      capabilities: ['session-management', 'task-execution'],
      capacity: 1.0,
    },
    {
      id: 'node-3',
      endpoint: 'http://10.0.1.12:8787',
      region: 'us-west-1',
      capabilities: ['session-management', 'task-execution'],
      capacity: 1.0,
    },
  ];

  nodes.forEach((node) => lb.addNode(node));

  // Select nodes in round-robin fashion
  console.log('Selecting nodes in round-robin:');
  for (let i = 0; i < 5; i++) {
    const selected = lb.selectNode();
    console.log(`  Selection ${i + 1}: ${selected?.id}`);
  }

  // Output:
  // Selection 1: node-1
  // Selection 2: node-2
  // Selection 3: node-3
  // Selection 4: node-1
  // Selection 5: node-2
}

/**
 * Example 2: Least Connections Strategy
 */
function leastConnections() {
  console.log('\n=== Example 2: Least Connections ===\n');

  const lb = new LoadBalancer('least-connections');

  // Add nodes
  lb.addNode({
    id: 'node-1',
    endpoint: 'http://10.0.1.10:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  lb.addNode({
    id: 'node-2',
    endpoint: 'http://10.0.1.11:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  // Simulate different connection counts
  lb.updateActiveConnections('node-1', 15);
  lb.updateActiveConnections('node-2', 5);

  console.log('Current connections:');
  console.log(`  node-1: ${lb.getNodeLoad('node-1')?.activeConnections}`);
  console.log(`  node-2: ${lb.getNodeLoad('node-2')?.activeConnections}`);

  const selected = lb.selectNode();
  console.log(`\nSelected node: ${selected?.id} (least connections)`);

  // Output:
  // Current connections:
  //   node-1: 15
  //   node-2: 5
  // Selected node: node-2 (least connections)
}

/**
 * Example 3: Weighted Strategy with Health Monitoring
 */
function weightedWithHealth() {
  console.log('\n=== Example 3: Weighted Strategy ===\n');

  const lb = new LoadBalancer('weighted');

  // Add nodes with different weights
  lb.addNode({
    id: 'high-capacity',
    endpoint: 'http://10.0.1.10:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 2.0,
    weight: 3, // Higher weight = more capacity
  });

  lb.addNode({
    id: 'standard-capacity',
    endpoint: 'http://10.0.1.11:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
    weight: 1,
  });

  // Update loads
  lb.updateNodeLoad('high-capacity', 0.3);
  lb.updateNodeLoad('standard-capacity', 0.6);

  // Update health
  lb.updateNodeHealth('high-capacity', {
    healthy: true,
    responseTime: 50,
    errorRate: 0.01,
    uptime: 3600000,
  });

  lb.updateNodeHealth('standard-capacity', {
    healthy: true,
    responseTime: 100,
    errorRate: 0.05,
    uptime: 3600000,
  });

  const selected = lb.selectNode();
  console.log(`Selected node: ${selected?.id}`);
  console.log(
    `  Load: ${(lb.getNodeLoad(selected!.id)?.currentLoad ?? 0) * 100}%`,
  );
  console.log(`  Weight: ${selected?.weight}`);
  console.log(
    `  Error rate: ${(lb.getNodeHealth(selected!.id)?.errorRate ?? 0) * 100}%`,
  );

  // Output:
  // Selected node: high-capacity
  //   Load: 30%
  //   Weight: 3
  //   Error rate: 1%
}

/**
 * Example 4: Capability-Aware Selection
 */
function capabilityAware() {
  console.log('\n=== Example 4: Capability-Aware Selection ===\n');

  const lb = new LoadBalancer('capability-aware');

  // Add nodes with different capabilities
  lb.addNode({
    id: 'general-node',
    endpoint: 'http://10.0.1.10:8787',
    region: 'us-east-1',
    capabilities: ['session-management', 'task-execution'],
    capacity: 1.0,
  });

  lb.addNode({
    id: 'gpu-node',
    endpoint: 'http://10.0.1.11:8787',
    region: 'us-east-1',
    capabilities: ['session-management', 'task-execution', 'gpu-compute'],
    capacity: 1.0,
  });

  lb.addNode({
    id: 'ml-node',
    endpoint: 'http://10.0.1.12:8787',
    region: 'us-east-1',
    capabilities: [
      'session-management',
      'task-execution',
      'gpu-compute',
      'ml-inference',
    ],
    capacity: 1.0,
  });

  // Request GPU capabilities
  console.log('Requesting node with GPU capabilities:');
  const gpuNode = lb.selectNode({
    requiredCapabilities: ['gpu-compute'],
  });
  console.log(`  Selected: ${gpuNode?.id}`);
  console.log(`  Capabilities: ${gpuNode?.capabilities.join(', ')}`);

  // Request ML inference
  console.log('\nRequesting node with ML inference:');
  const mlNode = lb.selectNode({
    requiredCapabilities: ['ml-inference'],
  });
  console.log(`  Selected: ${mlNode?.id}`);
  console.log(`  Capabilities: ${mlNode?.capabilities.join(', ')}`);

  // Output:
  // Requesting node with GPU capabilities:
  //   Selected: gpu-node
  //   Capabilities: session-management, task-execution, gpu-compute
  //
  // Requesting node with ML inference:
  //   Selected: ml-node
  //   Capabilities: session-management, task-execution, gpu-compute, ml-inference
}

/**
 * Example 5: Session Affinity
 */
function sessionAffinity() {
  console.log('\n=== Example 5: Session Affinity ===\n');

  const lb = new LoadBalancer('round-robin');

  // Add nodes
  ['node-1', 'node-2', 'node-3'].forEach((id) => {
    lb.addNode({
      id,
      endpoint: `http://10.0.1.${id.split('-')[1]}0:8787`,
      region: 'us-east-1',
      capabilities: ['session-management'],
      capacity: 1.0,
    });
  });

  // First request for session-123
  console.log('First request for session-123:');
  const node1 = lb.selectNode({ sessionAffinity: 'session-123' });
  console.log(`  Selected: ${node1?.id}`);

  // Subsequent requests should stick to same node
  console.log('\nSubsequent requests for session-123:');
  for (let i = 0; i < 3; i++) {
    const node = lb.selectNode({ sessionAffinity: 'session-123' });
    console.log(`  Request ${i + 1}: ${node?.id}`);
  }

  // Different session gets different node
  console.log('\nRequest for session-456:');
  const node2 = lb.selectNode({ sessionAffinity: 'session-456' });
  console.log(`  Selected: ${node2?.id}`);

  // Output:
  // First request for session-123:
  //   Selected: node-1
  //
  // Subsequent requests for session-123:
  //   Request 1: node-1
  //   Request 2: node-1
  //   Request 3: node-1
  //
  // Request for session-456:
  //   Selected: node-2
}

/**
 * Example 6: Regional Preferences
 */
function regionalPreferences() {
  console.log('\n=== Example 6: Regional Preferences ===\n');

  const lb = new LoadBalancer('round-robin');

  // Add nodes in different regions
  lb.addNode({
    id: 'us-east-1a',
    endpoint: 'http://10.0.1.10:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  lb.addNode({
    id: 'us-west-1a',
    endpoint: 'http://10.0.2.10:8787',
    region: 'us-west-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  lb.addNode({
    id: 'eu-west-1a',
    endpoint: 'http://10.0.3.10:8787',
    region: 'eu-west-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  // Request node in specific region
  console.log('Requesting node in us-west-1:');
  const westNode = lb.selectNode({ preferredRegion: 'us-west-1' });
  console.log(`  Selected: ${westNode?.id} (${westNode?.region})`);

  console.log('\nRequesting node in eu-west-1:');
  const euNode = lb.selectNode({ preferredRegion: 'eu-west-1' });
  console.log(`  Selected: ${euNode?.id} (${euNode?.region})`);

  // Output:
  // Requesting node in us-west-1:
  //   Selected: us-west-1a (us-west-1)
  //
  // Requesting node in eu-west-1:
  //   Selected: eu-west-1a (eu-west-1)
}

/**
 * Example 7: Load Monitoring and Events
 */
function loadMonitoring() {
  console.log('\n=== Example 7: Load Monitoring and Events ===\n');

  const lb = new LoadBalancer('round-robin');

  // Set up event listeners
  lb.on('node:added', (node) => {
    console.log(`[EVENT] Node added: ${node.id}`);
  });

  lb.on('node:load_updated', (load) => {
    console.log(
      `[EVENT] Load updated: ${load.nodeId} -> ${(load.currentLoad * 100).toFixed(1)}%`,
    );
  });

  lb.on('node:overloaded', (nodeId, load) => {
    console.log(`[EVENT] Node overloaded: ${nodeId} (${(load * 100).toFixed(1)}%)`);
  });

  lb.on('strategy:changed', (oldStrategy, newStrategy) => {
    console.log(`[EVENT] Strategy changed: ${oldStrategy} -> ${newStrategy}`);
  });

  // Trigger events
  console.log('\nAdding node...');
  lb.addNode({
    id: 'monitored-node',
    endpoint: 'http://10.0.1.10:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  console.log('\nUpdating load...');
  lb.updateNodeLoad('monitored-node', 0.5);
  lb.updateNodeLoad('monitored-node', 0.95);

  console.log('\nChanging strategy...');
  lb.setStrategy('weighted');

  // Output:
  // Adding node...
  // [EVENT] Node added: monitored-node
  //
  // Updating load...
  // [EVENT] Load updated: monitored-node -> 50.0%
  // [EVENT] Load updated: monitored-node -> 95.0%
  // [EVENT] Node overloaded: monitored-node (95.0%)
  //
  // Changing strategy...
  // [EVENT] Strategy changed: round-robin -> weighted
}

/**
 * Example 8: Statistics and Monitoring
 */
function statistics() {
  console.log('\n=== Example 8: Statistics ===\n');

  const lb = new LoadBalancer('round-robin');

  // Add nodes with various states
  lb.addNode({
    id: 'node-1',
    endpoint: 'http://10.0.1.10:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  lb.addNode({
    id: 'node-2',
    endpoint: 'http://10.0.1.11:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  lb.addNode({
    id: 'node-3',
    endpoint: 'http://10.0.1.12:8787',
    region: 'us-east-1',
    capabilities: ['session-management'],
    capacity: 1.0,
  });

  // Update states
  lb.updateNodeLoad('node-1', 0.3);
  lb.updateNodeLoad('node-2', 0.6);
  lb.updateNodeLoad('node-3', 0.9);

  lb.updateActiveConnections('node-1', 10);
  lb.updateActiveConnections('node-2', 20);
  lb.updateActiveConnections('node-3', 30);

  lb.updateNodeHealth('node-3', { healthy: false });

  // Get statistics
  const stats = lb.getStats();

  console.log('Cluster Statistics:');
  console.log(`  Total nodes: ${stats.totalNodes}`);
  console.log(`  Healthy nodes: ${stats.healthyNodes}`);
  console.log(`  Total connections: ${stats.totalConnections}`);
  console.log(`  Average load: ${(stats.averageLoad * 100).toFixed(1)}%`);
  console.log(`  Strategy: ${stats.strategy}`);

  // Output:
  // Cluster Statistics:
  //   Total nodes: 3
  //   Healthy nodes: 2
  //   Total connections: 60
  //   Average load: 60.0%
  //   Strategy: round-robin
}

// Run all examples
if (require.main === module) {
  basicRoundRobin();
  leastConnections();
  weightedWithHealth();
  capabilityAware();
  sessionAffinity();
  regionalPreferences();
  loadMonitoring();
  statistics();
}
