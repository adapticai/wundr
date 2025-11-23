# @wundr.io/crew-orchestrator

CrewAI-style role-based multi-agent team orchestration for Wundr.

## Overview

`@wundr.io/crew-orchestrator` provides a comprehensive framework for orchestrating multi-agent teams using role-based coordination patterns inspired by CrewAI. It supports sequential, hierarchical, and consensus-based process execution with built-in delegation, review loops, and task management.

## Features

- **Role-based agent coordination** - Define crew members with specific roles, goals, and capabilities
- **Multiple process types** - Sequential, hierarchical (manager-led), and consensus-based execution
- **Task delegation** - Intelligent task delegation between crew members
- **Review loops** - Manager review and refinement cycles for quality control
- **Zod schema validation** - Runtime type validation for all configurations
- **Event-driven architecture** - Subscribe to crew, task, and member events
- **Execution metrics** - Track performance and gather insights

## Installation

```bash
npm install @wundr.io/crew-orchestrator
# or
yarn add @wundr.io/crew-orchestrator
# or
pnpm add @wundr.io/crew-orchestrator
```

## Quick Start

```typescript
import { AgentCrew, CrewMemberInput, TaskInput } from '@wundr.io/crew-orchestrator';

// Define crew members
const members: CrewMemberInput[] = [
  {
    name: 'Research Analyst',
    role: 'researcher',
    goal: 'Find and analyze relevant information',
    capabilities: ['search', 'analysis', 'summarization'],
  },
  {
    name: 'Technical Writer',
    role: 'writer',
    goal: 'Create clear and comprehensive documentation',
    capabilities: ['writing', 'editing', 'formatting'],
  },
  {
    name: 'Team Manager',
    role: 'manager',
    goal: 'Ensure quality and coordinate team efforts',
    capabilities: ['review', 'coordination', 'delegation'],
  },
];

// Create crew
const crew = new AgentCrew({
  name: 'Documentation Team',
  description: 'A team for creating technical documentation',
  members,
  process: 'hierarchical',
});

await crew.initialize();

// Define tasks
const tasks: TaskInput[] = [
  {
    title: 'Research Topic',
    description: 'Research the API documentation patterns',
    expectedOutput: 'Research summary document',
    priority: 'high',
  },
  {
    title: 'Write Documentation',
    description: 'Create comprehensive API documentation',
    expectedOutput: 'Complete API documentation',
    priority: 'high',
  },
];

// Execute crew
const result = await crew.kickoff(tasks);
console.log('Crew completed:', result.success);
```

## Main Types

### CrewMember

Represents an agent in the crew with specific role and capabilities.

```typescript
interface CrewMember {
  id: string;                    // UUID
  name: string;                  // Display name
  role: CrewMemberRole;          // Role type
  goal: string;                  // Agent's objective
  backstory?: string;            // Optional context/background
  capabilities: string[];        // List of capabilities
  tools?: string[];              // Available tools
  allowDelegation: boolean;      // Can delegate tasks (default: true)
  verbose: boolean;              // Verbose logging (default: false)
  memory: boolean;               // Enable memory (default: true)
  maxIterations: number;         // Max iterations per task (default: 10)
  status: CrewMemberStatus;      // Current status
  metadata?: Record<string, unknown>;
}
```

### CrewMemberInput

Input type for creating crew members (with optional auto-generated fields).

```typescript
type CrewMemberInput = Omit<CrewMember, 'id' | 'status'> & {
  id?: string;
  status?: CrewMemberStatus;
};
```

### Task

Represents a unit of work to be executed by the crew.

```typescript
interface Task {
  id: string;                    // UUID
  title: string;                 // Task title
  description: string;           // Detailed description
  expectedOutput: string;        // Expected result description
  priority: TaskPriority;        // Priority level
  status: TaskStatus;            // Current status
  assignedTo?: string;           // Assigned member ID
  delegatedFrom?: string;        // Original assignee if delegated
  dependencies: string[];        // Task IDs this depends on
  context?: Record<string, unknown>;
  tools?: string[];              // Required tools
  asyncExecution: boolean;       // Run asynchronously (default: false)
  humanInput: boolean;           // Requires human input (default: false)
  outputFile?: string;           // Optional output file path
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  maxRetries: number;            // Max retry attempts (default: 3)
  retryCount: number;            // Current retry count
  timeout?: number;              // Execution timeout in ms
}
```

