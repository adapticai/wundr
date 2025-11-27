# @wundr.io/mcp-registry

MCP Server Registry and Discovery with Super MCP aggregator pattern for unified tool routing across multiple MCP servers.

## Overview

The `@wundr.io/mcp-registry` package provides a comprehensive solution for managing multiple MCP (Model Context Protocol) servers. It implements the **Super MCP aggregator pattern**, which acts as a unified entry point for tool invocations, automatically routing requests to the appropriate servers based on capabilities, health status, and configurable routing strategies.

### Key Features

- **Server Registration & Lifecycle Management** - Register, update, and unregister MCP servers with full capability tracking
- **Capability-Based Discovery** - Find servers by tools, capabilities, tags, and health status
- **Tool Aggregation** - Unified tool routing across multiple MCP servers with intelligent server selection
- **Health Monitoring** - Continuous health checks with automatic status updates
- **Circuit Breaker Pattern** - Fault tolerance with automatic recovery
- **Multiple Routing Strategies** - Priority, round-robin, least-latency, random, and health-aware routing
- **Event-Driven Architecture** - Subscribe to registry, aggregator, and health events

## Installation

```bash
npm install @wundr.io/mcp-registry
```

### Peer Dependencies

```bash
npm install @wundr.io/mcp-server  # Optional: for direct server integration
```

## Quick Start

```typescript
import {
  MCPServerRegistry,
  MCPAggregator,
  ServerHealthMonitor,
  createServerDiscoveryService,
} from '@wundr.io/mcp-registry';

// Create registry
const registry = new MCPServerRegistry();

// Register servers
await registry.register({
  name: 'wundr-mcp',
  version: '1.0.0',
  transport: { type: 'stdio', command: 'npx', args: ['@wundr.io/mcp-server'] },
});

// Create aggregator
const aggregator = new MCPAggregator(registry, {
  defaultStrategy: 'health-aware',
  enableRetries: true,
});

// Start health monitoring
const monitor = new ServerHealthMonitor(registry);
await monitor.start();

// Invoke tools
const response = await aggregator.invoke({
  name: 'drift_detection',
  arguments: { action: 'detect' },
});
```

### Using the Factory Function

For a simpler setup, use the `createMCPRegistrySystem` factory:

```typescript
import { createMCPRegistrySystem } from '@wundr.io/mcp-registry';

const { registry, discovery, aggregator, monitor } = await createMCPRegistrySystem({
  aggregator: { defaultStrategy: 'health-aware' },
  monitor: { checkInterval: 10000 },
});

await monitor.start();
```

## API Reference

### MCPServerRegistry

The core registry class for managing MCP server registrations.

#### Server Registration

```typescript
const registry = new MCPServerRegistry();

// Register a server
const server = await registry.register({
  name: 'my-mcp-server',
  version: '1.0.0',
  description: 'My custom MCP server',
  transport: {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: { NODE_ENV: 'production' },
    cwd: '/path/to/server',
    timeout: 30000,
    autoReconnect: true,
  },
  priority: 10, // Higher = preferred
  tags: ['production', 'tools'],
  metadata: { owner: 'team-a' },
});

// Unregister a server
await registry.unregister(server.id);
```

#### Server Discovery

```typescript
// Get server by ID
const server = registry.get(serverId);

// Get server by name
const server = registry.getByName('my-mcp-server');

// Get all servers
const allServers = registry.getAll();

// Find by capability category
const toolServers = registry.findByCapability('tools');

// Find by tool name
const driftServers = registry.findByTool('drift_detection');

// Find by tag
const productionServers = registry.findByTag('production');

// Find by health status
const healthyServers = registry.findByHealthStatus('healthy');

// Get all tool names
const toolNames = registry.getAllToolNames();

// Get all tags
const tags = registry.getAllTags();
```

#### Capability Management

