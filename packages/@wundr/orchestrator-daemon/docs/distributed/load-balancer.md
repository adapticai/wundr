# LoadBalancer - Distributed Session Management

## Overview

The LoadBalancer component distributes sessions across multiple orchestrator nodes using various load balancing strategies. It supports health monitoring, session affinity, and intelligent node selection based on capabilities and load.

## Location

- **Implementation**: `/packages/@wundr/orchestrator-daemon/src/distributed/load-balancer.ts`
- **Tests**: `/packages/@wundr/orchestrator-daemon/tests/distributed/load-balancer.test.ts`
- **Examples**: `/packages/@wundr/orchestrator-daemon/src/distributed/examples/load-balancer.example.ts`

## Features

### 1. Multiple Load Balancing Strategies

#### Round-Robin
- Simple rotation through available nodes
- Fair distribution of load
- Best for homogeneous nodes

#### Least-Connections
- Selects node with fewest active sessions
- Adaptive to varying session durations
- Best for heterogeneous workloads

#### Weighted
- Considers multiple factors:
  - Available capacity (40% weight)
  - Node weight configuration (30% weight)
  - Health metrics (20% weight)
  - Connection count (10% weight)
- Penalizes high error rates
- Best for mixed capacity nodes

#### Capability-Aware
- Matches node capabilities to requirements
- Prefers specialized nodes (exact capability match)
- Considers current load as tiebreaker
- Best for diverse workloads with specific requirements

### 2. Node Management

```typescript
// Add nodes to the pool
loadBalancer.addNode({
  id: 'node-1',
  endpoint: 'http://10.0.1.10:8787',
  region: 'us-east-1',
  capabilities: ['session-management', 'gpu-compute'],
  capacity: 1.0,
  weight: 2, // Optional weight for weighted strategy
});

// Remove nodes
loadBalancer.removeNode('node-1');

// Get node information
const node = loadBalancer.getNode('node-1');
const allNodes = loadBalancer.getAllNodes();
```

### 3. Load Tracking

```typescript
// Update node load (0-1 scale)
loadBalancer.updateNodeLoad('node-1', 0.45);

// Update active connections
loadBalancer.updateActiveConnections('node-1', 15);

// Get current load
const load = loadBalancer.getNodeLoad('node-1');
console.log(`Load: ${load?.currentLoad * 100}%`);
console.log(`Connections: ${load?.activeConnections}`);
```

### 4. Health Monitoring

```typescript
// Update node health
loadBalancer.updateNodeHealth('node-1', {
  healthy: true,
  responseTime: 50,
  errorRate: 0.01,
  uptime: 3600000,
});

// Get health metrics
const health = loadBalancer.getNodeHealth('node-1');
console.log(`Healthy: ${health?.healthy}`);
console.log(`Error rate: ${health?.errorRate * 100}%`);
```

### 5. Node Selection

```typescript
// Basic selection (uses current strategy)
const node = loadBalancer.selectNode();

// Selection with constraints
const node = loadBalancer.selectNode({
  // Only nodes with these capabilities
  requiredCapabilities: ['gpu-compute'],

  // Prefer nodes in this region
  preferredRegion: 'us-west-1',

  // Maximum acceptable load (default: 0.8)
  loadThreshold: 0.7,

  // Exclude specific nodes
  excludeNodes: ['node-3'],

  // Session affinity - return same node for this session
  sessionAffinity: 'session-123',
});
```

### 6. Session Affinity

```typescript
// Requests with same sessionAffinity will return same node
const node1 = loadBalancer.selectNode({ sessionAffinity: 'session-123' });
const node2 = loadBalancer.selectNode({ sessionAffinity: 'session-123' });
// node1.id === node2.id

// Clear affinity
loadBalancer.clearSessionAffinity('session-123');

// Get current affinity mapping
const nodeId = loadBalancer.getSessionAffinity('session-123');
```

### 7. Strategy Management

```typescript
// Change strategy
loadBalancer.setStrategy('weighted');

// Get current strategy
const strategy = loadBalancer.getStrategy(); // 'weighted'

// Supported strategies
type Strategy =
  | 'round-robin'
  | 'least-connections'
  | 'weighted'
  | 'capability-aware';
```

### 8. Statistics

```typescript
const stats = loadBalancer.getStats();
console.log(`Total nodes: ${stats.totalNodes}`);
console.log(`Healthy nodes: ${stats.healthyNodes}`);
console.log(`Total connections: ${stats.totalConnections}`);
console.log(`Average load: ${(stats.averageLoad * 100).toFixed(1)}%`);
console.log(`Strategy: ${stats.strategy}`);
```

### 9. Event Monitoring

```typescript
// Node events
loadBalancer.on('node:added', (node) => {
  console.log(`Node added: ${node.id}`);
});

loadBalancer.on('node:removed', (nodeId) => {
  console.log(`Node removed: ${nodeId}`);
});

// Load events
loadBalancer.on('node:load_updated', (load) => {
  console.log(`Load updated: ${load.nodeId} -> ${load.currentLoad}`);
});

loadBalancer.on('node:overloaded', (nodeId, load) => {
  console.log(`WARNING: Node ${nodeId} is overloaded (${load * 100}%)`);
});

// Health events
loadBalancer.on('node:health_changed', (health) => {
  console.log(`Health changed: ${health.nodeId} -> ${health.healthy}`);
});

// Strategy events
loadBalancer.on('strategy:changed', (oldStrategy, newStrategy) => {
  console.log(`Strategy changed: ${oldStrategy} -> ${newStrategy}`);
});

// Selection events
loadBalancer.on('selection:failed', (options, reason) => {
  console.error(`Selection failed: ${reason}`);
});
```

