# @wundr.io/langgraph-orchestrator

LangGraph-style cyclic, state-driven workflow orchestration for AI agents. This package provides a powerful framework for building complex AI workflows with conditional branching, state management, checkpointing, and human-in-the-loop capabilities.

## Installation

```bash
npm install @wundr.io/langgraph-orchestrator
# or
pnpm add @wundr.io/langgraph-orchestrator
# or
yarn add @wundr.io/langgraph-orchestrator
```

## Package Overview

The `@wundr.io/langgraph-orchestrator` package enables you to build sophisticated AI agent workflows using a state graph paradigm. Key features include:

- **State Graph Architecture**: Define workflows as directed graphs with nodes and edges
- **Cyclic Workflows**: Support for loops and iterative processing patterns
- **Decision Nodes**: Conditional branching based on state values
- **Checkpointing**: Save and restore workflow state for fault tolerance
- **Human-in-the-Loop**: Pause workflows for human input or approval
- **Type Safety**: Full TypeScript support with Zod schema validation

## Quick Start

```typescript
import {
  StateGraph,
  createLLMNode,
  createToolNode,
  createDecisionNode,
  MemoryCheckpointer
} from '@wundr.io/langgraph-orchestrator';

// Create a workflow graph
const graph = new StateGraph('my-workflow')
  .addNode('agent', createLLMNode({
    id: 'agent',
    name: 'Agent',
    config: { model: 'claude-3-sonnet-20240229' }
  }))
  .addNode('tools', createToolNode({
    id: 'tools',
    name: 'Tools'
  }))
  .addEdge('agent', 'tools')
  .addConditionalEdge('tools', 'agent', {
    type: 'exists',
    field: 'data.pendingToolCalls'
  })
  .setEntryPoint('agent')
  .setCheckpointer(new MemoryCheckpointer());

// Execute the workflow
const result = await graph.execute({
  initialState: {
    data: { task: 'Research AI developments' }
  }
});
```

## Core Concepts

### StateGraph

The `StateGraph` class is the foundation for defining workflows. It manages nodes, edges, and execution flow.

```typescript
const graph = new StateGraph('workflow-name', {
  maxIterations: 100,      // Cycle protection
  timeout: 300000,         // 5 minute timeout
  checkpointEnabled: true, // Enable state persistence
  logLevel: 'info'
});
```

### AgentState

All workflows operate on an `AgentState` object that maintains:

- `id`: Unique state identifier
- `messages`: Conversation history
- `data`: Arbitrary key-value store for workflow data
- `currentStep`: Current node in execution
- `history`: State history for debugging
- `metadata`: Execution tracking metadata

### Nodes

Nodes are the processing units in your workflow. Each node receives state, performs operations, and returns updated state with optional next node specification.

### Edges

Edges define transitions between nodes:

- **Direct edges**: Always follow to the target node
- **Conditional edges**: Follow based on state conditions
- **Loop edges**: Enable cyclic workflows
- **Parallel edges**: Branch to multiple nodes

---

## Decision Nodes

Decision nodes enable conditional branching in your workflows based on state values. The package provides five decision node factory functions, each suited for different routing patterns.

### Condition Types

All decision nodes use condition types to evaluate state values:

| Type | Description | Example |
|------|-------------|---------|
| `equals` | Exact match comparison | `{ type: 'equals', field: 'data.status', value: 'complete' }` |
| `not_equals` | Inverse of equals | `{ type: 'not_equals', field: 'data.error', value: null }` |
| `contains` | Array includes or string contains | `{ type: 'contains', field: 'data.tags', value: 'urgent' }` |
| `greater_than` | Numeric comparison (>) | `{ type: 'greater_than', field: 'data.score', value: 0.8 }` |
| `less_than` | Numeric comparison (<) | `{ type: 'less_than', field: 'data.retries', value: 3 }` |
| `exists` | Value is not null/undefined | `{ type: 'exists', field: 'data.result' }` |
| `not_exists` | Value is null/undefined | `{ type: 'not_exists', field: 'error' }` |
| `custom` | Custom evaluation function | `{ type: 'custom', evaluate: async (state) => state.data.x > 10 }` |

### Field Path Notation

Conditions use dot notation to access nested state values:

```typescript
// Access state.data.user.role
{ type: 'equals', field: 'data.user.role', value: 'admin' }

// Access state.messages
{ type: 'exists', field: 'messages' }

// Access state.metadata.stepCount
{ type: 'greater_than', field: 'metadata.stepCount', value: 5 }
```

