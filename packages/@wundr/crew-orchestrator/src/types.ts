/**
 * @wundr/crew-orchestrator - Type Definitions
 *
 * TypeScript interfaces for CrewAI-style role-based multi-agent orchestration.
 */

import { z } from 'zod';

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Schema for validating crew member role configuration.
 *
 * @description Defines the available roles that a crew member can assume within the orchestration system.
 * Each role has specific responsibilities and capabilities that determine how the member participates
 * in task execution and delegation workflows.
 *
 * @example
 * ```typescript
 * // Validate a role string
 * const result = CrewMemberRoleSchema.safeParse('developer');
 * if (result.success) {
 *   console.log('Valid role:', result.data);
 * }
 *
 * // Use in crew member configuration
 * const member = {
 *   role: 'manager', // Will be validated
 *   // ... other properties
 * };
 * ```
 *
 * Role descriptions:
 * - `manager`: Coordinates tasks, delegates work, and reviews outputs
 * - `researcher`: Gathers information and performs analysis
 * - `developer`: Implements code and technical solutions
 * - `reviewer`: Reviews work products and provides feedback
 * - `tester`: Creates and executes test cases
 * - `analyst`: Analyzes data and generates insights
 * - `architect`: Designs system architecture and technical specifications
 * - `writer`: Creates documentation and written content
 * - `custom`: User-defined role with custom capabilities
 */
export const CrewMemberRoleSchema = z.enum([
  'manager',
  'researcher',
  'developer',
  'reviewer',
  'tester',
  'analyst',
  'architect',
  'writer',
  'custom',
]);

/**
 * Schema for validating crew member status.
 *
 * @description Represents the current operational state of a crew member during task execution.
 * Status transitions are managed by the orchestrator and reflect the member's activity within
 * the crew workflow.
 *
 * @example
 * ```typescript
 * // Check if a member is available for new work
 * const status = CrewMemberStatusSchema.parse(member.status);
 * const isAvailable = status === 'idle' || status === 'completed';
 *
 * // Track status changes
 * member.status = 'working';
 * CrewMemberStatusSchema.parse(member.status); // Validates the new status
 * ```
 *
 * Status descriptions:
 * - `idle`: Member is available and waiting for task assignment
 * - `working`: Member is actively executing a task
 * - `delegating`: Member is in the process of delegating work to another member
 * - `reviewing`: Member is reviewing another member's work output
 * - `blocked`: Member cannot proceed due to dependency or external factor
 * - `completed`: Member has finished all assigned work
 * - `error`: Member encountered an unrecoverable error
 */
export const CrewMemberStatusSchema = z.enum([
  'idle',
  'working',
  'delegating',
  'reviewing',
  'blocked',
  'completed',
  'error',
]);

/**
 * Schema for validating task priority levels.
 *
 * @description Defines the urgency and importance of a task within the execution queue.
 * Priority affects task scheduling order and resource allocation decisions.
 *
 * @example
 * ```typescript
 * // Create a high-priority task
 * const task = {
 *   priority: TaskPrioritySchema.parse('high'),
 *   title: 'Critical bug fix',
 *   // ... other properties
 * };
 *
 * // Sort tasks by priority
 * const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
 * tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
 * ```
 *
 * Priority levels:
 * - `low`: Non-urgent task, can be deferred
 * - `medium`: Standard priority, default for most tasks
 * - `high`: Important task requiring prompt attention
 * - `critical`: Urgent task requiring immediate execution
 */
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Schema for validating task execution status.
 *
 * @description Tracks the lifecycle state of a task from creation through completion or failure.
 * Status transitions follow a defined state machine managed by the orchestrator.
 *
 * @example
 * ```typescript
 * // Check if task is actionable
 * const status = TaskStatusSchema.parse(task.status);
 * const isActionable = ['pending', 'assigned'].includes(status);
 *
 * // Track task progression
 * task.status = 'in_progress';
 * task.startedAt = new Date();
 * ```
 *
 * Status descriptions:
 * - `pending`: Task created but not yet assigned to a member
 * - `assigned`: Task assigned to a member, awaiting execution start
 * - `in_progress`: Task is actively being executed
 * - `delegated`: Task has been delegated to another member
 * - `review`: Task output is under review by a reviewer/manager
 * - `completed`: Task finished successfully
 * - `failed`: Task execution failed after all retry attempts
 * - `cancelled`: Task was manually cancelled before completion
 */