### TaskInput

Input type for creating tasks.

```typescript
type TaskInput = Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'> & {
  id?: string;
  status?: TaskStatus;
  createdAt?: Date;
  updatedAt?: Date;
  retryCount?: number;
};
```

### TaskResult

Result of task execution.

```typescript
interface TaskResult {
  taskId: string;                // Task UUID
  success: boolean;              // Execution success
  output: unknown;               // Task output data
  raw?: string;                  // Raw output string
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  executedBy: string;            // Member ID who executed
  delegationChain: string[];     // Chain of member IDs
  iterationsUsed: number;        // Iterations consumed
  tokensUsed?: number;           // LLM tokens used
  duration: number;              // Execution time in ms
  startedAt: Date;
  completedAt: Date;
  reviewHistory: Array<{
    reviewerId: string;
    decision: ReviewDecision;
    feedback?: string;
    timestamp: Date;
  }>;
}
```

### CrewConfig

Configuration for a crew.

```typescript
interface CrewConfig {
  id: string;                    // UUID
  name: string;                  // Crew name
  description?: string;          // Crew description
  members: CrewMember[];         // Crew members
  tasks: Task[];                 // Assigned tasks
  process: ProcessType;          // Execution process type
  verbose: boolean;              // Verbose logging
  memory: boolean;               // Enable memory
  maxRpm?: number;               // Max requests per minute
  shareCrewContext: boolean;     // Share context between members
  functionCallingLlm?: string;   // LLM for function calling
  stepCallback?: (data: StepCallbackData) => void;
  taskCallback?: (data: TaskCallbackData) => void;
  managerLlm?: string;           // LLM for manager
  managerAgent?: string;         // Manager member ID
  planningLlm?: string;          // LLM for planning
  embedder?: {
    provider: string;
    config: Record<string, unknown>;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### CrewResult

Result of crew execution.

```typescript
interface CrewResult {
  crewId: string;                // Crew UUID
  success: boolean;              // Overall success
  tasks: TaskResult[];           // Individual task results
  finalOutput?: unknown;         // Final combined output
  totalDuration: number;         // Total execution time in ms
  totalIterations: number;       // Total iterations across all tasks
  totalTokensUsed?: number;      // Total LLM tokens
  startedAt: Date;
  completedAt: Date;
  memberMetrics: Record<string, {
    tasksCompleted: number;
    tasksFailed: number;
    delegationsReceived: number;
    delegationsSent: number;
    totalDuration: number;
    averageIterations: number;
  }>;
  errors: Array<{
    taskId?: string;
    memberId?: string;
    code: string;
    message: string;
    timestamp: Date;
  }>;
}
```

## Crew Member Roles

The following roles are available for crew members:

| Role | Description |
|------|-------------|
| `manager` | Oversees team, coordinates work, reviews output |
| `researcher` | Gathers and analyzes information |
| `developer` | Writes and maintains code |
| `reviewer` | Reviews work and provides feedback |
| `tester` | Tests implementations and validates quality |
| `analyst` | Analyzes data and provides insights |
| `architect` | Designs systems and architectures |
| `writer` | Creates documentation and content |
| `custom` | Custom role with user-defined behavior |

### Crew Member Status

```typescript
type CrewMemberStatus =
  | 'idle'        // Available for work
  | 'working'     // Currently executing a task
  | 'delegating'  // Delegating work to another member
  | 'reviewing'   // Reviewing task output
  | 'blocked'     // Blocked on dependency
  | 'completed'   // Finished all assigned work
  | 'error';      // Encountered an error
