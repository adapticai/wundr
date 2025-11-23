# @wundr.io/agent-delegation

Hub-and-spoke delegation pattern for AI agent coordination with audit logging and result synthesis.

## Overview

This package provides a comprehensive framework for coordinating multi-agent systems using the **hub-and-spoke delegation pattern**. A central hub coordinator manages task distribution to spoke agents, handles parallel execution, synthesizes results from multiple agents, and maintains detailed audit logs.

### Key Features

- **Hub-and-Spoke Architecture**: Central coordinator distributes tasks to specialized agents
- **Parallel Task Delegation**: Execute multiple tasks concurrently with configurable limits
- **Intelligent Agent Selection**: Match tasks to agents based on capabilities and availability
- **Result Synthesis**: Combine outputs from multiple agents using various strategies
- **Model Selection**: Automatically select optimal AI models based on task requirements
- **Comprehensive Audit Logging**: Track all delegation activities with correlation IDs
- **Retry Policies**: Configurable retry logic with exponential backoff
- **Type Safety**: Full TypeScript support with Zod schema validation

## Installation

```bash
npm install @wundr.io/agent-delegation
# or
yarn add @wundr.io/agent-delegation
# or
pnpm add @wundr.io/agent-delegation
```

## Quick Start

```typescript
import {
  HubCoordinator,
  AgentDefinitionInput,
  DelegationTaskInput,
} from '@wundr.io/agent-delegation';

// Create coordinator
const coordinator = new HubCoordinator({
  config: {
    hubAgentId: 'main-orchestrator',
    maxParallelDelegations: 5,
    synthesisStrategy: 'merge',
  },
});

// Register agents
const coder = coordinator.registerAgent({
  name: 'Code Expert',
  role: 'developer',
  capabilities: ['coding', 'refactoring', 'testing'],
});

const reviewer = coordinator.registerAgent({
  name: 'Code Reviewer',
  role: 'reviewer',
  capabilities: ['code-review', 'security-audit'],
});

// Delegate a single task
const result = await coordinator.delegateTask({
  description: 'Implement user authentication',
  requiredCapabilities: ['coding'],
  priority: 'high',
});

// Delegate parallel tasks
const parallelResult = await coordinator.delegateParallel({
  tasks: [
    { description: 'Review authentication module' },
    { description: 'Review authorization module' },
  ],
  agents: [reviewer],
});

// Synthesize results
const synthesis = await coordinator.synthesizeResults(
  parallelResult.results,
  'consensus'
);

console.log('Synthesized output:', synthesis.synthesizedOutput);
```

## Architecture

### Hub-and-Spoke Pattern

```
                    +------------------+
                    |  Hub Coordinator |
                    |   (Orchestrator) |
                    +--------+---------+
                             |
        +--------------------+--------------------+
        |                    |                    |
        v                    v                    v
+---------------+    +---------------+    +---------------+
| Spoke Agent 1 |    | Spoke Agent 2 |    | Spoke Agent 3 |
|   (Coder)     |    |  (Reviewer)   |    |   (Tester)    |
+---------------+    +---------------+    +---------------+
```

The hub coordinator acts as the central point for:
- Task distribution and assignment
- Agent lifecycle management
- Result collection and synthesis
- Audit logging and metrics

## Core Components

### HubCoordinator

The main class for managing agent delegation.

```typescript
import { HubCoordinator, HubCoordinatorOptions } from '@wundr.io/agent-delegation';

const options: HubCoordinatorOptions = {
  config: {
    hubAgentId: 'hub-1',
    maxParallelDelegations: 5,
    defaultTimeout: 60000,
    synthesisStrategy: 'merge',
    enableAuditLogging: true,
    retryFailedDelegations: true,
    maxRetries: 3,
    aggregatePartialResults: true,
    modelSelectionStrategy: 'balanced',
  },
  // Optional event handlers
  onTaskStarted: (task, agent) => console.log(`Task ${task.id} started by ${agent.name}`),
  onTaskCompleted: (result, agent) => console.log(`Task completed by ${agent.name}`),
  onTaskFailed: (result, agent) => console.log(`Task failed: ${result.error?.message}`),
  onSynthesisCompleted: (synthesis) => console.log(`Synthesis complete with ${synthesis.confidence} confidence`),
};

const coordinator = new HubCoordinator(options);
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `hubAgentId` | `string` | Required | Unique identifier for the hub coordinator |
| `maxParallelDelegations` | `number` | `5` | Maximum concurrent task delegations |
| `defaultTimeout` | `number` | `60000` | Default timeout in milliseconds |
| `synthesisStrategy` | `SynthesisStrategy` | `'merge'` | Default strategy for result synthesis |
| `enableAuditLogging` | `boolean` | `true` | Enable/disable audit logging |
| `retryFailedDelegations` | `boolean` | `true` | Retry failed tasks automatically |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `aggregatePartialResults` | `boolean` | `true` | Include partial results in synthesis |
| `modelSelectionStrategy` | `string` | `'balanced'` | Strategy for model selection |

## Delegation Request/Response Flow

### Single Task Delegation

```typescript
// Create a delegation task
const task: DelegationTaskInput = {
  description: 'Analyze code for security vulnerabilities',
  context: { codebase: 'auth-module', language: 'typescript' },
  requiredCapabilities: ['security-audit', 'coding'],
  priority: 'high',
  timeout: 30000,
};