export const TaskStatusSchema = z.enum([
  'pending',
  'assigned',
  'in_progress',
  'delegated',
  'review',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Schema for validating crew process execution type.
 *
 * @description Defines how tasks are coordinated and executed within a crew.
 * The process type determines the workflow pattern and member interactions.
 *
 * @example
 * ```typescript
 * // Configure a hierarchical crew with manager oversight
 * const crew = {
 *   process: ProcessTypeSchema.parse('hierarchical'),
 *   managerAgent: managerId,
 *   // ... other properties
 * };
 *
 * // Sequential process for ordered task execution
 * const sequentialCrew = {
 *   process: 'sequential',
 *   tasks: [task1, task2, task3], // Executed in order
 * };
 * ```
 *
 * Process types:
 * - `sequential`: Tasks executed one after another in defined order
 * - `hierarchical`: Manager delegates and reviews all work, controlling flow
 * - `consensus`: Multiple members collaborate and reach agreement on outputs
 */
export const ProcessTypeSchema = z.enum([
  'sequential',
  'hierarchical',
  'consensus',
]);

/**
 * Schema for validating review decisions.
 *
 * @description Represents the outcome of a task review, determining the next action
 * in the review workflow. Used in hierarchical process types where managers review work.
 *
 * @example
 * ```typescript
 * // Process review decision
 * const decision = ReviewDecisionSchema.parse(feedback.decision);
 * switch (decision) {
 *   case 'approved':
 *     markTaskComplete(task);
 *     break;
 *   case 'needs_revision':
 *     assignForRevision(task, feedback.suggestedChanges);
 *     break;
 *   case 'rejected':
 *     reassignTask(task);
 *     break;
 *   case 'escalate':
 *     escalateToHigherAuthority(task);
 *     break;
 * }
 * ```
 *
 * Decision types:
 * - `approved`: Work meets quality standards and is accepted
 * - `needs_revision`: Work requires changes based on feedback
 * - `rejected`: Work does not meet requirements and must be redone
 * - `escalate`: Issue requires higher-level review or intervention
 */
export const ReviewDecisionSchema = z.enum([
  'approved',
  'needs_revision',
  'rejected',
  'escalate',
]);

/**
 * Schema for crew member configuration.
 *
 * @description Defines the complete configuration for a crew member (agent) including
 * identity, capabilities, behavioral settings, and current state. Crew members are
 * the primary actors in the orchestration system, executing tasks and collaborating
 * with other members.
 *
 * @example
 * ```typescript
 * // Create a developer crew member
 * const developer = CrewMemberSchema.parse({
 *   id: crypto.randomUUID(),
 *   name: 'Senior Developer',
 *   role: 'developer',
 *   goal: 'Implement high-quality, maintainable code solutions',
 *   backstory: 'Expert in TypeScript and distributed systems',
 *   capabilities: ['typescript', 'nodejs', 'testing', 'code-review'],
 *   tools: ['code-editor', 'terminal', 'git'],
 *   allowDelegation: true,
 *   verbose: false,
 *   memory: true,
 *   maxIterations: 15,
 * });
 *
 * // Create a manager with review capabilities
 * const manager = CrewMemberSchema.parse({
 *   id: crypto.randomUUID(),
 *   name: 'Engineering Manager',
 *   role: 'manager',
 *   goal: 'Ensure team delivers quality work on schedule',
 *   capabilities: ['planning', 'review', 'delegation', 'conflict-resolution'],
 *   allowDelegation: true,
 *   maxIterations: 20,
 * });
 * ```
 *
 * Schema properties:
 * - `id`: Unique UUID identifier for the member
 * - `name`: Human-readable display name
 * - `role`: Member's role in the crew (see CrewMemberRoleSchema)
 * - `goal`: Primary objective guiding the member's decisions
 * - `backstory`: Optional background context for persona-based prompting
 * - `capabilities`: Array of skills/abilities the member possesses
 * - `tools`: Optional array of tool names the member can use
 * - `allowDelegation`: Whether member can delegate tasks (default: true)
 * - `verbose`: Enable detailed logging of member actions (default: false)
 * - `memory`: Enable memory for context retention (default: true)
 * - `maxIterations`: Maximum iterations per task (default: 10)
 * - `status`: Current operational status (default: 'idle')
 * - `metadata`: Optional custom key-value data
 */
export const CrewMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  role: CrewMemberRoleSchema,
  goal: z.string().min(1),
  backstory: z.string().optional(),
  capabilities: z.array(z.string()),
  tools: z.array(z.string()).optional(),
  allowDelegation: z.boolean().default(true),
  verbose: z.boolean().default(false),
  memory: z.boolean().default(true),
  maxIterations: z.number().int().positive().default(10),
  status: CrewMemberStatusSchema.default('idle'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for task configuration.
 *
 * @description Defines a unit of work to be executed by crew members. Tasks contain
 * all information needed for assignment, execution, and tracking including dependencies,
 * context, and retry configuration.
 *
 * @example
 * ```typescript
 * // Create a code implementation task
 * const implementationTask = TaskSchema.parse({
 *   id: crypto.randomUUID(),
 *   title: 'Implement User Authentication',
 *   description: 'Create JWT-based authentication with refresh tokens',
 *   expectedOutput: 'Working auth module with login, logout, and token refresh',
 *   priority: 'high',
 *   tools: ['code-editor', 'terminal'],
 *   context: { framework: 'express', database: 'postgresql' },
 *   maxRetries: 3,
 *   timeout: 300000, // 5 minutes
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Create a dependent task
 * const testingTask = TaskSchema.parse({
 *   id: crypto.randomUUID(),
 *   title: 'Write Authentication Tests',
 *   description: 'Create unit and integration tests for auth module',
 *   expectedOutput: 'Comprehensive test suite with >90% coverage',
 *   priority: 'high',
 *   dependencies: [implementationTask.id], // Depends on implementation
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 * ```
 *
 * Schema properties:
 * - `id`: Unique UUID identifier for the task
 * - `title`: Brief descriptive title
 * - `description`: Detailed task requirements and instructions
 * - `expectedOutput`: Description of what successful completion looks like
 * - `priority`: Urgency level (default: 'medium')
 * - `status`: Current execution status (default: 'pending')
 * - `assignedTo`: UUID of assigned crew member
 * - `delegatedFrom`: UUID of member who delegated this task
 * - `dependencies`: Array of task UUIDs that must complete first (default: [])
 * - `context`: Optional key-value context data
 * - `tools`: Optional array of required tool names
 * - `asyncExecution`: Run task asynchronously (default: false)
 * - `humanInput`: Requires human input during execution (default: false)
 * - `outputFile`: Optional file path for task output
 * - `createdAt`: Task creation timestamp
 * - `updatedAt`: Last modification timestamp
 * - `startedAt`: Execution start timestamp
 * - `completedAt`: Completion timestamp
 * - `maxRetries`: Maximum retry attempts on failure (default: 3)
 * - `retryCount`: Current retry count (default: 0)
 * - `timeout`: Optional execution timeout in milliseconds
 */
export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  expectedOutput: z.string().min(1),
  priority: TaskPrioritySchema.default('medium'),
  status: TaskStatusSchema.default('pending'),
  assignedTo: z.string().uuid().optional(),
  delegatedFrom: z.string().uuid().optional(),
  dependencies: z.array(z.string().uuid()).default([]),
  context: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.string()).optional(),
  asyncExecution: z.boolean().default(false),
  humanInput: z.boolean().default(false),
  outputFile: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  maxRetries: z.number().int().nonnegative().default(3),
  retryCount: z.number().int().nonnegative().default(0),
  timeout: z.number().int().positive().optional(),
});

/**
 * Schema for task execution result.
 *
 * @description Captures the complete outcome of a task execution including output data,
 * error information, execution metrics, and review history. Used for tracking, debugging,
 * and workflow continuation.
 *
 * @example
 * ```typescript
 * // Successful task result
 * const successResult = TaskResultSchema.parse({
 *   taskId: task.id,
 *   success: true,
 *   output: { code: authModuleCode, tests: testSuite },
 *   raw: 'Generated authentication module with 15 functions...',
 *   executedBy: developer.id,
 *   delegationChain: [],
 *   iterationsUsed: 3,
 *   tokensUsed: 5420,
 *   duration: 45000, // 45 seconds
 *   startedAt: new Date('2024-01-15T10:00:00Z'),
 *   completedAt: new Date('2024-01-15T10:00:45Z'),
 * });
 *
 * // Failed task result with error details
 * const failedResult = TaskResultSchema.parse({
 *   taskId: task.id,
 *   success: false,
 *   output: null,
 *   error: {
 *     code: 'EXECUTION_TIMEOUT',
 *     message: 'Task exceeded maximum execution time',
 *     details: { timeout: 300000, elapsed: 300500 },
 *   },
 *   executedBy: developer.id,
 *   delegationChain: [manager.id],
 *   iterationsUsed: 10,
 *   duration: 300500,
 *   startedAt: new Date('2024-01-15T10:00:00Z'),
 *   completedAt: new Date('2024-01-15T10:05:00Z'),
 * });
 * ```
 *
 * Schema properties:
 * - `taskId`: UUID of the executed task
 * - `success`: Whether task completed successfully
 * - `output`: Task output data (any type)
 * - `raw`: Optional raw string output
 * - `error`: Optional error details with code, message, and details
 * - `executedBy`: UUID of the member who executed the task
 * - `delegationChain`: Array of member UUIDs showing delegation path (default: [])
 * - `iterationsUsed`: Number of iterations used during execution
 * - `tokensUsed`: Optional LLM token count
 * - `duration`: Execution time in milliseconds
 * - `startedAt`: Execution start timestamp
 * - `completedAt`: Execution end timestamp
 * - `reviewHistory`: Array of review records (default: [])
 */