```typescript
// Update server capabilities
await registry.updateCapabilities(serverId, [
  { category: 'tools', name: 'drift_detection', enabled: true },
  { category: 'resources', name: 'config-files', enabled: true },
]);

// Update server tools
await registry.updateTools(serverId, [
  {
    name: 'drift_detection',
    description: 'Monitor code quality drift',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['detect', 'baseline'] },
      },
      required: ['action'],
    },
    category: 'governance',
    tags: ['quality', 'monitoring'],
  },
]);

// Update server resources
await registry.updateResources(serverId, [
  {
    uri: 'file:///config/*.json',
    name: 'Configuration Files',
    mimeType: 'application/json',
    subscribable: true,
  },
]);

// Update server prompts
await registry.updatePrompts(serverId, [
  {
    name: 'code-review',
    description: 'Generate code review comments',
    arguments: [{ name: 'diff', description: 'Git diff to review', required: true }],
  },
]);
```

#### Health Status

```typescript
// Get health status for a server
const health = registry.getHealthStatus(serverId);

// Update health status
registry.updateHealthStatus(serverId, {
  status: 'healthy',
  connected: true,
  latencyMs: 50,
});

// Get all healthy servers
const healthyServers = registry.getHealthyServers();
```

#### Registry Events

```typescript
registry.on('server:registered', event => {
  console.log('Server registered:', event.serverId);
});

registry.on('server:unregistered', event => {
  console.log('Server unregistered:', event.serverId);
});

registry.on('server:health-changed', event => {
  console.log('Health changed:', event.data?.previousStatus, '->', event.data?.newStatus);
});

registry.on('tool:added', event => {
  console.log('Tool added:', event.data?.toolName);
});

registry.on('tool:removed', event => {
  console.log('Tool removed:', event.data?.toolName);
});
```

#### Export/Import

```typescript
// Export registry for persistence
const exported = registry.export();
await fs.writeFile('registry.json', JSON.stringify(exported));

// Import registry
const data = JSON.parse(await fs.readFile('registry.json', 'utf-8'));
await registry.import(data);
```

### MCPAggregator

The Super MCP aggregator for routing tool invocations.

#### Configuration

```typescript
const aggregator = new MCPAggregator(registry, {
  // Routing strategy: 'priority' | 'round-robin' | 'least-latency' | 'random' | 'health-aware'
  defaultStrategy: 'health-aware',

  // Request timeout in milliseconds
  requestTimeout: 30000,

  // Retry configuration
  enableRetries: true,
  maxRetries: 3,
  retryDelay: 1000,

  // Circuit breaker configuration
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5, // Failures before opening
  circuitBreakerResetTimeout: 60000, // Time before trying again
});
```

#### Tool Invocation

```typescript
// Invoke with default strategy
const response = await aggregator.invoke({
  name: 'drift_detection',
  arguments: { action: 'detect' },
  timeout: 10000, // Override default timeout
  preferredServer: serverId, // Optional server preference
  metadata: { requestId: 'abc-123' },
});

// Response structure
console.log(response.result); // Tool result
console.log(response.serverId); // Server that handled the request
console.log(response.latencyMs); // Request latency
console.log(response.retried); // Whether request was retried
console.log(response.retryAttempts); // Number of retry attempts
```

#### Routing Strategies

```typescript
// Use specific routing strategy
const response = await aggregator.invokeWithStrategy(
  { name: 'my-tool', arguments: {} },
  'least-latency'
);

// Available strategies:
// - 'priority': Select server with highest priority
// - 'round-robin': Distribute requests evenly across servers
// - 'least-latency': Select server with lowest average latency
// - 'random': Random server selection
// - 'health-aware': Score-based selection considering health, latency, and priority
```

#### Parallel and Sequential Invocation

```typescript
// Invoke multiple tools in parallel
const responses = await aggregator.invokeParallel([
  { name: 'tool-a', arguments: { param: 1 } },
  { name: 'tool-b', arguments: { param: 2 } },
  { name: 'tool-c', arguments: { param: 3 } },
]);

// Invoke tools sequentially
const results = await aggregator.invokeSequential([
  { name: 'step-1', arguments: {} },
  { name: 'step-2', arguments: {} },
  { name: 'step-3', arguments: {} },
]);
```

#### Direct Tool Handlers

Register local tool handlers for direct execution:

```typescript
// Register a local tool handler
aggregator.registerToolHandler('my-local-tool', async args => {
  const result = await processLocally(args);
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    isError: false,
  };
});

// Unregister handler
aggregator.unregisterToolHandler('my-local-tool');
```

#### Circuit Breaker