```

## Process Types

### Sequential

Tasks are executed one after another in order.

```typescript
const crew = new AgentCrew({
  name: 'Sequential Team',
  members,
  process: 'sequential',
});
```

### Hierarchical

A manager oversees task execution with review loops. Workers execute tasks and the manager approves or requests revisions.

```typescript
const crew = new AgentCrew({
  name: 'Managed Team',
  members: [
    { name: 'Manager', role: 'manager', goal: 'Oversee quality', capabilities: ['review'] },
    { name: 'Worker 1', role: 'developer', goal: 'Implement features', capabilities: ['coding'] },
    { name: 'Worker 2', role: 'developer', goal: 'Implement features', capabilities: ['coding'] },
  ],
  process: 'hierarchical',
});
```

### Consensus

Multiple members execute tasks and vote on the best result. Requires at least 3 members for effective consensus.

```typescript
const crew = new AgentCrew({
  name: 'Review Board',
  members: [
    { name: 'Reviewer 1', role: 'reviewer', goal: 'Review code', capabilities: ['review'] },
    { name: 'Reviewer 2', role: 'reviewer', goal: 'Review code', capabilities: ['review'] },
    { name: 'Reviewer 3', role: 'reviewer', goal: 'Review code', capabilities: ['review'] },
  ],
  process: 'consensus',
});
```

## Task Priority and Status

### Priority Levels

```typescript
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
```

Priority weights (configurable):
- `critical`: 100
- `high`: 75
- `medium`: 50
- `low`: 25

### Task Status

```typescript
type TaskStatus =
  | 'pending'     // Waiting to be assigned
  | 'assigned'    // Assigned to a member
  | 'in_progress' // Currently being executed
  | 'delegated'   // Delegated to another member
  | 'review'      // Under manager review
  | 'completed'   // Successfully completed
  | 'failed'      // Execution failed
  | 'cancelled';  // Cancelled
```

## Delegation Mechanism

The `DelegationManager` handles task delegation between crew members.

### Delegation Flow

1. A member requests delegation with a reason
2. The delegation strategy selects the best available member
3. The task is delegated and tracked in the delegation chain
4. The delegatee executes the task

### Configuration

```typescript
import { DelegationManager } from '@wundr.io/crew-orchestrator';

const delegationManager = new DelegationManager({
  maxDelegationDepth: 5,        // Max delegation chain length
  delegationTimeout: 30000,      // Timeout for delegation decisions
  allowSelfDelegation: false,    // Prevent self-delegation
  requireReason: true,           // Require delegation reason
});
```

### Custom Delegation Strategy

```typescript
const customStrategy: DelegationStrategy = async (task, fromMember, availableMembers, context) => {
  // Find member with matching capabilities
  return availableMembers.find(m =>
    m.capabilities.some(cap => task.description.includes(cap))
  ) ?? null;
};

const manager = new DelegationManager({
  strategy: customStrategy,
});
```

## Review Loop Mechanism

The `ReviewLoopManager` implements manager review cycles for hierarchical process execution.

### Review Flow

1. Worker completes a task
2. Result is submitted for manager review
3. Manager provides feedback with a decision:
   - `approved` - Task passes quality gate
   - `needs_revision` - Task requires changes
   - `rejected` - Task fails quality requirements
   - `escalate` - Manager takes over the task
4. If revision needed, worker re-executes with feedback

### Review Decision Types

```typescript
type ReviewDecision = 'approved' | 'needs_revision' | 'rejected' | 'escalate';
```

### Configuration

```typescript
import { ReviewLoopManager } from '@wundr.io/crew-orchestrator';

const reviewManager = new ReviewLoopManager({
  maxReviewIterations: 3,        // Max review cycles per task
  reviewTimeout: 60000,          // Review timeout in ms
  autoApproveThreshold: 0.95,    // Quality score for auto-approval
  requireManagerApproval: true,  // Require explicit approval
});
```

### Custom Review Strategy

```typescript
const customReviewStrategy: ReviewStrategy = async (result, task, reviewer, context) => {
  const qualityScore = evaluateQuality(result);

  return {
    taskId: task.id,
    reviewerId: reviewer.id,
    decision: qualityScore >= 0.8 ? 'approved' : 'needs_revision',
    feedback: qualityScore >= 0.8
      ? 'Great work!'
      : 'Please improve error handling',
    qualityScore,
    timestamp: new Date(),
  };
};
```

## Zod Schema Validation

All types are validated at runtime using Zod schemas. This ensures type safety and catches configuration errors early.

### Available Schemas

```typescript
import {
  // Enum schemas
  CrewMemberRoleSchema,
  CrewMemberStatusSchema,
  TaskPrioritySchema,
  TaskStatusSchema,
  ProcessTypeSchema,
  ReviewDecisionSchema,

  // Object schemas
  CrewMemberSchema,
  TaskSchema,
  TaskResultSchema,
  CrewConfigSchema,
  CrewResultSchema,
  StepCallbackDataSchema,
  TaskCallbackDataSchema,
} from '@wundr.io/crew-orchestrator';