export const TaskResultSchema = z.object({
  taskId: z.string().uuid(),
  success: z.boolean(),
  output: z.unknown(),
  raw: z.string().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  executedBy: z.string().uuid(),
  delegationChain: z.array(z.string().uuid()).default([]),
  iterationsUsed: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative().optional(),
  duration: z.number().nonnegative(),
  startedAt: z.date(),
  completedAt: z.date(),
  reviewHistory: z
    .array(
      z.object({
        reviewerId: z.string().uuid(),
        decision: ReviewDecisionSchema,
        feedback: z.string().optional(),
        timestamp: z.date(),
      }),
    )
    .default([]),
});

/**
 * Schema for step callback event data.
 *
 * @description Defines the payload structure for step-level callbacks during crew execution.
 * Step callbacks provide fine-grained visibility into the orchestration process for logging,
 * monitoring, and debugging purposes.
 *
 * @example
 * ```typescript
 * // Register a step callback
 * const stepCallback = (data: z.infer<typeof StepCallbackDataSchema>) => {
 *   console.log(`[${data.type}] Crew ${data.crewId} at ${data.timestamp}`);
 *   if (data.type === 'task:progress') {
 *     console.log('Progress:', data.data.progress);
 *   }
 * };
 *
 * const crew = {
 *   stepCallback,
 *   // ... other config
 * };
 * ```
 *
 * Schema properties:
 * - `type`: Event type identifier string
 * - `crewId`: UUID of the crew emitting the event
 * - `timestamp`: When the event occurred
 * - `data`: Event-specific payload data
 */
export const StepCallbackDataSchema = z.object({
  type: z.string(),
  crewId: z.string(),
  timestamp: z.date(),
  data: z.record(z.string(), z.unknown()),
});

/**
 * Schema for task callback event data.
 *
 * @description Defines the payload structure for task-level callbacks, providing complete
 * task context including the task configuration, execution result, and executing member.
 * Used for task completion notifications and result processing.
 *
 * @example
 * ```typescript
 * // Register a task callback for logging completed tasks
 * const taskCallback = (data: z.infer<typeof TaskCallbackDataSchema>) => {
 *   const { task, result, member } = data;
 *   console.log(`Task "${task.title}" ${result.success ? 'completed' : 'failed'}`);
 *   console.log(`Executed by: ${member.name} (${member.role})`);
 *   console.log(`Duration: ${result.duration}ms`);
 * };
 *
 * const crew = {
 *   taskCallback,
 *   // ... other config
 * };
 * ```
 *
 * Schema properties:
 * - `task`: Complete task configuration (TaskSchema)
 * - `result`: Task execution result (TaskResultSchema)
 * - `member`: Crew member who executed the task (CrewMemberSchema)
 */
export const TaskCallbackDataSchema = z.object({
  task: TaskSchema,
  result: TaskResultSchema,
  member: CrewMemberSchema,
});

/**
 * Schema for crew configuration.
 *
 * @description Defines the complete configuration for a crew including members, tasks,
 * process type, and behavioral settings. A crew is the primary orchestration unit that
 * coordinates multiple agents to accomplish complex workflows.
 *
 * @example
 * ```typescript
 * // Create a development crew with hierarchical process
 * const devCrew = CrewConfigSchema.parse({
 *   id: crypto.randomUUID(),
 *   name: 'Feature Development Crew',
 *   description: 'Crew for implementing new features with review',
 *   members: [manager, developer, tester, reviewer],
 *   tasks: [designTask, implementTask, testTask],
 *   process: 'hierarchical',
 *   verbose: true,
 *   memory: true,
 *   maxRpm: 60,
 *   shareCrewContext: true,
 *   managerAgent: manager.id,
 *   stepCallback: (data) => console.log(data),
 *   taskCallback: (data) => logTaskResult(data),
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Create a simple sequential crew
 * const simpleCrew = CrewConfigSchema.parse({
 *   id: crypto.randomUUID(),
 *   name: 'Data Processing Crew',
 *   members: [analyst, writer],
 *   process: 'sequential',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 * ```
 *
 * Schema properties:
 * - `id`: Unique UUID identifier for the crew
 * - `name`: Human-readable crew name
 * - `description`: Optional detailed description
 * - `members`: Array of crew members (minimum 1)
 * - `tasks`: Array of tasks to execute (default: [])
 * - `process`: Execution process type (default: 'sequential')
 * - `verbose`: Enable detailed logging (default: false)
 * - `memory`: Enable shared memory between members (default: true)
 * - `maxRpm`: Optional rate limit (requests per minute)
 * - `shareCrewContext`: Share context between members (default: true)
 * - `functionCallingLlm`: Optional LLM for function calling
 * - `stepCallback`: Optional callback for step events
 * - `taskCallback`: Optional callback for task events
 * - `managerLlm`: Optional specific LLM for manager role
 * - `managerAgent`: Optional UUID of designated manager
 * - `planningLlm`: Optional LLM for planning tasks
 * - `embedder`: Optional embedder configuration
 * - `createdAt`: Crew creation timestamp
 * - `updatedAt`: Last modification timestamp
 */