```typescript
// Check if circuit is open for a server
const isOpen = aggregator.isCircuitOpen(serverId);

// Get circuit status
const status = aggregator.getCircuitStatus(serverId);
console.log(status.state); // 'closed' | 'open' | 'half-open'
console.log(status.failureCount);
console.log(status.lastFailure);
console.log(status.timeUntilClose);

// Get all circuit statuses
const allStatuses = aggregator.getAllCircuitStatuses();

// Manually reset a circuit
aggregator.resetCircuit(serverId);

// Manually open a circuit
aggregator.openCircuit(serverId);
```

#### Aggregator Events

```typescript
aggregator.on('request:started', event => {
  console.log('Request started:', event.requestId, event.toolName);
});

aggregator.on('request:completed', event => {
  console.log('Request completed:', event.requestId, event.durationMs, 'ms');
});

aggregator.on('request:failed', event => {
  console.log('Request failed:', event.requestId, event.error);
});

aggregator.on('request:retried', event => {
  console.log('Request retried:', event.requestId, 'attempt', event.retryAttempt);
});

aggregator.on('circuit:opened', event => {
  console.log('Circuit opened:', event.serverId);
});

aggregator.on('circuit:closed', event => {
  console.log('Circuit closed:', event.serverId);
});

aggregator.on('circuit:half-open', event => {
  console.log('Circuit half-open:', event.serverId);
});
```

### ServerDiscoveryService

Advanced server discovery with query building and recommendations.

#### Query Builder

```typescript
const discovery = new ServerDiscoveryService(registry);

// Build complex queries with fluent API
const query = discovery
  .queryBuilder()
  .withCategory('tools')
  .withTools(['drift_detection', 'governance_report'])
  .withTags(['production'])
  .withMinPriority(5)
  .withHealthStatus(['healthy', 'degraded'])
  .build();

const result = await discovery.discover(query, {
  limit: 10,
  sortBy: 'priority',
  sortOrder: 'desc',
  includeUnknownHealth: false,
});

console.log(result.servers); // Matching servers
console.log(result.matchCount); // Number of matches
console.log(result.totalSearched); // Total servers searched
```

#### Finding Servers

```typescript
// Find best server for a specific tool
const bestServer = await discovery.findBestServerForTool('drift_detection');

// Find servers that provide ALL specified tools
const servers = await discovery.findServersForTools([
  'drift_detection',
  'governance_report',
  'test_baseline',
]);
```

#### Server Recommendations

```typescript
const recommendations = await discovery.getRecommendations({
  preferredTools: ['drift_detection'],
  preferredTags: ['production'],
  requiredCapabilities: ['governance'],
});

for (const rec of recommendations) {
  console.log(rec.server.name);
  console.log('Score:', rec.score);
  console.log('Reasons:', rec.reasons);
  console.log('Health:', rec.healthStatus);
}
```

### ServerHealthMonitor

Continuous health monitoring with custom checks.

#### Configuration

```typescript
const monitor = new ServerHealthMonitor(registry, {
  // Health check interval in milliseconds
  checkInterval: 30000,

  // Ping timeout in milliseconds
  pingTimeout: 5000,

  // Failures before marking unhealthy
  failureThreshold: 3,

  // Successes needed to recover from unhealthy
  recoveryThreshold: 2,

  // Latency threshold for degraded status (ms)
  degradedLatencyThreshold: 1000,

  // Enable automatic reconnection
  autoReconnect: true,

  // Maximum reconnection attempts
  maxReconnectAttempts: 5,
});
```

#### Lifecycle Management

```typescript
// Start monitoring
await monitor.start();

// Check if active
const isActive = monitor.isActive();

// Stop monitoring
await monitor.stop();

// Reset all monitoring state
monitor.reset();
```

#### Health Checks

```typescript
// Force health check for a specific server
const health = await monitor.checkServer(serverId);

// Check all servers
await monitor.checkAllServers();

// Get health status
const health = monitor.getHealth(serverId);

// Get all health statuses
const allHealth = monitor.getAllHealth();
```

#### Custom Health Checks