// Validate a crew member configuration
const result = CrewMemberSchema.safeParse({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Developer',
  role: 'developer',
  goal: 'Write code',
  capabilities: ['typescript', 'react'],
});

if (!result.success) {
  console.error('Validation failed:', result.error.errors);
}
```

## Factory Functions

Convenient functions for creating crews with common configurations.

### createSimpleCrew

```typescript
import { createSimpleCrew } from '@wundr.io/crew-orchestrator';

const crew = createSimpleCrew('My Crew', [
  { name: 'Worker', role: 'developer', goal: 'Write code', capabilities: ['coding'] },
]);
// Creates a crew with sequential process
```

### createHierarchicalCrew

```typescript
import { createHierarchicalCrew } from '@wundr.io/crew-orchestrator';

const crew = createHierarchicalCrew(
  'Managed Team',
  { name: 'Manager', role: 'manager', goal: 'Oversee work', capabilities: ['review'] },
  [
    { name: 'Dev 1', role: 'developer', goal: 'Code', capabilities: ['coding'] },
    { name: 'Dev 2', role: 'developer', goal: 'Code', capabilities: ['coding'] },
  ]
);
// Creates a hierarchical crew with the manager as first member
```

### createConsensusCrew

```typescript
import { createConsensusCrew } from '@wundr.io/crew-orchestrator';

const crew = createConsensusCrew('Review Board', [
  { name: 'Reviewer 1', role: 'reviewer', goal: 'Review', capabilities: ['review'] },
  { name: 'Reviewer 2', role: 'reviewer', goal: 'Review', capabilities: ['review'] },
  { name: 'Reviewer 3', role: 'reviewer', goal: 'Review', capabilities: ['review'] },
]);
// Creates a consensus-based crew (warns if fewer than 3 members)
```

## Event System

The `AgentCrew` extends `EventEmitter` and emits events during execution.

### Event Types

```typescript
type CrewEventType =
  | 'crew:started'           // Crew execution started
  | 'crew:completed'         // Crew execution completed
  | 'crew:error'             // Crew execution error
  | 'task:started'           // Task execution started
  | 'task:completed'         // Task execution completed
  | 'task:failed'            // Task execution failed
  | 'task:delegated'         // Task was delegated
  | 'task:retry_exhausted'   // Task retries exhausted
  | 'delegation:requested'   // Delegation requested
  | 'delegation:accepted'    // Delegation accepted
  | 'delegation:rejected'    // Delegation rejected
  | 'review:requested'       // Review requested
  | 'review:completed'       // Review completed
  | 'member:status_changed'; // Member status changed
```

### Subscribing to Events

```typescript
const crew = new AgentCrew({ name: 'My Crew', members, process: 'sequential' });

// Listen to specific events
crew.on('task:completed', (event) => {
  console.log(`Task ${event.data.taskId} completed`);
});

crew.on('crew:error', (event) => {
  console.error('Crew error:', event.data.error);
});

// Listen to all events
crew.on('event', (event) => {
  console.log(`[${event.type}]`, event.data);
});
```

## Custom Task Executor

Provide a custom executor to implement actual task execution logic.

```typescript
import { TaskExecutor } from '@wundr.io/crew-orchestrator';

const myExecutor: TaskExecutor = async (task, member, context) => {
  const startTime = new Date();

  try {
    // Your execution logic here
    const output = await executeWithLLM(task, member);

    return {
      taskId: task.id,
      success: true,
      output,
      executedBy: member.id,
      delegationChain: [],
      iterationsUsed: 1,
      duration: Date.now() - startTime.getTime(),
      startedAt: startTime,
      completedAt: new Date(),
      reviewHistory: [],
    };
  } catch (error) {
    return {
      taskId: task.id,
      success: false,
      output: null,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message,
      },
      executedBy: member.id,
      delegationChain: [],
      iterationsUsed: 1,
      duration: Date.now() - startTime.getTime(),
      startedAt: startTime,
      completedAt: new Date(),
      reviewHistory: [],
    };
  }
};

// Use with crew
const result = await crew.kickoff(tasks, myExecutor);