export const CrewConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  members: z.array(CrewMemberSchema).min(1),
  tasks: z.array(TaskSchema).default([]),
  process: ProcessTypeSchema.default('sequential'),
  verbose: z.boolean().default(false),
  memory: z.boolean().default(true),
  maxRpm: z.number().int().positive().optional(),
  shareCrewContext: z.boolean().default(true),
  functionCallingLlm: z.string().optional(),
  stepCallback: z
    .function()
    .args(StepCallbackDataSchema)
    .returns(z.void())
    .optional(),
  taskCallback: z
    .function()
    .args(TaskCallbackDataSchema)
    .returns(z.void())
    .optional(),
  managerLlm: z.string().optional(),
  managerAgent: z.string().uuid().optional(),
  planningLlm: z.string().optional(),
  embedder: z
    .object({
      provider: z.string(),
      config: z.record(z.string(), z.unknown()),
    })
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Schema for crew execution result.
 *
 * @description Captures the complete outcome of a crew execution including all task results,
 * aggregate metrics, member performance data, and any errors encountered. Used for analysis,
 * reporting, and workflow optimization.
 *
 * @example
 * ```typescript
 * // Access crew execution results
 * const result = CrewResultSchema.parse(executionOutput);
 *
 * if (result.success) {
 *   console.log(`Crew completed in ${result.totalDuration}ms`);
 *   console.log(`Total iterations: ${result.totalIterations}`);
 *   console.log(`Final output:`, result.finalOutput);
 *
 *   // Analyze member performance
 *   for (const [memberId, metrics] of Object.entries(result.memberMetrics)) {
 *     console.log(`Member ${memberId}:`);
 *     console.log(`  Tasks completed: ${metrics.tasksCompleted}`);
 *     console.log(`  Avg iterations: ${metrics.averageIterations}`);
 *   }
 * } else {
 *   console.error('Crew execution failed');
 *   result.errors.forEach(err => {
 *     console.error(`[${err.code}] ${err.message}`);
 *   });
 * }
 * ```
 *
 * Schema properties:
 * - `crewId`: UUID of the executed crew
 * - `success`: Whether all tasks completed successfully
 * - `tasks`: Array of individual task results
 * - `finalOutput`: Optional aggregated final output
 * - `totalDuration`: Total execution time in milliseconds
 * - `totalIterations`: Sum of all task iterations
 * - `totalTokensUsed`: Optional sum of LLM tokens used
 * - `startedAt`: Execution start timestamp
 * - `completedAt`: Execution end timestamp
 * - `memberMetrics`: Performance metrics keyed by member UUID
 * - `errors`: Array of error records (default: [])
 */
export const CrewResultSchema = z.object({
  crewId: z.string().uuid(),
  success: z.boolean(),
  tasks: z.array(TaskResultSchema),
  finalOutput: z.unknown().optional(),
  totalDuration: z.number().nonnegative(),
  totalIterations: z.number().int().nonnegative(),
  totalTokensUsed: z.number().int().nonnegative().optional(),
  startedAt: z.date(),
  completedAt: z.date(),
  memberMetrics: z.record(
    z.string().uuid(),
    z.object({
      tasksCompleted: z.number().int().nonnegative(),
      tasksFailed: z.number().int().nonnegative(),
      delegationsReceived: z.number().int().nonnegative(),
      delegationsSent: z.number().int().nonnegative(),
      totalDuration: z.number().nonnegative(),
      averageIterations: z.number().nonnegative(),
    }),
  ),
  errors: z
    .array(
      z.object({
        taskId: z.string().uuid().optional(),
        memberId: z.string().uuid().optional(),
        code: z.string(),
        message: z.string(),
        timestamp: z.date(),
      }),
    )
    .default([]),
});

// =============================================================================
// TypeScript Types (derived from Zod schemas)
// =============================================================================

/**
 * Crew member role types.
 *
 * @description Union type of all valid crew member roles derived from CrewMemberRoleSchema.
 * Use this type for type-safe role assignments and comparisons.
 *
 * @example
 * ```typescript
 * function assignByRole(role: CrewMemberRole): string {
 *   switch (role) {
 *     case 'manager': return 'Coordinating team...';
 *     case 'developer': return 'Writing code...';
 *     case 'tester': return 'Running tests...';
 *     default: return 'Working...';
 *   }
 * }
 * ```
 */
export type CrewMemberRole = z.infer<typeof CrewMemberRoleSchema>;

/**
 * Crew member status types.
 *
 * @description Union type of all valid crew member statuses derived from CrewMemberStatusSchema.
 * Use this type for type-safe status checks and transitions.
 *
 * @example
 * ```typescript
 * function isAvailable(status: CrewMemberStatus): boolean {
 *   return status === 'idle' || status === 'completed';
 * }
 *
 * function canDelegate(status: CrewMemberStatus): boolean {
 *   return status === 'working';
 * }
 * ```
 */
export type CrewMemberStatus = z.infer<typeof CrewMemberStatusSchema>;

/**
 * Task priority levels.
 *
 * @description Union type of all valid task priority levels derived from TaskPrioritySchema.
 * Use this type for type-safe priority assignments and scheduling logic.
 *
 * @example
 * ```typescript
 * const priorityWeight: Record<TaskPriority, number> = {
 *   critical: 100,
 *   high: 75,
 *   medium: 50,
 *   low: 25,
 * };
 *
 * function calculateScore(priority: TaskPriority): number {
 *   return priorityWeight[priority];
 * }
 * ```
 */
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/**
 * Task status types.
 *
 * @description Union type of all valid task statuses derived from TaskStatusSchema.
 * Use this type for type-safe status management and workflow control.
 *
 * @example
 * ```typescript
 * function isTerminal(status: TaskStatus): boolean {
 *   return ['completed', 'failed', 'cancelled'].includes(status);
 * }
 *
 * function requiresAction(status: TaskStatus): boolean {
 *   return ['pending', 'assigned', 'review'].includes(status);
 * }
 * ```
 */
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Process execution types.
 *
 * @description Union type of all valid process types derived from ProcessTypeSchema.
 * Determines how a crew coordinates task execution among its members.
 *
 * @example
 * ```typescript
 * function getProcessHandler(type: ProcessType): ProcessHandler {
 *   switch (type) {
 *     case 'sequential': return new SequentialProcessor();
 *     case 'hierarchical': return new HierarchicalProcessor();
 *     case 'consensus': return new ConsensusProcessor();
 *   }
 * }
 * ```
 */
export type ProcessType = z.infer<typeof ProcessTypeSchema>;

/**
 * Review decision types.
 *
 * @description Union type of all valid review decisions derived from ReviewDecisionSchema.
 * Used in hierarchical processes where work is reviewed before acceptance.
 *
 * @example
 * ```typescript
 * function handleDecision(decision: ReviewDecision, task: Task): void {
 *   if (decision === 'approved') {
 *     completeTask(task);
 *   } else if (decision === 'needs_revision') {
 *     sendForRevision(task);
 *   }
 * }
 * ```
 */
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

/**
 * Configuration for a crew member (agent).
 *
 * @description Complete type definition for a crew member derived from CrewMemberSchema.
 * Represents an agent with defined role, capabilities, and behavioral settings.
 *
 * @example
 * ```typescript
 * const member: CrewMember = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   name: 'Code Reviewer',
 *   role: 'reviewer',
 *   goal: 'Ensure code quality and best practices',
 *   capabilities: ['code-review', 'security-audit', 'performance-analysis'],
 *   allowDelegation: false,
 *   verbose: true,
 *   memory: true,
 *   maxIterations: 5,
 *   status: 'idle',
 * };
 * ```
 */
export type CrewMember = z.infer<typeof CrewMemberSchema>;