```typescript
// Register custom health check
monitor.registerCheck({
  name: 'memory-usage',
  check: async server => {
    const memUsage = await checkMemoryUsage(server);
    return {
      name: 'memory-usage',
      status: memUsage > 90 ? 'unhealthy' : memUsage > 70 ? 'degraded' : 'healthy',
      message: `Memory usage: ${memUsage}%`,
      durationMs: 10,
      timestamp: new Date(),
      data: { usage: memUsage },
    };
  },
  critical: false, // Non-critical checks don't affect overall status
  timeout: 5000,
});

// Unregister check
monitor.unregisterCheck('memory-usage');

// Get registered checks
const checks = monitor.getRegisteredChecks();
```

#### Request Tracking

```typescript
// Record request metrics for a server
monitor.recordRequest(serverId, true, 150); // success, 150ms latency
monitor.recordRequest(serverId, false, 5000); // failure, 5000ms latency
```

#### Health Events

```typescript
monitor.on('health:checked', event => {
  console.log('Health check completed:', event.serverId);
  console.log('Status:', event.status.status);
  console.log('Checks:', event.checks);
});

monitor.on('health:changed', event => {
  console.log('Health changed:', event.previousStatus, '->', event.newStatus);
});

monitor.on('health:degraded', event => {
  console.log('Server degraded:', event.serverId);
});

monitor.on('health:recovered', event => {
  console.log('Server recovered:', event.serverId);
});

monitor.on('health:failed', event => {
  console.log('Server failed:', event.serverId);
});

monitor.on('server:connected', event => {
  console.log('Server connected:', event.serverId);
});

monitor.on('server:disconnected', event => {
  console.log('Server disconnected:', event.serverId);
});

monitor.on('monitor:started', () => {
  console.log('Monitoring started');
});

monitor.on('monitor:stopped', () => {
  console.log('Monitoring stopped');
});
```

## Integration with Orchestrator Daemon

The mcp-registry integrates with the Orchestrator (Virtual Process) daemon for centralized MCP server management in production environments.

### Daemon Integration Pattern

```typescript
import { createMCPRegistrySystem } from '@wundr.io/mcp-registry';

class VPDaemon {
  private registrySystem?: Awaited<ReturnType<typeof createMCPRegistrySystem>>;

  async start() {
    // Initialize registry system
    this.registrySystem = await createMCPRegistrySystem({
      aggregator: {
        defaultStrategy: 'health-aware',
        enableCircuitBreaker: true,
        circuitBreakerThreshold: 3,
      },
      monitor: {
        checkInterval: 15000,
        failureThreshold: 2,
        autoReconnect: true,
      },
    });

    // Start health monitoring
    await this.registrySystem.monitor.start();

    // Register event handlers
    this.setupEventHandlers();

    // Load server configurations
    await this.loadServerConfigs();
  }

  private setupEventHandlers() {
    const { registry, monitor, aggregator } = this.registrySystem!;

    // Handle server health changes
    monitor.on('health:failed', async event => {
      console.log(`Server ${event.serverId} failed, attempting recovery...`);
      // Implement recovery logic
    });

    // Handle circuit breaker events
    aggregator.on('circuit:opened', event => {
      console.log(`Circuit opened for ${event.serverId}, routing to alternatives`);
    });
  }

  private async loadServerConfigs() {
    const { registry } = this.registrySystem!;

    // Load from configuration file or database
    const configs = await this.getServerConfigs();

    for (const config of configs) {
      await registry.register(config);
    }
  }

  async invokeToolOnBestServer(toolName: string, args: Record<string, unknown>) {
    const { aggregator } = this.registrySystem!;
    return aggregator.invoke({ name: toolName, arguments: args });
  }

  async stop() {
    if (this.registrySystem) {
      await this.registrySystem.monitor.stop();
    }
  }
}
```

### Dynamic Server Loading

```typescript
import { MCPServerRegistry, ServerRegistrationOptions } from '@wundr.io/mcp-registry';

async function loadServersFromConfig(registry: MCPServerRegistry, configPath: string) {
  const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

  for (const serverConfig of config.servers) {
    await registry.register(serverConfig as ServerRegistrationOptions);
  }
}

// Watch for configuration changes
fs.watch(configPath, async () => {
  const newConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  await syncServers(registry, newConfig.servers);
});

async function syncServers(registry: MCPServerRegistry, desiredConfigs: ServerRegistrationOptions[]) {
  const currentServers = registry.getAll();
  const desiredNames = new Set(desiredConfigs.map(c => c.name));

  // Remove servers not in config
  for (const server of currentServers) {
    if (!desiredNames.has(server.name)) {
      await registry.unregister(server.id);
    }
  }

  // Add/update servers from config
  for (const config of desiredConfigs) {
    if (!registry.hasName(config.name)) {
      await registry.register(config);
    }
  }
}
```