---

### createDecisionNode

The most flexible decision node, allowing multiple branches with priority-based evaluation.

**API:**

```typescript
function createDecisionNode<TState extends AgentState = AgentState>(options: {
  id: string;                              // Unique node identifier
  name: string;                            // Human-readable name
  config: DecisionNodeConfig;              // Decision configuration
  nodeConfig?: NodeConfig;                 // Optional node settings
}): NodeDefinition<TState>
```

**DecisionNodeConfig:**

```typescript
interface DecisionNodeConfig {
  branches: DecisionBranch[];              // Decision branches
  defaultBranch?: string;                  // Fallback target node
  throwOnNoMatch?: boolean;                // Error if no match (default: false)
  decide?: (state: AgentState) => string | Promise<string>;  // Custom function
}

interface DecisionBranch {
  name: string;                            // Branch identifier
  target: string;                          // Target node name
  condition: EdgeCondition;                // Branch condition
  priority?: number;                       // Evaluation order (higher first)
}
```

**Example:**

```typescript
import { createDecisionNode } from '@wundr.io/langgraph-orchestrator';

const router = createDecisionNode({
  id: 'router',
  name: 'Task Router',
  config: {
    branches: [
      {
        name: 'search',
        target: 'search-node',
        condition: { type: 'equals', field: 'data.action', value: 'search' },
        priority: 2
      },
      {
        name: 'answer',
        target: 'answer-node',
        condition: { type: 'equals', field: 'data.action', value: 'answer' },
        priority: 1
      }
    ],
    defaultBranch: 'fallback-node'
  }
});

graph.addNode('router', router);
```

**With Custom Decision Function:**

```typescript
const customRouter = createDecisionNode({
  id: 'smart-router',
  name: 'Smart Router',
  config: {
    branches: [], // Not used when decide function is provided
    decide: async (state) => {
      const score = state.data.confidence as number;
      if (score > 0.9) return 'high-confidence-handler';
      if (score > 0.5) return 'medium-confidence-handler';
      return 'low-confidence-handler';
    }
  }
});
```

---

### createSwitchNode

A switch-case style decision node for routing based on a single field value. Ideal for enumerated routing scenarios.

**API:**

```typescript
function createSwitchNode<TState extends AgentState = AgentState>(options: {
  id: string;                              // Unique node identifier
  name: string;                            // Human-readable name
  field: string;                           // State field to switch on
  cases: Record<string, string>;           // Value-to-target mapping
  default?: string;                        // Default target if no case matches
  nodeConfig?: NodeConfig;                 // Optional node settings
}): NodeDefinition<TState>
```

**Example:**

```typescript
import { createSwitchNode } from '@wundr.io/langgraph-orchestrator';

const typeSwitch = createSwitchNode({
  id: 'type-switch',
  name: 'Message Type Switch',
  field: 'data.messageType',
  cases: {
    'question': 'question-handler',
    'command': 'command-handler',
    'feedback': 'feedback-handler'
  },
  default: 'unknown-handler'
});

graph.addNode('type-switch', typeSwitch);
```

**Practical Use Case - Support Ticket Routing:**

```typescript
const ticketRouter = createSwitchNode({
  id: 'ticket-router',
  name: 'Support Ticket Router',
  field: 'data.department',
  cases: {
    'billing': 'billing-team',
    'technical': 'tech-support',
    'sales': 'sales-team',
    'legal': 'legal-team'
  },
  default: 'general-support'
});
```

---

### createThresholdNode

Routes based on numeric thresholds, perfect for confidence scores, priority levels, or any numeric classification.

**API:**

```typescript
function createThresholdNode<TState extends AgentState = AgentState>(options: {
  id: string;                              // Unique node identifier
  name: string;                            // Human-readable name
  field: string;                           // Numeric field to evaluate
  thresholds: Array<{                      // Threshold definitions
    value: number;                         // Threshold value
    target: string;                        // Target node
  }>;
  default?: string;                        // Target for values below all thresholds
  nodeConfig?: NodeConfig;                 // Optional node settings
}): NodeDefinition<TState>
```

**Threshold Evaluation:**

Thresholds are automatically sorted in descending order. A value matches a threshold if it is greater than or equal to the threshold value but less than the next higher threshold.

**Example:**