/**
 * Input for creating a new crew member.
 *
 * @description Partial type for crew member creation where id and status are optional.
 * The orchestrator will generate missing values with appropriate defaults.
 *
 * @example
 * ```typescript
 * // Create member with minimal required fields
 * const input: CrewMemberInput = {
 *   name: 'Research Assistant',
 *   role: 'researcher',
 *   goal: 'Gather and synthesize information',
 *   capabilities: ['web-search', 'summarization'],
 * };
 *
 * // id will be auto-generated, status defaults to 'idle'
 * const member = createCrewMember(input);
 * ```
 */
export type CrewMemberInput = Omit<CrewMember, 'id' | 'status'> & {
  /** Optional UUID; auto-generated if not provided */
  id?: string;
  /** Optional initial status; defaults to 'idle' */
  status?: CrewMemberStatus;
};

/**
 * Configuration for a task.
 *
 * @description Complete type definition for a task derived from TaskSchema.
 * Represents a unit of work with all execution parameters and tracking data.
 *
 * @example
 * ```typescript
 * const task: Task = {
 *   id: '123e4567-e89b-12d3-a456-426614174001',
 *   title: 'API Integration',
 *   description: 'Integrate payment gateway API',
 *   expectedOutput: 'Working payment processing module',
 *   priority: 'high',
 *   status: 'pending',
 *   dependencies: [],
 *   asyncExecution: false,
 *   humanInput: false,
 *   maxRetries: 3,
 *   retryCount: 0,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export type Task = z.infer<typeof TaskSchema>;

/**
 * Input for creating a new task.
 *
 * @description Partial type for task creation where generated fields are optional.
 * The orchestrator will set id, status, timestamps, and retry count as needed.
 *
 * @example
 * ```typescript
 * // Create task with required fields only
 * const input: TaskInput = {
 *   title: 'Database Migration',
 *   description: 'Migrate user data to new schema',
 *   expectedOutput: 'All user records migrated successfully',
 *   priority: 'critical',
 * };
 *
 * // Optional fields will be auto-populated
 * const task = createTask(input);
 * ```
 */
export type TaskInput = Omit<
  Task,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'
> & {
  /** Optional UUID; auto-generated if not provided */
  id?: string;
  /** Optional initial status; defaults to 'pending' */
  status?: TaskStatus;
  /** Optional creation timestamp; defaults to current time */
  createdAt?: Date;
  /** Optional update timestamp; defaults to current time */
  updatedAt?: Date;
  /** Optional retry count; defaults to 0 */
  retryCount?: number;
};

/**
 * Result of task execution.
 *
 * @description Complete type definition for task results derived from TaskResultSchema.
 * Contains all data about how a task was executed and what it produced.
 *
 * @example
 * ```typescript
 * const result: TaskResult = {
 *   taskId: task.id,
 *   success: true,
 *   output: { migrated: 1500, failed: 0 },
 *   executedBy: member.id,
 *   delegationChain: [],
 *   iterationsUsed: 2,
 *   tokensUsed: 3200,
 *   duration: 12500,
 *   startedAt: new Date('2024-01-15T10:00:00Z'),
 *   completedAt: new Date('2024-01-15T10:00:12Z'),
 *   reviewHistory: [],
 * };
 * ```
 */
export type TaskResult = z.infer<typeof TaskResultSchema>;

/**
 * Configuration for a crew.
 *
 * @description Complete type definition for crew configuration derived from CrewConfigSchema.
 * Defines how a group of agents work together to accomplish tasks.
 *
 * @example
 * ```typescript
 * const crew: CrewConfig = {
 *   id: '123e4567-e89b-12d3-a456-426614174002',
 *   name: 'Content Creation Crew',
 *   description: 'Creates blog posts and articles',
 *   members: [researcher, writer, reviewer],
 *   tasks: [researchTask, writeTask, reviewTask],
 *   process: 'sequential',
 *   verbose: false,
 *   memory: true,
 *   shareCrewContext: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export type CrewConfig = z.infer<typeof CrewConfigSchema>;

/**
 * Input for creating a new crew.
 *
 * @description Partial type for crew creation where generated fields are optional.
 * The orchestrator will set id and timestamps as needed.
 *
 * @example
 * ```typescript
 * // Create crew with minimal configuration
 * const input: CrewConfigInput = {
 *   name: 'Quick Analysis Crew',
 *   members: [analyst],
 *   process: 'sequential',
 * };
 *
 * const crew = createCrew(input);
 * ```
 */
export type CrewConfigInput = Omit<
  CrewConfig,
  'id' | 'createdAt' | 'updatedAt'
> & {
  /** Optional UUID; auto-generated if not provided */
  id?: string;
  /** Optional creation timestamp; defaults to current time */
  createdAt?: Date;
  /** Optional update timestamp; defaults to current time */
  updatedAt?: Date;
};

/**
 * Result of crew execution.
 *
 * @description Complete type definition for crew results derived from CrewResultSchema.
 * Contains aggregate data about the entire crew execution including all task results.
 *
 * @example
 * ```typescript
 * const crewResult: CrewResult = {
 *   crewId: crew.id,
 *   success: true,
 *   tasks: [taskResult1, taskResult2, taskResult3],
 *   finalOutput: { article: compiledContent },
 *   totalDuration: 180000,
 *   totalIterations: 15,
 *   totalTokensUsed: 25000,
 *   startedAt: new Date('2024-01-15T10:00:00Z'),
 *   completedAt: new Date('2024-01-15T10:03:00Z'),
 *   memberMetrics: {
 *     [researcher.id]: { tasksCompleted: 1, tasksFailed: 0, ... },
 *     [writer.id]: { tasksCompleted: 1, tasksFailed: 0, ... },
 *   },
 *   errors: [],
 * };
 * ```
 */
export type CrewResult = z.infer<typeof CrewResultSchema>;

/**
 * Step callback event data type.
 *
 * @description Type for step-level callback payloads derived from StepCallbackDataSchema.
 * Provides granular event data during crew execution.
 *
 * @example
 * ```typescript
 * const handler = (data: StepCallbackData) => {
 *   console.log(`[${data.type}] ${data.crewId}: ${JSON.stringify(data.data)}`);
 * };
 * ```
 */
export type StepCallbackData = z.infer<typeof StepCallbackDataSchema>;

/**
 * Task callback event data type.
 *
 * @description Type for task-level callback payloads derived from TaskCallbackDataSchema.
 * Provides complete context when tasks complete or fail.
 *
 * @example
 * ```typescript
 * const handler = (data: TaskCallbackData) => {
 *   const { task, result, member } = data;
 *   logTaskCompletion(task.title, result.success, member.name);
 * };
 * ```
 */
export type TaskCallbackData = z.infer<typeof TaskCallbackDataSchema>;