// Delegate with optional correlation ID for tracking
const result = await coordinator.delegateTask(task, 'correlation-123');

// Result structure
console.log({
  taskId: result.taskId,
  agentId: result.agentId,
  status: result.status, // 'completed' | 'failed' | 'timeout' | 'cancelled'
  output: result.output,
  duration: result.duration,
  tokensUsed: result.tokensUsed,
  retryCount: result.retryCount,
});
```

### Parallel Task Delegation

```typescript
const parallelRequest: ParallelDelegationRequest = {
  tasks: [
    { description: 'Review frontend code', requiredCapabilities: ['frontend'] },
    { description: 'Review backend code', requiredCapabilities: ['backend'] },
    { description: 'Check API contracts', requiredCapabilities: ['api'] },
  ],
  agents: [frontendAgent, backendAgent, apiAgent],
  correlationId: 'batch-review-001',
};

const response: ParallelDelegationResponse = await coordinator.delegateParallel(parallelRequest);

console.log({
  correlationId: response.correlationId,
  results: response.results,
  synthesis: response.synthesis,
  totalDuration: response.totalDuration,
  successCount: response.successCount,
  failureCount: response.failureCount,
});
```

## Task Handoff Mechanisms

### Agent Registration

```typescript
const agent = coordinator.registerAgent({
  name: 'Expert Developer',
  role: 'developer',
  capabilities: ['coding', 'debugging', 'optimization'],
  capabilityLevels: {
    coding: 'expert',
    debugging: 'proficient',
    optimization: 'intermediate',
  },
  maxConcurrentTasks: 3,
  timeout: 120000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 500,
    backoffMultiplier: 2,
  },
  modelPreference: 'premium',
  metadata: { specialization: 'typescript' },
});
```

### Agent Selection Algorithm

The coordinator uses a scoring system to select the best agent:

1. **Capability Matching**: Agents must have all required capabilities
2. **Capability Level Bonus**: Expert-level agents score higher
3. **Availability Check**: Agents below `maxConcurrentTasks` are preferred
4. **Preferred Agent**: Optional explicit agent assignment

```typescript
// Specify preferred agent
const result = await coordinator.delegateTask({
  description: 'Critical security fix',
  preferredAgentId: 'senior-security-expert',
  requiredCapabilities: ['security'],
});
```

### Custom Task Executor

Provide your own execution logic:

```typescript
import { createHubCoordinatorWithExecutor, TaskExecutor } from '@wundr.io/agent-delegation';

const customExecutor: TaskExecutor = async (task, agent, context) => {
  // Your custom execution logic
  const startTime = new Date();

  // Call your AI model or service
  const output = await myAIService.execute({
    prompt: task.description,
    model: agent.modelPreference,
    context,
  });

  return {
    taskId: task.id,
    agentId: agent.id,
    status: 'completed',
    output,
    duration: Date.now() - startTime.getTime(),
    startedAt: startTime,
    completedAt: new Date(),
    tokensUsed: output.usage?.totalTokens,
    retryCount: 0,
  };
};

const coordinator = createHubCoordinatorWithExecutor('hub-1', customExecutor);
```

## Trust Level Management

### Agent Capability Levels

Define granular capability levels for agents:

```typescript
type AgentCapabilityLevel = 'expert' | 'proficient' | 'intermediate' | 'basic';