// Or set as default
crew.setExecutor(myExecutor);
```

## Error Handling

The package provides a custom `CrewError` class with specific error codes.

### Error Codes

```typescript
enum CrewErrorCode {
  INVALID_CONFIG = 'CREW_INVALID_CONFIG',
  MEMBER_NOT_FOUND = 'CREW_MEMBER_NOT_FOUND',
  TASK_NOT_FOUND = 'CREW_TASK_NOT_FOUND',
  TASK_EXECUTION_FAILED = 'CREW_TASK_EXECUTION_FAILED',
  DELEGATION_FAILED = 'CREW_DELEGATION_FAILED',
  REVIEW_FAILED = 'CREW_REVIEW_FAILED',
  TIMEOUT = 'CREW_TIMEOUT',
  MAX_ITERATIONS_EXCEEDED = 'CREW_MAX_ITERATIONS_EXCEEDED',
  DEPENDENCY_NOT_MET = 'CREW_DEPENDENCY_NOT_MET',
  CIRCULAR_DEPENDENCY = 'CREW_CIRCULAR_DEPENDENCY',
  NO_AVAILABLE_MEMBER = 'CREW_NO_AVAILABLE_MEMBER',
  CONSENSUS_FAILED = 'CREW_CONSENSUS_FAILED',
}
```

### Error Handling Example

```typescript
import { CrewError, CrewErrorCode } from '@wundr.io/crew-orchestrator';

try {
  await crew.kickoff(tasks);
} catch (error) {
  if (error instanceof CrewError) {
    switch (error.code) {
      case CrewErrorCode.NO_AVAILABLE_MEMBER:
        console.log('No members available, adding more...');
        break;
      case CrewErrorCode.CIRCULAR_DEPENDENCY:
        console.log('Fix task dependencies');
        break;
      default:
        console.error('Crew error:', error.message, error.details);
    }
  }
}
```

## API Reference

### AgentCrew

Main orchestration class.

| Method | Description |
|--------|-------------|
| `constructor(config, options?)` | Create a new crew |
| `initialize()` | Initialize crew and managers |
| `kickoff(tasks, executor?)` | Execute tasks with the crew |
| `addMember(member)` | Add a new member |
| `removeMember(memberId)` | Remove a member |
| `getMember(memberId)` | Get a member by ID |
| `getAllMembers()` | Get all members |
| `getAvailableMembers()` | Get idle members |
| `getManager()` | Get the manager member |
| `updateMemberStatus(memberId, status)` | Update member status |
| `getConfig()` | Get crew configuration |
| `getExecutionContext()` | Get current execution context |
| `isExecuting()` | Check if crew is running |
| `setExecutor(executor)` | Set default task executor |
| `shutdown()` | Shutdown crew and managers |

### TaskManager

Manages task assignment and scheduling.

| Method | Description |
|--------|-------------|
| `createTask(input)` | Create a new task |
| `getTask(taskId)` | Get a task by ID |
| `getAllTasks()` | Get all tasks |
| `getTasksByStatus(status)` | Filter tasks by status |
| `updateTaskStatus(taskId, status)` | Update task status |
| `assignTask(taskId, members, context?)` | Assign task to best member |
| `recordResult(taskId, result)` | Record task result |
| `getTaskResult(taskId)` | Get task result |
| `getNextTask()` | Get next task from queue |
| `retryTask(taskId)` | Retry a failed task |
| `validateDependencies(tasks)` | Check for circular dependencies |
| `getMetrics()` | Get execution metrics |

### DelegationManager

Manages task delegation.

| Method | Description |
|--------|-------------|
| `requestDelegation(task, member, reason, context)` | Request delegation |
| `processDelegation(request, members, context)` | Process delegation request |
| `getDelegationChain(taskId)` | Get delegation chain |
| `getDelegationDepth(taskId)` | Get current depth |
| `canDelegate(taskId)` | Check if can delegate |
| `cancelRequest(requestId)` | Cancel pending request |
| `getMetrics()` | Get delegation metrics |

### ReviewLoopManager

Manages manager review loops.

| Method | Description |
|--------|-------------|
| `submitForReview(task, result, reviewer, context)` | Submit for review |
| `canReview(taskId)` | Check if can review |
| `isApproved(taskId)` | Check if approved |
| `isRejected(taskId)` | Check if rejected |
| `getReviewHistory(taskId)` | Get review history |
| `getLatestFeedback(taskId)` | Get latest feedback |
| `getRevisionInstructions(taskId)` | Get revision instructions |
| `getMetrics()` | Get review metrics |

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a pull request.