// =============================================================================
// Additional Interfaces
// =============================================================================

/**
 * Delegation request between crew members.
 *
 * @description Represents a formal request from one crew member to delegate a task
 * to another member. Used in workflows where task redistribution is allowed.
 *
 * @example
 * ```typescript
 * const request: DelegationRequest = {
 *   id: crypto.randomUUID(),
 *   fromMemberId: manager.id,
 *   toMemberId: developer.id,
 *   taskId: implementationTask.id,
 *   reason: 'Task requires specialized TypeScript expertise',
 *   context: { urgency: 'high', deadline: '2024-01-20' },
 *   timestamp: new Date(),
 * };
 * ```
 *
 * @property id - Unique identifier for this delegation request
 * @property fromMemberId - UUID of the member initiating the delegation
 * @property toMemberId - UUID of the member receiving the delegation
 * @property taskId - UUID of the task being delegated
 * @property reason - Explanation for why delegation is occurring
 * @property context - Additional context data for the receiving member
 * @property timestamp - When the delegation request was created
 */
export interface DelegationRequest {
  readonly id: string;
  readonly fromMemberId: string;
  readonly toMemberId: string;
  readonly taskId: string;
  readonly reason: string;
  readonly context: Record<string, unknown>;
  readonly timestamp: Date;
}

/**
 * Delegation response from the receiving member.
 *
 * @description Represents the response to a delegation request, indicating whether
 * the receiving member accepts or rejects the delegated task.
 *
 * @example
 * ```typescript
 * // Accepted delegation
 * const acceptedResponse: DelegationResponse = {
 *   requestId: request.id,
 *   accepted: true,
 *   estimatedDuration: 3600000, // 1 hour
 *   timestamp: new Date(),
 * };
 *
 * // Rejected delegation
 * const rejectedResponse: DelegationResponse = {
 *   requestId: request.id,
 *   accepted: false,
 *   reason: 'Currently overloaded with high-priority tasks',
 *   timestamp: new Date(),
 * };
 * ```
 *
 * @property requestId - UUID of the original delegation request
 * @property accepted - Whether the delegation was accepted
 * @property reason - Optional explanation (typically for rejections)
 * @property estimatedDuration - Optional estimated completion time in milliseconds
 * @property timestamp - When the response was created
 */
export interface DelegationResponse {
  readonly requestId: string;
  readonly accepted: boolean;
  readonly reason?: string;
  readonly estimatedDuration?: number;
  readonly timestamp: Date;
}

/**
 * Review request for manager review loop.
 *
 * @description Represents a request for a reviewer (typically a manager) to review
 * the output of a completed task. Used in hierarchical process types.
 *
 * @example
 * ```typescript
 * const reviewRequest: ReviewRequest = {
 *   taskId: implementationTask.id,
 *   taskResult: completedResult,
 *   reviewerId: manager.id,
 *   iteration: 1,
 *   previousFeedback: undefined, // First review
 *   timestamp: new Date(),
 * };
 *
 * // Subsequent review after revision
 * const secondReview: ReviewRequest = {
 *   taskId: implementationTask.id,
 *   taskResult: revisedResult,
 *   reviewerId: manager.id,
 *   iteration: 2,
 *   previousFeedback: ['Add error handling', 'Include unit tests'],
 *   timestamp: new Date(),
 * };
 * ```
 *
 * @property taskId - UUID of the task being reviewed
 * @property taskResult - Complete result of the task execution
 * @property reviewerId - UUID of the member performing the review
 * @property iteration - Current review iteration (1-based)
 * @property previousFeedback - Optional array of feedback from prior reviews
 * @property timestamp - When the review was requested
 */
export interface ReviewRequest {
  readonly taskId: string;
  readonly taskResult: TaskResult;
  readonly reviewerId: string;
  readonly iteration: number;
  readonly previousFeedback?: string[];
  readonly timestamp: Date;
}

/**
 * Review feedback from manager.
 *
 * @description Represents the feedback provided by a reviewer after examining
 * a task's output. Includes the decision and any suggested improvements.
 *
 * @example
 * ```typescript
 * // Approved with feedback
 * const approvedFeedback: ReviewFeedback = {
 *   taskId: task.id,
 *   reviewerId: manager.id,
 *   decision: 'approved',
 *   feedback: 'Excellent implementation with good test coverage',
 *   qualityScore: 95,
 *   timestamp: new Date(),
 * };
 *
 * // Needs revision
 * const revisionFeedback: ReviewFeedback = {
 *   taskId: task.id,
 *   reviewerId: manager.id,
 *   decision: 'needs_revision',
 *   feedback: 'Code works but lacks error handling',
 *   suggestedChanges: [
 *     'Add try-catch blocks around API calls',
 *     'Implement input validation',
 *     'Add logging for debugging',
 *   ],
 *   qualityScore: 65,
 *   timestamp: new Date(),
 * };
 * ```
 *
 * @property taskId - UUID of the reviewed task
 * @property reviewerId - UUID of the reviewer
 * @property decision - Review outcome (approved, needs_revision, rejected, escalate)
 * @property feedback - Detailed textual feedback
 * @property suggestedChanges - Optional array of specific change requests
 * @property qualityScore - Optional numeric quality score (0-100)
 * @property timestamp - When the feedback was provided
 */
export interface ReviewFeedback {
  readonly taskId: string;
  readonly reviewerId: string;
  readonly decision: ReviewDecision;
  readonly feedback: string;
  readonly suggestedChanges?: string[];
  readonly qualityScore?: number;
  readonly timestamp: Date;
}

/**
 * Execution context passed between tasks.
 *
 * @description Contains shared state and history that flows through the crew execution,
 * enabling members to access previous results and collaborate effectively.
 *
 * @example
 * ```typescript
 * const context: ExecutionContext = {
 *   crewId: crew.id,
 *   currentTaskId: currentTask.id,
 *   previousResults: new Map([
 *     [task1.id, result1],
 *     [task2.id, result2],
 *   ]),
 *   sharedMemory: new Map([
 *     ['apiEndpoint', 'https://api.example.com'],
 *     ['authToken', 'bearer-xxx'],
 *   ]),
 *   delegationHistory: [delegation1, delegation2],
 *   reviewHistory: [review1],
 *   startTime: new Date('2024-01-15T10:00:00Z'),
 *   metrics: currentMetrics,
 * };
 *
 * // Access in task executor
 * function executeTask(task: Task, member: CrewMember, ctx: ExecutionContext) {
 *   const previousOutput = ctx.previousResults.get(task.dependencies[0]);
 *   const apiUrl = ctx.sharedMemory.get('apiEndpoint') as string;
 *   // ...
 * }
 * ```
 *
 * @property crewId - UUID of the executing crew
 * @property currentTaskId - UUID of the currently executing task (if any)
 * @property previousResults - Map of completed task results by task ID
 * @property sharedMemory - Map of shared data accessible to all members
 * @property delegationHistory - Chronological list of all delegation requests
 * @property reviewHistory - Chronological list of all review feedback
 * @property startTime - When crew execution began
 * @property metrics - Current execution metrics
 */