const agent = coordinator.registerAgent({
  name: 'Senior Engineer',
  role: 'developer',
  capabilities: ['coding', 'architecture', 'security'],
  capabilityLevels: {
    coding: 'expert',
    architecture: 'proficient',
    security: 'intermediate',
  },
});
```

### Model Tier Selection

Match task complexity to appropriate AI model tiers:

```typescript
type ModelTier = 'premium' | 'standard' | 'economy' | 'local';

// Using the ModelSelector directly
import { ModelSelector, createCapabilityOptimizedSelector } from '@wundr.io/agent-delegation';

const selector = createCapabilityOptimizedSelector();

const selection = await selector.selectModel(task, {
  taskComplexity: 'complex',
  requiredCapabilities: ['coding', 'reasoning'],
  requiresTools: true,
  maxCost: 0.01,
  maxLatency: 2000,
});

console.log(`Selected: ${selection.model.name}`);
console.log(`Reasoning: ${selection.reasoning.join(', ')}`);
```

### Result Weighting

Assign weights to agents for weighted synthesis:

```typescript
import { ResultSynthesizer } from '@wundr.io/agent-delegation';

const synthesizer = new ResultSynthesizer({
  defaultStrategy: 'weighted_average',
});

// Trust senior agents more
synthesizer.setWeight('senior-agent-1', 1.0);
synthesizer.setWeight('junior-agent-1', 0.6);
synthesizer.setWeight('intern-agent-1', 0.3);

const synthesis = await synthesizer.synthesize(results, 'weighted_average');
```

## Delegation Chains and Tracking

### Correlation IDs

Track related operations across the system:

```typescript
const correlationId = 'feature-implementation-001';

// All related tasks share correlation ID
const result1 = await coordinator.delegateTask(designTask, correlationId);
const result2 = await coordinator.delegateTask(implementTask, correlationId);
const result3 = await coordinator.delegateTask(testTask, correlationId);

// Query all events in the chain
const auditLog = coordinator.getAuditLog();
const chain = auditLog.getCorrelationChain(correlationId);

chain.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.eventType} - ${entry.details}`);
});
```

### Task Parent-Child Relationships

Create hierarchical task structures:

```typescript
// Parent task
const parentTask = await coordinator.delegateTask({
  description: 'Implement authentication system',
  requiredCapabilities: ['architecture'],
});

// Child tasks referencing parent
const subtasks = await coordinator.delegateParallel({
  tasks: [
    {
      description: 'Implement login flow',
      parentTaskId: parentTask.taskId,
      requiredCapabilities: ['frontend'],
    },
    {
      description: 'Implement session management',
      parentTaskId: parentTask.taskId,
      requiredCapabilities: ['backend'],
    },
  ],
  agents: [frontendAgent, backendAgent],
});
```

### Task Timeline

Get the complete history of a task:

```typescript
const timeline = auditLog.getTaskTimeline('task-123');

// Events in chronological order:
// delegation_created -> delegation_assigned -> delegation_started -> delegation_completed
```

## Result Synthesis Strategies

### Available Strategies

```typescript
type SynthesisStrategy =
  | 'merge'           // Deep merge all outputs
  | 'vote'            // Select most common output
  | 'consensus'       // Require threshold agreement
  | 'best_pick'       // Select highest-scored result
  | 'weighted_average' // Weight by agent trust
  | 'chain';          // Use final result in sequence
```

### Strategy Examples

```typescript
// Merge: Combine all outputs
const merged = await coordinator.synthesizeResults(results, 'merge');

// Vote: Democratic selection
const voted = await coordinator.synthesizeResults(results, 'vote');

// Consensus: Require 60% agreement
import { createConsensusSynthesizer } from '@wundr.io/agent-delegation';
const consensusSynthesizer = createConsensusSynthesizer(0.6);
const consensus = await consensusSynthesizer.synthesize(results, 'consensus');

// Best Pick: Select highest quality result
const bestPick = await coordinator.synthesizeResults(results, 'best_pick', {
  targetDuration: 5000, // Prefer faster results
});

// Chain: Sequential processing
const chained = await coordinator.synthesizeResults(results, 'chain');
```

### Handling Conflicts

```typescript
const synthesis = await coordinator.synthesizeResults(results, 'merge');

if (synthesis.conflicts.length > 0) {
  synthesis.conflicts.forEach(conflict => {
    console.log(`Conflict in "${conflict.field}":`);
    console.log(`  Values: ${JSON.stringify(conflict.values)}`);
    console.log(`  Resolution: ${conflict.resolution}`);
  });
}

console.log(`Confidence: ${synthesis.confidence}`);
```