## Access Control and Permissions

While the registry itself doesn't enforce access control, it provides the foundation for implementing permission systems:

### Server-Level Permissions

```typescript
interface ServerPermissions {
  allowedTools: string[];
  allowedClients: string[];
  rateLimit: number;
}

// Store permissions in server metadata
await registry.register({
  name: 'restricted-server',
  version: '1.0.0',
  transport: { type: 'stdio', command: 'node', args: ['server.js'] },
  metadata: {
    permissions: {
      allowedTools: ['safe-tool-1', 'safe-tool-2'],
      allowedClients: ['client-a', 'client-b'],
      rateLimit: 100,
    } as ServerPermissions,
  },
});

// Check permissions before invocation
async function invokeWithPermissions(
  aggregator: MCPAggregator,
  registry: MCPServerRegistry,
  clientId: string,
  request: ToolInvocationRequest
) {
  const servers = registry.findByTool(request.name);

  const authorizedServer = servers.find(server => {
    const perms = server.metadata?.permissions as ServerPermissions | undefined;
    if (!perms) return true; // No restrictions
    return perms.allowedClients.includes(clientId) && perms.allowedTools.includes(request.name);
  });

  if (!authorizedServer) {
    throw new Error('Access denied');
  }

  return aggregator.invoke({
    ...request,
    preferredServer: authorizedServer.id,
  });
}
```

## Error Handling

The package exports typed error classes for handling specific failure scenarios:

```typescript
import {
  // Registry errors
  ServerNotFoundError,
  ServerAlreadyExistsError,
  RegistrationValidationError,

  // Discovery errors
  NoServersFoundError,
  InvalidQueryError,

  // Aggregator errors
  NoServerAvailableError,
  ToolInvocationTimeoutError,
  CircuitBreakerOpenError,
  RetryExhaustedError,

  // Health errors
  HealthCheckError,
} from '@wundr.io/mcp-registry';

try {
  await aggregator.invoke({ name: 'unknown-tool' });
} catch (error) {
  if (error instanceof NoServerAvailableError) {
    console.log(`No server provides tool: ${error.toolName}`);
  } else if (error instanceof ToolInvocationTimeoutError) {
    console.log(`Tool timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof CircuitBreakerOpenError) {
    console.log(`Server ${error.serverId} circuit is open`);
  } else if (error instanceof RetryExhaustedError) {
    console.log(`All ${error.attempts} retries failed: ${error.lastError.message}`);
  }
}
```

## Runtime Validation

The package includes Zod schemas for runtime validation:

```typescript
import {
  TransportConfigSchema,
  ServerRegistrationOptionsSchema,
  ToolInvocationRequestSchema,
  CapabilityQuerySchema,
  AggregatorConfigSchema,
  HealthMonitorConfigSchema,
} from '@wundr.io/mcp-registry';

// Validate configuration
const result = AggregatorConfigSchema.safeParse(userConfig);
if (!result.success) {
  console.error('Invalid config:', result.error.errors);
}
```

## Type Definitions

### Transport Types

```typescript
type TransportType = 'stdio' | 'http' | 'websocket' | 'ipc';

interface TransportConfig {
  type: TransportType;
  command?: string; // For stdio
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string; // For http/websocket
  timeout?: number;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}
```

### Health Types

```typescript
type HealthLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface HealthStatus {
  serverId: string;
  status: HealthLevel;
  connected: boolean;
  lastPing?: Date;
  latencyMs?: number;
  avgLatencyMs?: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  errorRate: number;
  checks: HealthCheckResult[];
  updatedAt: Date;
}
```

### Routing Types

```typescript
type RoutingStrategy = 'priority' | 'round-robin' | 'least-latency' | 'random' | 'health-aware';

type CircuitBreakerState = 'closed' | 'open' | 'half-open';
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0 (for development)

## License

MIT