export interface ExecutionContext {
  readonly crewId: string;
  readonly currentTaskId?: string;
  readonly previousResults: Map<string, TaskResult>;
  readonly sharedMemory: Map<string, unknown>;
  readonly delegationHistory: DelegationRequest[];
  readonly reviewHistory: ReviewFeedback[];
  readonly startTime: Date;
  readonly metrics: ExecutionMetrics;
}

/**
 * Execution metrics for monitoring.
 *
 * @description Tracks aggregate statistics about crew execution for monitoring,
 * optimization, and reporting purposes. Updated in real-time during execution.
 *
 * @example
 * ```typescript
 * const metrics: ExecutionMetrics = {
 *   tasksStarted: 5,
 *   tasksCompleted: 4,
 *   tasksFailed: 1,
 *   delegationCount: 2,
 *   reviewCount: 3,
 *   totalIterations: 25,
 *   totalTokens: 45000,
 *   averageTaskDuration: 12500, // 12.5 seconds
 * };
 *
 * // Calculate success rate
 * const successRate = metrics.tasksCompleted / metrics.tasksStarted;
 *
 * // Estimate cost (example: $0.01 per 1000 tokens)
 * const estimatedCost = (metrics.totalTokens / 1000) * 0.01;
 * ```
 *
 * @property tasksStarted - Number of tasks that began execution
 * @property tasksCompleted - Number of tasks that completed successfully
 * @property tasksFailed - Number of tasks that failed
 * @property delegationCount - Total number of delegation requests
 * @property reviewCount - Total number of reviews performed
 * @property totalIterations - Sum of iterations across all tasks
 * @property totalTokens - Sum of LLM tokens used
 * @property averageTaskDuration - Mean task execution time in milliseconds
 */
export interface ExecutionMetrics {
  tasksStarted: number;
  tasksCompleted: number;
  tasksFailed: number;
  delegationCount: number;
  reviewCount: number;
  totalIterations: number;
  totalTokens: number;
  averageTaskDuration: number;
}

/**
 * Event types emitted during crew execution.
 *
 * @description Union type of all possible event type strings that can be emitted
 * by the crew orchestrator. Use for type-safe event handling and filtering.
 *
 * @example
 * ```typescript
 * function handleEvent(event: CrewEvent) {
 *   const eventType: CrewEventType = event.type;
 *
 *   switch (eventType) {
 *     case 'crew:started':
 *       logCrewStart(event.crewId);
 *       break;
 *     case 'task:completed':
 *       notifyTaskComplete(event.data.taskId as string);
 *       break;
 *     case 'crew:error':
 *       alertOnError(event.data.error as Error);
 *       break;
 *   }
 * }
 *
 * // Filter for specific event types
 * const taskEvents: CrewEventType[] = [
 *   'task:started',
 *   'task:completed',
 *   'task:failed',
 *   'task:delegated',
 * ];
 * ```
 *
 * Event categories:
 * - Crew lifecycle: crew:started, crew:completed, crew:error
 * - Task lifecycle: task:started, task:completed, task:failed, task:delegated, task:retry_exhausted
 * - Delegation: delegation:requested, delegation:accepted, delegation:rejected
 * - Review: review:requested, review:completed
 * - Member: member:status_changed
 */
export type CrewEventType =
  | 'crew:started'
  | 'crew:completed'
  | 'crew:error'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:delegated'
  | 'task:retry_exhausted'
  | 'delegation:requested'
  | 'delegation:accepted'
  | 'delegation:rejected'
  | 'review:requested'
  | 'review:completed'
  | 'member:status_changed';

/**
 * Event payload structure.
 *
 * @description Represents a single event emitted during crew execution. Events provide
 * real-time visibility into the orchestration process for logging and monitoring.
 *
 * @example
 * ```typescript
 * // Subscribe to crew events
 * crew.on('event', (event: CrewEvent) => {
 *   console.log(`[${event.timestamp.toISOString()}] ${event.type}`);
 *   console.log(`Crew: ${event.crewId}`);
 *   console.log(`Data:`, JSON.stringify(event.data, null, 2));
 * });
 *
 * // Example event
 * const taskCompletedEvent: CrewEvent = {
 *   type: 'task:completed',
 *   crewId: '123e4567-e89b-12d3-a456-426614174000',
 *   timestamp: new Date(),
 *   data: {
 *     taskId: 'abc-123',
 *     memberId: 'def-456',
 *     duration: 15000,
 *     success: true,
 *   },
 * };
 * ```
 *
 * @property type - The type of event (see CrewEventType)
 * @property crewId - UUID of the crew that emitted the event
 * @property timestamp - When the event occurred
 * @property data - Event-specific payload data
 */