```typescript
import { createThresholdNode } from '@wundr.io/langgraph-orchestrator';

const confidenceRouter = createThresholdNode({
  id: 'confidence-router',
  name: 'Confidence Router',
  field: 'data.confidence',
  thresholds: [
    { value: 0.9, target: 'high-confidence' },    // >= 0.9
    { value: 0.7, target: 'medium-confidence' },  // >= 0.7 and < 0.9
    { value: 0.5, target: 'low-confidence' }      // >= 0.5 and < 0.7
  ],
  default: 'very-low-confidence'                  // < 0.5
});

graph.addNode('confidence-router', confidenceRouter);
```

**Practical Use Case - Priority Queue:**

```typescript
const priorityRouter = createThresholdNode({
  id: 'priority-router',
  name: 'Task Priority Router',
  field: 'data.priority',
  thresholds: [
    { value: 90, target: 'critical-queue' },
    { value: 70, target: 'high-priority-queue' },
    { value: 40, target: 'normal-queue' },
    { value: 10, target: 'low-priority-queue' }
  ],
  default: 'backlog-queue'
});
```

---

### createIfElseNode

A simple binary decision node for true/false branching based on a single condition.

**API:**

```typescript
function createIfElseNode<TState extends AgentState = AgentState>(options: {
  id: string;                              // Unique node identifier
  name: string;                            // Human-readable name
  condition: EdgeCondition;                // Condition to evaluate
  ifTrue: string;                          // Target node if condition is true
  ifFalse: string;                         // Target node if condition is false
  nodeConfig?: NodeConfig;                 // Optional node settings
}): NodeDefinition<TState>
```

**Example:**

```typescript
import { createIfElseNode } from '@wundr.io/langgraph-orchestrator';

const errorCheck = createIfElseNode({
  id: 'has-error',
  name: 'Error Check',
  condition: {
    type: 'exists',
    field: 'error'
  },
  ifTrue: 'error-handler',
  ifFalse: 'success-handler'
});

graph.addNode('has-error', errorCheck);
```

**Practical Use Cases:**

```typescript
// Authentication check
const authCheck = createIfElseNode({
  id: 'auth-check',
  name: 'Authentication Check',
  condition: { type: 'exists', field: 'data.userId' },
  ifTrue: 'authenticated-flow',
  ifFalse: 'login-required'
});

// Retry decision
const retryCheck = createIfElseNode({
  id: 'retry-check',
  name: 'Retry Decision',
  condition: { type: 'less_than', field: 'data.retryCount', value: 3 },
  ifTrue: 'retry-operation',
  ifFalse: 'max-retries-reached'
});

// Feature flag
const featureFlag = createIfElseNode({
  id: 'feature-flag',
  name: 'New Feature Check',
  condition: { type: 'equals', field: 'data.features.newUI', value: true },
  ifTrue: 'new-ui-flow',
  ifFalse: 'legacy-ui-flow'
});
```

---

### createMultiConditionNode

Routes based on multiple conditions combined with AND/OR logic. Ideal for complex business rules.

**API:**

```typescript
function createMultiConditionNode<TState extends AgentState = AgentState>(options: {
  id: string;                              // Unique node identifier
  name: string;                            // Human-readable name
  branches: Array<{
    name: string;                          // Branch identifier
    target: string;                        // Target node
    conditions: EdgeCondition[];           // Array of conditions
    logic: 'AND' | 'OR';                   // How to combine conditions
    priority?: number;                     // Evaluation order
  }>;
  default?: string;                        // Default target if no branch matches
  nodeConfig?: NodeConfig;                 // Optional node settings
}): NodeDefinition<TState>
```

**Logic Evaluation:**

- `AND`: All conditions must be true for the branch to match
- `OR`: At least one condition must be true for the branch to match

**Example:**

```typescript
import { createMultiConditionNode } from '@wundr.io/langgraph-orchestrator';

const complexRouter = createMultiConditionNode({
  id: 'complex-router',
  name: 'Complex Router',
  branches: [
    {
      name: 'premium-user',
      target: 'premium-flow',
      conditions: [
        { type: 'equals', field: 'data.userType', value: 'premium' },
        { type: 'greater_than', field: 'data.credits', value: 0 }
      ],
      logic: 'AND',  // Must be premium AND have credits
      priority: 2
    },
    {
      name: 'needs-upgrade',
      target: 'upgrade-flow',
      conditions: [
        { type: 'equals', field: 'data.userType', value: 'free' },
        { type: 'less_than', field: 'data.credits', value: 1 }
      ],
      logic: 'OR',   // Either free user OR out of credits
      priority: 1
    }
  ],
  default: 'standard-flow'
});

graph.addNode('complex-router', complexRouter);
```