## Audit Logging

### Configuration

```typescript
import { AuditLogManager, createAuditLogWithHandler } from '@wundr.io/agent-delegation';

// With custom handler for external storage
const auditLog = createAuditLogWithHandler(
  async (entry) => {
    await database.insert('audit_logs', entry);
  },
  'session-123'
);

// Or configure via coordinator
const coordinator = new HubCoordinator({
  config: { hubAgentId: 'hub-1' },
  auditOptions: {
    enabled: true,
    maxEntries: 10000,
    sessionId: 'session-123',
    logLevel: 'info',
    includeContext: true,
  },
});
```

### Event Types

```typescript
type AuditEventType =
  | 'delegation_created'
  | 'delegation_assigned'
  | 'delegation_started'
  | 'delegation_completed'
  | 'delegation_failed'
  | 'delegation_cancelled'
  | 'result_received'
  | 'synthesis_started'
  | 'synthesis_completed'
  | 'model_selected'
  | 'agent_spawned'
  | 'agent_terminated'
  | 'error_occurred';
```

### Querying Logs

```typescript
const auditLog = coordinator.getAuditLog();

// Query with filters
const logs = auditLog.query({
  eventTypes: ['delegation_completed', 'delegation_failed'],
  hubAgentId: 'hub-1',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-12-31'),
  limit: 100,
  offset: 0,
});

// Get statistics
const stats = auditLog.getStats();
console.log({
  totalEntries: stats.totalEntries,
  errorCount: stats.errorCount,
  entriesByType: stats.entriesByType,
  entriesByAgent: stats.entriesByAgent,
});

// Export/Import for persistence
const exported = auditLog.export();
auditLog.import(restoredEntries);
```

## Integration with Session Managers

### Session Lifecycle

```typescript
const coordinator = new HubCoordinator({
  config: { hubAgentId: 'hub-1' },
  auditOptions: {
    sessionId: 'session-abc-123',
  },
});

// All operations are tagged with session ID
await coordinator.delegateTask({ description: 'Task 1' });
await coordinator.delegateTask({ description: 'Task 2' });

// Query by session
const sessionLogs = coordinator.getAuditLog().query({
  sessionId: 'session-abc-123',
});

// Get session metrics
const metrics = coordinator.getMetrics();
console.log({
  totalDelegations: metrics.totalDelegations,
  successfulDelegations: metrics.successfulDelegations,
  failedDelegations: metrics.failedDelegations,
  averageDuration: metrics.averageDuration,
  totalTokensUsed: metrics.totalTokensUsed,
  activeAgents: metrics.activeAgents,
  pendingTasks: metrics.pendingTasks,
  synthesisCount: metrics.synthesisCount,
  lastActivityAt: metrics.lastActivityAt,
});

// Graceful shutdown
await coordinator.shutdown();
```

## Integration with Sub-Agent Workers

### Worker Pattern

```typescript
import { HubCoordinator, TaskExecutor } from '@wundr.io/agent-delegation';

// Sub-agent worker implementation
class SubAgentWorker {
  constructor(
    private agentId: string,
    private model: string
  ) {}

  async execute(task: DelegationTask): Promise<DelegationResult> {
    // Worker-specific execution logic
    const response = await this.callModel(task.description);

    return {
      taskId: task.id,
      agentId: this.agentId,
      status: 'completed',
      output: response,
      duration: 1000,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
    };
  }

  private async callModel(prompt: string): Promise<unknown> {
    // Model-specific implementation
  }
}

// Pool of workers
const workerPool = new Map<string, SubAgentWorker>();

// Custom executor using worker pool
const workerExecutor: TaskExecutor = async (task, agent, context) => {
  let worker = workerPool.get(agent.id);

  if (!worker) {
    worker = new SubAgentWorker(agent.id, agent.modelPreference ?? 'standard');
    workerPool.set(agent.id, worker);
  }

  return worker.execute(task);
};

const coordinator = new HubCoordinator({
  config: { hubAgentId: 'hub-1' },
  taskExecutor: workerExecutor,
});
```

## Factory Functions

Quick creation helpers for common configurations:

```typescript
import {
  createHubCoordinator,
  createHubCoordinatorWithExecutor,
  createParallelCoordinator,
  createAuditLog,
  createAuditLogWithHandler,
  createModelSelector,
  createCostOptimizedSelector,
  createSpeedOptimizedSelector,
  createCapabilityOptimizedSelector,
  createResultSynthesizer,
  createMergeSynthesizer,
  createConsensusSynthesizer,
  createVotingSynthesizer,
} from '@wundr.io/agent-delegation';

// Simple coordinator
const basic = createHubCoordinator('hub-1');

// High-parallelism coordinator
const parallel = createParallelCoordinator('hub-1', 20);

// Cost-optimized model selection
const cheapSelector = createCostOptimizedSelector();

// Consensus-based synthesis with 70% threshold
const consensusSynth = createConsensusSynthesizer(0.7);
```

## Error Handling

### Error Codes

```typescript
enum DelegationErrorCode {
  INVALID_CONFIG = 'DELEGATION_INVALID_CONFIG',
  AGENT_NOT_FOUND = 'DELEGATION_AGENT_NOT_FOUND',
  TASK_NOT_FOUND = 'DELEGATION_TASK_NOT_FOUND',
  EXECUTION_FAILED = 'DELEGATION_EXECUTION_FAILED',
  TIMEOUT = 'DELEGATION_TIMEOUT',
  MAX_RETRIES_EXCEEDED = 'DELEGATION_MAX_RETRIES_EXCEEDED',
  NO_AVAILABLE_AGENT = 'DELEGATION_NO_AVAILABLE_AGENT',
  SYNTHESIS_FAILED = 'DELEGATION_SYNTHESIS_FAILED',
  MODEL_SELECTION_FAILED = 'DELEGATION_MODEL_SELECTION_FAILED',
  AUDIT_LOG_FAILED = 'DELEGATION_AUDIT_LOG_FAILED',
  CAPABILITY_MISMATCH = 'DELEGATION_CAPABILITY_MISMATCH',
  CONCURRENT_LIMIT_EXCEEDED = 'DELEGATION_CONCURRENT_LIMIT_EXCEEDED',
}
```

### Error Handling Example

```typescript
import { DelegationError, DelegationErrorCode } from '@wundr.io/agent-delegation';

try {
  const result = await coordinator.delegateTask({
    description: 'Complex analysis',
    requiredCapabilities: ['quantum-computing'],
  });
} catch (error) {
  if (error instanceof DelegationError) {
    switch (error.code) {
      case DelegationErrorCode.CAPABILITY_MISMATCH:
        console.error('No agent has the required capabilities');
        break;
      case DelegationErrorCode.NO_AVAILABLE_AGENT:
        console.error('All agents are busy');
        break;
      case DelegationErrorCode.TIMEOUT:
        console.error('Task timed out');
        break;
      default:
        console.error(`Delegation error: ${error.message}`);
    }
    console.error('Details:', error.details);
  }
}
```

## TypeScript Types

All types are exported for full type safety:

```typescript
import type {
  // Agent types
  AgentDefinition,
  AgentDefinitionInput,
  AgentCapabilityLevel,

  // Task types
  DelegationTask,
  DelegationTaskInput,
  DelegationResult,
  DelegationStatus,

  // Configuration types
  DelegationConfig,
  DelegationConfigInput,
  HubCoordinatorOptions,

  // Synthesis types
  SynthesisResult,
  SynthesisStrategy,
  SynthesisConflict,

  // Model types
  ModelConfig,
  ModelTier,
  ModelSelectionCriteria,
  ModelSelectionCriteriaInput,
  ModelSelectionResult,

  // Audit types
  AuditLogEntry,
  AuditEventType,
  AuditLogQuery,
  AuditLogStats,

  // Request/Response types
  ParallelDelegationRequest,
  ParallelDelegationResponse,
  CoordinatorMetrics,

  // Function types
  TaskExecutor,
  AuditLogger,
} from '@wundr.io/agent-delegation';
```

## Zod Schemas

Runtime validation schemas are exported:

```typescript
import {
  AgentDefinitionSchema,
  DelegationTaskSchema,
  DelegationConfigSchema,
  DelegationResultSchema,
  SynthesisResultSchema,
  AuditLogEntrySchema,
  ModelConfigSchema,
  ModelSelectionCriteriaSchema,
} from '@wundr.io/agent-delegation';

// Validate incoming data
const validatedTask = DelegationTaskSchema.parse(untrustedInput);
```

## License

MIT

## Contributing

See the main [Wundr repository](https://github.com/adapticai/wundr) for contribution guidelines.