## Type Definitions

### LoadBalancerNode
```typescript
interface LoadBalancerNode {
  id: string;
  endpoint: string;
  region: string;
  capabilities: string[];
  capacity: number; // 0-1, where 1 is full capacity
  weight?: number; // Optional weight for weighted strategy
  metadata?: Record<string, unknown>;
}
```

### NodeLoad
```typescript
interface NodeLoad {
  nodeId: string;
  activeConnections: number;
  currentLoad: number; // 0-1
  lastUpdated: Date;
  healthy: boolean;
}
```

### NodeHealth
```typescript
interface NodeHealth {
  nodeId: string;
  healthy: boolean;
  responseTime: number; // ms
  errorRate: number; // 0-1
  uptime: number; // ms
  lastCheck: Date;
  issues?: string[];
}
```

### NodeSelectionOptions
```typescript
interface NodeSelectionOptions {
  requiredCapabilities?: string[];
  preferredRegion?: string;
  loadThreshold?: number; // 0-1, default 0.8
  excludeNodes?: string[];
  sessionAffinity?: string;
}
```

### NodeScore
```typescript
interface NodeScore {
  nodeId: string;
  score: number;
  reasons: string[]; // Human-readable scoring breakdown
}
```

## Usage Examples

### Example 1: Basic Round-Robin

```typescript
const lb = new LoadBalancer('round-robin');

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

// Select nodes
for (let i = 0; i < 4; i++) {
  const node = lb.selectNode();
  console.log(`Selected: ${node?.id}`);
}
// Output: node-1, node-2, node-1, node-2
```

### Example 2: Capability-Based Selection

```typescript
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

// Request GPU capabilities
const gpuNode = lb.selectNode({
  requiredCapabilities: ['gpu-compute'],
});
console.log(`Selected: ${gpuNode?.id}`); // gpu-node
```

### Example 3: Session Affinity

```typescript
const lb = new LoadBalancer('round-robin');

// Add nodes
lb.addNode({ id: 'node-1', /* ... */ });
lb.addNode({ id: 'node-2', /* ... */ });
lb.addNode({ id: 'node-3', /* ... */ });

// First request establishes affinity
const node1 = lb.selectNode({ sessionAffinity: 'session-123' });
console.log(`First: ${node1?.id}`); // e.g., node-1

// Subsequent requests return same node
const node2 = lb.selectNode({ sessionAffinity: 'session-123' });
const node3 = lb.selectNode({ sessionAffinity: 'session-123' });
console.log(`Second: ${node2?.id}`); // node-1
console.log(`Third: ${node3?.id}`); // node-1
```

### Example 4: Weighted Strategy with Health

```typescript
const lb = new LoadBalancer('weighted');

// Add nodes with different capacities
lb.addNode({
  id: 'high-capacity',
  endpoint: 'http://10.0.1.10:8787',
  region: 'us-east-1',
  capabilities: ['session-management'],
  capacity: 2.0,
  weight: 3,
});

lb.addNode({
  id: 'standard-capacity',
  endpoint: 'http://10.0.1.11:8787',
  region: 'us-east-1',
  capabilities: ['session-management'],
  capacity: 1.0,
  weight: 1,
});

// Update loads and health
lb.updateNodeLoad('high-capacity', 0.3);
lb.updateNodeLoad('standard-capacity', 0.6);

lb.updateNodeHealth('high-capacity', {
  healthy: true,
  responseTime: 50,
  errorRate: 0.01,
  uptime: 3600000,
});

// Selection will prefer high-capacity node
const node = lb.selectNode();
console.log(`Selected: ${node?.id}`); // high-capacity
```

## Performance Characteristics

| Strategy | Time Complexity | Best Use Case |
|----------|----------------|---------------|
| Round-Robin | O(1) | Homogeneous nodes, simple distribution |
| Least-Connections | O(n) | Variable session durations |
| Weighted | O(n) | Mixed capacity nodes |
| Capability-Aware | O(n) | Diverse workloads with requirements |

Where n = number of eligible nodes (after filtering)

## Test Coverage

- **37 test cases** covering:
  - Node management (add, remove, events)
  - Load tracking and updates
  - Health monitoring
  - All four load balancing strategies
  - Selection options (capabilities, region, threshold, exclusions)
  - Session affinity
  - Strategy switching
  - Statistics
  - Error handling
  - Event emission

All tests passing ✅

## Integration

```typescript
import {
  LoadBalancer,
  LoadBalancerNode,
  NodeSelectionOptions,
} from '@wundr.io/orchestrator-daemon/distributed';

// Create load balancer
const loadBalancer = new LoadBalancer('round-robin');

// Use in distributed session manager
const selectedNode = loadBalancer.selectNode({
  requiredCapabilities: session.requiredCapabilities,
  preferredRegion: session.preferredRegion,
  sessionAffinity: session.id,
});

if (selectedNode) {
  // Spawn session on selected node
  await spawnSessionOnNode(selectedNode, session);
}
```

## Future Enhancements

1. **Predictive Load Balancing**: Use ML to predict node load
2. **Geographic Routing**: Optimize for latency based on user location
3. **Auto-scaling**: Integrate with node provisioning
4. **Cost-aware Selection**: Consider cloud provider costs
5. **Advanced Health Checks**: Active health probing
6. **Load Forecasting**: Predict future load patterns