**Practical Use Case - Access Control:**

```typescript
const accessControl = createMultiConditionNode({
  id: 'access-control',
  name: 'Access Control',
  branches: [
    {
      name: 'admin-access',
      target: 'admin-dashboard',
      conditions: [
        { type: 'equals', field: 'data.role', value: 'admin' },
        { type: 'equals', field: 'data.verified', value: true }
      ],
      logic: 'AND',
      priority: 3
    },
    {
      name: 'power-user',
      target: 'advanced-features',
      conditions: [
        { type: 'equals', field: 'data.role', value: 'power-user' },
        { type: 'greater_than', field: 'data.accountAge', value: 30 }
      ],
      logic: 'AND',
      priority: 2
    },
    {
      name: 'suspended-or-unverified',
      target: 'restricted-access',
      conditions: [
        { type: 'equals', field: 'data.suspended', value: true },
        { type: 'equals', field: 'data.verified', value: false }
      ],
      logic: 'OR',
      priority: 1
    }
  ],
  default: 'standard-user-flow'
});
```

---

## State Management

### Creating Initial State

```typescript
const result = await graph.execute({
  initialState: {
    data: {
      task: 'Process user request',
      userId: '12345',
      config: { maxRetries: 3 }
    }
  }
});
```

### State Updates in Nodes

Nodes return updated state in their `NodeResult`:

```typescript
const processNode: NodeDefinition = {
  id: 'process',
  name: 'Process Node',
  type: 'transform',
  config: {},
  execute: async (state, context) => {
    // Immutably update state
    const newState = {
      ...state,
      data: {
        ...state.data,
        processed: true,
        result: 'Some computation result'
      }
    };

    return {
      state: newState,
      next: 'next-node'  // Optional: specify next node
    };
  }
};
```

### State History

The graph automatically tracks state changes in the `history` array:

```typescript
// Access execution history
result.state.history.forEach(entry => {
  console.log(`Step: ${entry.step}`);
  console.log(`Changes: ${JSON.stringify(entry.changes)}`);
});
```

---

## Node Execution Flow

### Node Result

Every node returns a `NodeResult`:

```typescript
interface NodeResult<TState> {
  state: TState;                // Updated state
  next?: string | string[];     // Next node(s) - optional
  terminate?: boolean;          // Stop execution
  metadata?: {
    duration: number;           // Execution time
    tokensUsed?: number;        // LLM tokens consumed
    toolCalls?: ToolCall[];     // Tools executed
    retryCount?: number;        // Retry attempts
  };
}
```

### Execution Handlers

Monitor workflow execution with event handlers:

```typescript
const result = await graph.execute({
  handlers: {
    onStart: (state) => console.log('Started:', state.id),
    onNodeEnter: (nodeName, state) => console.log(`Entering: ${nodeName}`),
    onNodeExit: (nodeName, result) => console.log(`Exiting: ${nodeName}`),
    onCheckpoint: (checkpoint) => console.log('Checkpoint:', checkpoint.id),
    onError: (error) => console.error('Error:', error.message),
    onComplete: (state) => console.log('Complete:', state.id)
  }
});
```

### Event Emitter

The `StateGraph` class extends `EventEmitter` for reactive patterns:

```typescript
graph.on('execution:start', (state) => {
  console.log('Workflow started');
});

graph.on('node:enter', (nodeName, state) => {
  metrics.trackNodeEntry(nodeName);
});

graph.on('state:updated', (state) => {
  saveToDatabase(state);
});
```

---

## Checkpointing

### Memory Checkpointer

For development and testing:

```typescript
import { MemoryCheckpointer } from '@wundr.io/langgraph-orchestrator';

const checkpointer = new MemoryCheckpointer();
graph.setCheckpointer(checkpointer);
```

### File Checkpointer

For persistent storage:

```typescript
import { FileCheckpointer } from '@wundr.io/langgraph-orchestrator';

const checkpointer = new FileCheckpointer({
  directory: './checkpoints',
  format: 'json'
});
graph.setCheckpointer(checkpointer);
```

### Resuming from Checkpoint

```typescript
// Resume execution from a specific checkpoint
const result = await graph.execute({
  resumeFrom: 'checkpoint-id-here'
});
```

---