export interface CrewEvent {
  readonly type: CrewEventType;
  readonly crewId: string;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

/**
 * Task executor function type.
 *
 * @description Function signature for custom task execution logic. Implementations
 * receive the task, executing member, and context, returning a promise of the result.
 *
 * @example
 * ```typescript
 * // Custom task executor with LLM integration
 * const myExecutor: TaskExecutor = async (task, member, context) => {
 *   const startedAt = new Date();
 *
 *   try {
 *     // Access previous task outputs
 *     const previousOutputs = Array.from(context.previousResults.values())
 *       .filter(r => task.dependencies.includes(r.taskId))
 *       .map(r => r.output);
 *
 *     // Execute the task logic
 *     const output = await llm.complete({
 *       prompt: task.description,
 *       context: previousOutputs,
 *       persona: member.backstory,
 *     });
 *
 *     return {
 *       taskId: task.id,
 *       success: true,
 *       output,
 *       executedBy: member.id,
 *       delegationChain: [],
 *       iterationsUsed: 1,
 *       duration: Date.now() - startedAt.getTime(),
 *       startedAt,
 *       completedAt: new Date(),
 *       reviewHistory: [],
 *     };
 *   } catch (error) {
 *     return {
 *       taskId: task.id,
 *       success: false,
 *       output: null,
 *       error: { code: 'EXECUTION_ERROR', message: String(error) },
 *       executedBy: member.id,
 *       delegationChain: [],
 *       iterationsUsed: 1,
 *       duration: Date.now() - startedAt.getTime(),
 *       startedAt,
 *       completedAt: new Date(),
 *       reviewHistory: [],
 *     };
 *   }
 * };
 * ```
 *
 * @param task - The task to execute
 * @param member - The crew member executing the task
 * @param context - Shared execution context with previous results
 * @returns Promise resolving to the task result
 */
export type TaskExecutor = (
  task: Task,
  member: CrewMember,
  context: ExecutionContext
) => Promise<TaskResult>;

/**
 * Delegation strategy function type.
 *
 * @description Function signature for custom delegation logic. Implementations
 * determine which member (if any) should receive a delegated task.
 *
 * @example
 * ```typescript
 * // Capability-based delegation strategy
 * const capabilityMatcher: DelegationStrategy = async (
 *   task,
 *   fromMember,
 *   availableMembers,
 *   context
 * ) => {
 *   // Extract required capabilities from task context
 *   const requiredCapabilities = task.context?.requiredCapabilities as string[] ?? [];
 *
 *   // Find member with best capability match
 *   let bestMatch: CrewMember | null = null;
 *   let bestScore = 0;
 *
 *   for (const member of availableMembers) {
 *     if (member.id === fromMember.id) continue; // Don't delegate to self
 *     if (member.status !== 'idle') continue; // Only available members
 *
 *     const matchedCapabilities = requiredCapabilities.filter(
 *       cap => member.capabilities.includes(cap)
 *     );
 *     const score = matchedCapabilities.length / requiredCapabilities.length;
 *
 *     if (score > bestScore) {
 *       bestScore = score;
 *       bestMatch = member;
 *     }
 *   }
 *
 *   return bestScore > 0.5 ? bestMatch : null;
 * };
 * ```
 *
 * @param task - The task to be delegated
 * @param fromMember - The member initiating the delegation
 * @param availableMembers - List of potential delegation targets
 * @param context - Shared execution context
 * @returns Promise resolving to the selected member or null if no suitable member found
 */
export type DelegationStrategy = (
  task: Task,
  fromMember: CrewMember,
  availableMembers: CrewMember[],
  context: ExecutionContext
) => Promise<CrewMember | null>;

/**
 * Review strategy function type.
 *
 * @description Function signature for custom review logic. Implementations
 * evaluate task results and provide structured feedback.
 *
 * @example
 * ```typescript
 * // Quality-focused review strategy
 * const qualityReviewer: ReviewStrategy = async (
 *   result,
 *   task,
 *   reviewer,
 *   context
 * ) => {
 *   // Analyze the output quality
 *   const qualityChecks = await runQualityChecks(result.output);
 *
 *   // Calculate quality score
 *   const qualityScore = qualityChecks.passed / qualityChecks.total * 100;
 *
 *   // Determine decision based on score
 *   let decision: ReviewDecision;
 *   if (qualityScore >= 90) {
 *     decision = 'approved';
 *   } else if (qualityScore >= 60) {
 *     decision = 'needs_revision';
 *   } else {
 *     decision = 'rejected';
 *   }
 *
 *   return {
 *     taskId: task.id,
 *     reviewerId: reviewer.id,
 *     decision,
 *     feedback: generateFeedbackSummary(qualityChecks),
 *     suggestedChanges: qualityChecks.failures.map(f => f.suggestion),
 *     qualityScore,
 *     timestamp: new Date(),
 *   };
 * };
 * ```
 *
 * @param result - The task execution result to review
 * @param task - The original task configuration
 * @param reviewer - The crew member performing the review
 * @param context - Shared execution context
 * @returns Promise resolving to structured review feedback
 */
export type ReviewStrategy = (
  result: TaskResult,
  task: Task,
  reviewer: CrewMember,
  context: ExecutionContext
) => Promise<ReviewFeedback>;

/**
 * Error codes for crew orchestration.
 *
 * @description Enumeration of all error codes that can be thrown by the crew
 * orchestrator. Use these codes for error handling and debugging.
 *
 * @example
 * ```typescript
 * try {
 *   await crew.execute();
 * } catch (error) {
 *   if (error instanceof CrewError) {
 *     switch (error.code) {
 *       case CrewErrorCode.TIMEOUT:
 *         console.log('Crew execution timed out');
 *         break;
 *       case CrewErrorCode.CIRCULAR_DEPENDENCY:
 *         console.log('Tasks have circular dependencies');
 *         break;
 *       case CrewErrorCode.NO_AVAILABLE_MEMBER:
 *         console.log('No member available for task');
 *         break;
 *       default:
 *         console.log(`Crew error: ${error.code}`);
 *     }
 *   }
 * }
 * ```
 *
 * @enum {string}
 * @property INVALID_CONFIG - Crew configuration failed validation
 * @property MEMBER_NOT_FOUND - Referenced member does not exist
 * @property TASK_NOT_FOUND - Referenced task does not exist
 * @property TASK_EXECUTION_FAILED - Task execution threw an error
 * @property DELEGATION_FAILED - Delegation could not be completed
 * @property REVIEW_FAILED - Review process failed
 * @property TIMEOUT - Execution exceeded time limit
 * @property MAX_ITERATIONS_EXCEEDED - Task exceeded iteration limit
 * @property DEPENDENCY_NOT_MET - Task dependency not satisfied
 * @property CIRCULAR_DEPENDENCY - Tasks have circular dependencies
 * @property NO_AVAILABLE_MEMBER - No suitable member for task
 * @property CONSENSUS_FAILED - Consensus process did not reach agreement
 */
export enum CrewErrorCode {
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

/**
 * Custom error class for crew orchestration.
 *
 * @description Specialized error class that includes an error code and optional
 * details for debugging. All orchestrator errors are instances of this class.
 *
 * @example
 * ```typescript
 * // Throwing a crew error
 * throw new CrewError(
 *   CrewErrorCode.TASK_EXECUTION_FAILED,
 *   'Task failed after 3 retries',
 *   {
 *     taskId: 'abc-123',
 *     lastError: 'Connection timeout',
 *     retryCount: 3,
 *   }
 * );
 *
 * // Catching and handling crew errors
 * try {
 *   await orchestrator.executeTask(task);
 * } catch (error) {
 *   if (error instanceof CrewError) {
 *     console.error(`[${error.code}] ${error.message}`);
 *     if (error.details) {
 *       console.error('Details:', JSON.stringify(error.details, null, 2));
 *     }
 *
 *     // Handle specific error codes
 *     if (error.code === CrewErrorCode.TIMEOUT) {
 *       await rescheduleTask(error.details?.taskId as string);
 *     }
 *   } else {
 *     throw error; // Re-throw non-crew errors
 *   }
 * }
 * ```
 *
 * @extends Error
 * @property code - The specific error code from CrewErrorCode enum
 * @property details - Optional additional context for debugging
 */
export class CrewError extends Error {
  /**
   * Creates a new CrewError instance.
   *
   * @param code - The error code from CrewErrorCode enum
   * @param message - Human-readable error description
   * @param details - Optional additional context data
   */
  constructor(
    public readonly code: CrewErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CrewError';
  }
}