## Complete Example: AI Research Assistant

```typescript
import {
  StateGraph,
  createLLMNode,
  createToolNode,
  createDecisionNode,
  createIfElseNode,
  createThresholdNode,
  MemoryCheckpointer
} from '@wundr.io/langgraph-orchestrator';

// Define custom state
interface ResearchState extends AgentState {
  data: {
    query: string;
    searchResults?: string[];
    analysis?: string;
    confidence?: number;
    needsMoreInfo?: boolean;
  };
}

// Create the research workflow
const researchGraph = new StateGraph<ResearchState>('research-assistant', {
  maxIterations: 20
});

// Add nodes
researchGraph
  // Initial planning node
  .addNode('planner', createLLMNode({
    id: 'planner',
    name: 'Research Planner',
    config: { systemPrompt: 'Plan the research strategy for the given query.' }
  }))

  // Search execution
  .addNode('searcher', createToolNode({
    id: 'searcher',
    name: 'Web Searcher',
    config: { tools: [webSearchTool] }
  }))

  // Analyze search results
  .addNode('analyzer', createLLMNode({
    id: 'analyzer',
    name: 'Result Analyzer',
    config: { systemPrompt: 'Analyze the search results and assess confidence.' }
  }))

  // Decision: enough information?
  .addNode('confidence-check', createThresholdNode({
    id: 'confidence-check',
    name: 'Confidence Check',
    field: 'data.confidence',
    thresholds: [
      { value: 0.8, target: 'synthesizer' },
      { value: 0.5, target: 'refiner' }
    ],
    default: 'searcher'  // Low confidence, search more
  }))

  // Refine search query
  .addNode('refiner', createLLMNode({
    id: 'refiner',
    name: 'Query Refiner',
    config: { systemPrompt: 'Refine the search query based on gaps identified.' }
  }))

  // Synthesize final answer
  .addNode('synthesizer', createLLMNode({
    id: 'synthesizer',
    name: 'Answer Synthesizer',
    config: { systemPrompt: 'Synthesize a comprehensive answer from all research.' }
  }))

  // Define edges
  .addEdge('planner', 'searcher')
  .addEdge('searcher', 'analyzer')
  .addEdge('analyzer', 'confidence-check')
  .addEdge('refiner', 'searcher')

  // Set entry point and checkpointer
  .setEntryPoint('planner')
  .setCheckpointer(new MemoryCheckpointer());

// Execute research
const result = await researchGraph.execute({
  initialState: {
    data: {
      query: 'What are the latest advances in quantum computing?'
    }
  }
});

console.log('Research complete:', result.state.data.analysis);
console.log('Confidence:', result.state.data.confidence);
console.log('Path taken:', result.path.join(' -> '));
```

---

## API Reference

### Exports

#### Core Classes

- `StateGraph` - Main graph class for workflow definition and execution
- `StateGraphEvents` - Event types emitted by StateGraph

#### Node Factories

- `createLLMNode` - LLM-based processing node
- `createToolNode` - Tool execution node
- `createDecisionNode` - Multi-branch decision node
- `createSwitchNode` - Switch-case style routing
- `createThresholdNode` - Numeric threshold routing
- `createIfElseNode` - Binary decision node
- `createMultiConditionNode` - Complex multi-condition routing
- `createHumanNode` - Human-in-the-loop node

#### Edge Builders

- `conditionalEdge` - Conditional edge builder
- `loopEdge` - Loop edge builder
- `createRouter` - Dynamic routing helper

#### Checkpointing

- `MemoryCheckpointer` - In-memory checkpoint storage
- `FileCheckpointer` - File-based checkpoint storage
- `TimeTravelDebugger` - Debug tool for state history

#### Prebuilt Graphs

- `createAgentWorkflow` - Simple agent with tools
- `createChatWorkflow` - Conversational workflow
- `createDecisionTree` - Multi-level decision tree
- `createPlanExecuteRefineGraph` - Plan-execute-refine pattern

### Types

All TypeScript types are exported for use in your projects:

```typescript
import type {
  AgentState,
  NodeDefinition,
  NodeResult,
  EdgeCondition,
  ConditionType,
  ExecutionResult,
  ExecutionOptions
} from '@wundr.io/langgraph-orchestrator';
```

---

## License

MIT

## Links

- [Repository](https://github.com/adapticai/wundr)
- [Issues](https://github.com/adapticai/wundr/issues)
- [Homepage](https://wundr.io)
