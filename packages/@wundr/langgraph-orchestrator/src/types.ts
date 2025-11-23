/**
 * Type definitions for LangGraph-style workflow orchestration
 * @module @wundr.io/langgraph-orchestrator
 */

import { z } from 'zod';

// ============================================================================
// Core State Types
// ============================================================================

/**
 * Generic agent state that can be extended for specific workflows
 */
export interface AgentState {
  /** Unique identifier for this state instance */
  readonly id: string;
  /** Current messages in the conversation/workflow */
  readonly messages: Message[];
  /** Arbitrary key-value data store */
  readonly data: Record<string, unknown>;
  /** Current step in the workflow */
  readonly currentStep: string;
  /** Previous steps for backtracking */
  readonly history: StateHistoryEntry[];
  /** Error information if workflow failed */
  readonly error?: WorkflowError;
  /** Timestamp of state creation */
  readonly createdAt: Date;
  /** Timestamp of last state update */
  readonly updatedAt: Date;
  /** Metadata for tracking and debugging */
  readonly metadata: StateMetadata;
}

/**
 * Message in the agent conversation
 */
export interface Message {
  /** Unique message identifier */
  readonly id: string;
  /** Role of the message sender */
  readonly role: MessageRole;
  /** Content of the message */
  readonly content: string;
  /** Tool calls if any */
  readonly toolCalls?: ToolCall[];
  /** Tool response if this is a tool result */
  readonly toolResult?: ToolResult;
  /** Timestamp of message creation */
  readonly timestamp: Date;
  /** Additional message metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Role of a message sender
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Tool call request from LLM
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  readonly id: string;
  /** Name of the tool to call */
  readonly name: string;
  /** Arguments to pass to the tool */
  readonly arguments: Record<string, unknown>;
}

/**
 * Result from a tool execution
 */
export interface ToolResult {
  /** ID of the tool call this is responding to */
  readonly toolCallId: string;
  /** Result content */
  readonly content: string;
  /** Whether the tool execution was successful */
  readonly success: boolean;
  /** Error message if failed */
  readonly error?: string;
}

/**
 * Entry in state history for time-travel debugging
 */
export interface StateHistoryEntry {
  /** Step name that produced this state */
  readonly step: string;
  /** Timestamp when this state was created */
  readonly timestamp: Date;
  /** Snapshot of the state at this point */
  readonly snapshot: Partial<AgentState>;
  /** Changes made in this step */
  readonly changes: StateChange[];
}

/**
 * Individual state change record
 */
export interface StateChange {
  /** Path to the changed property */
  readonly path: string;
  /** Previous value */
  readonly previousValue: unknown;
  /** New value */
  readonly newValue: unknown;
}

/**
 * Error information for failed workflows
 */
export interface WorkflowError {
  /** Error code */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Stack trace if available */
  readonly stack?: string;
  /** Node where error occurred */
  readonly node?: string;
  /** Whether the error is recoverable */
  readonly recoverable: boolean;
  /** Suggested recovery actions */
  readonly recoveryHints?: string[];
}

/**
 * Metadata for state tracking
 */
export interface StateMetadata {
  /** Session ID for cross-session tracking */
  readonly sessionId: string;
  /** User ID if applicable */
  readonly userId?: string;
  /** Workflow execution ID */
  readonly executionId: string;
  /** Total number of steps executed */
  readonly stepCount: number;
  /** Total tokens consumed (if LLM involved) */
  readonly tokensUsed?: number;
  /** Custom tags for filtering */
  readonly tags: string[];
}

// ============================================================================
// Graph Configuration Types
// ============================================================================

/**
 * Configuration for a workflow graph
 */
export interface GraphConfig {
  /** Unique identifier for the graph */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of what this graph does */
  readonly description?: string;
  /** Entry point node name */
  readonly entryPoint: string;
  /** Node definitions */
  readonly nodes: Map<string, NodeDefinition>;
  /** Edge definitions */
  readonly edges: Map<string, EdgeDefinition[]>;
  /** Global graph configuration */
  readonly config: GraphGlobalConfig;
}

/**
 * Global configuration options for graph execution
 */
export interface GraphGlobalConfig {
  /** Maximum number of iterations (cycle protection) */
  readonly maxIterations: number;
  /** Timeout in milliseconds */
  readonly timeout: number;
  /** Whether to enable checkpointing */
  readonly checkpointEnabled: boolean;
  /** Checkpoint interval (every N steps) */
  readonly checkpointInterval: number;
  /** Whether to enable parallel execution where possible */
  readonly parallelExecution: boolean;
  /** Retry configuration */
  readonly retry: RetryConfig;
  /** Logging level */
  readonly logLevel: LogLevel;
}

/**
 * Retry configuration for failed nodes
 */
export interface RetryConfig {
  /** Maximum number of retries */
  readonly maxRetries: number;
  /** Initial delay in milliseconds */
  readonly initialDelay: number;
  /** Backoff multiplier */
  readonly backoffMultiplier: number;
  /** Maximum delay in milliseconds */
  readonly maxDelay: number;
  /** Error codes that should trigger retry */
  readonly retryableErrors: string[];
}

/**
 * Logging level for graph execution
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

// ============================================================================
// Node Types
// ============================================================================

/**
 * Definition of a node in the workflow graph
 */
export interface NodeDefinition<TState extends AgentState = AgentState> {
  /** Unique identifier for this node */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Node type */
  readonly type: NodeType;
  /** Node-specific configuration */
  readonly config: NodeConfig;
  /** The function to execute for this node */
  readonly execute: NodeExecutor<TState>;
  /** Pre-execution hooks */
  readonly preHooks?: NodeHook<TState>[];
  /** Post-execution hooks */
  readonly postHooks?: NodeHook<TState>[];
  /** Validation schema for node output */
  readonly outputSchema?: z.ZodSchema;
}

/**
 * Types of nodes in the workflow
 */
export type NodeType =
  | 'llm' // LLM-based decision/generation
  | 'tool' // Tool execution
  | 'decision' // Conditional branching
  | 'human' // Human-in-the-loop
  | 'aggregate' // Combine multiple inputs
  | 'transform' // State transformation
  | 'start' // Entry point
  | 'end'; // Exit point

/**
 * Node configuration options
 */
export interface NodeConfig {
  /** Whether this node can run in parallel with others */
  readonly parallel?: boolean;
  /** Timeout for this specific node */
  readonly timeout?: number;
  /** Retry configuration override */
  readonly retry?: Partial<RetryConfig>;
  /** Custom metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Function signature for node execution
 */
export type NodeExecutor<TState extends AgentState = AgentState> = (
  state: TState,
  context: NodeContext
) => Promise<NodeResult<TState>>;

/**
 * Context provided to node executors
 */
export interface NodeContext {
  /** Node definition */
  readonly node: NodeDefinition;
  /** Graph configuration */
  readonly graph: GraphConfig;
  /** Execution ID */
  readonly executionId: string;
  /** Current iteration count */
  readonly iterationCount: number;
  /** Shared services */
  readonly services: NodeServices;
  /** Abort signal for cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Services available to nodes
 */
export interface NodeServices {
  /** Logger instance */
  readonly logger: Logger;
  /** Checkpointing service */
  readonly checkpointer?: GraphCheckpointer;
  /** Tool registry */
  readonly toolRegistry?: ToolRegistry;
  /** LLM provider */
  readonly llmProvider?: LLMProvider;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  get(name: string): Tool | undefined;
  list(): Tool[];
  register(tool: Tool): void;
  unregister(name: string): void;
}

/**
 * Tool definition
 */
export interface Tool {
  /** Unique tool name */
  readonly name: string;
  /** Tool description for LLM */
  readonly description: string;
  /** Input schema */
  readonly inputSchema: z.ZodSchema;
  /** Output schema */
  readonly outputSchema?: z.ZodSchema;
  /** Tool execution function */
  execute(input: unknown): Promise<unknown>;
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  /** Generate a response */
  generate(request: LLMRequest): Promise<LLMResponse>;
  /** Stream a response */
  stream?(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
}

/**
 * LLM request
 */
export interface LLMRequest {
  /** Messages to send */
  readonly messages: Message[];
  /** Model to use */
  readonly model?: string;
  /** Temperature */
  readonly temperature?: number;
  /** Maximum tokens */
  readonly maxTokens?: number;
  /** Available tools */
  readonly tools?: Tool[];
  /** Stop sequences */
  readonly stop?: string[];
}

/**
 * LLM response
 */
export interface LLMResponse {
  /** Generated message */
  readonly message: Message;
  /** Token usage */
  readonly usage: TokenUsage;
  /** Model used */
  readonly model: string;
  /** Finish reason */
  readonly finishReason: FinishReason;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Prompt tokens */
  readonly promptTokens: number;
  /** Completion tokens */
  readonly completionTokens: number;
  /** Total tokens */
  readonly totalTokens: number;
}

/**
 * Reason for LLM completion
 */
export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error';

/**
 * Streaming chunk from LLM
 */
export interface LLMStreamChunk {
  /** Delta content */
  readonly delta: string;
  /** Whether this is the final chunk */
  readonly done: boolean;
  /** Finish reason if done */
  readonly finishReason?: FinishReason;
}

/**
 * Result from node execution
 */
export interface NodeResult<TState extends AgentState = AgentState> {
  /** Updated state */
  readonly state: TState;
  /** Next node(s) to execute */
  readonly next?: string | string[];
  /** Whether to terminate the workflow */
  readonly terminate?: boolean;
  /** Execution metadata */
  readonly metadata?: NodeExecutionMetadata;
}

/**
 * Metadata from node execution
 */
export interface NodeExecutionMetadata {
  /** Duration in milliseconds */
  readonly duration: number;
  /** Tokens used if LLM node */
  readonly tokensUsed?: number;
  /** Tool calls made */
  readonly toolCalls?: ToolCall[];
  /** Retry count if retried */
  readonly retryCount?: number;
}

/**
 * Hook function signature
 */
export type NodeHook<TState extends AgentState = AgentState> = (
  state: TState,
  context: NodeContext
) => Promise<TState>;

// ============================================================================
// Edge Types
// ============================================================================

/**
 * Definition of an edge in the workflow graph
 */
export interface EdgeDefinition {
  /** Source node */
  readonly from: string;
  /** Target node */
  readonly to: string;
  /** Edge type */
  readonly type: EdgeType;
  /** Condition for conditional edges */
  readonly condition?: EdgeCondition;
  /** Edge metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Types of edges
 */
export type EdgeType =
  | 'direct' // Always follow this edge
  | 'conditional' // Follow based on condition
  | 'loop' // Loop back to a previous node
  | 'parallel'; // Branch to multiple nodes

/**
 * Condition for edge traversal
 */
export interface EdgeCondition {
  /** Condition type */
  readonly type: ConditionType;
  /** Field to check in state */
  readonly field?: string;
  /** Value to compare against */
  readonly value?: unknown;
  /** Custom condition function */
  readonly evaluate?: EdgeConditionEvaluator;
}

/**
 * Types of conditions
 */
export type ConditionType =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'not_exists'
  | 'custom';

/**
 * Custom condition evaluator
 */
export type EdgeConditionEvaluator<TState extends AgentState = AgentState> = (
  state: TState,
  context: EdgeContext
) => Promise<boolean>;

/**
 * Context provided to edge evaluators
 */
export interface EdgeContext {
  /** Edge definition */
  readonly edge: EdgeDefinition;
  /** Source node result */
  readonly sourceResult: NodeResult;
  /** Graph configuration */
  readonly graph: GraphConfig;
}

// ============================================================================
// Checkpointing Types
// ============================================================================

/**
 * Interface for checkpoint persistence
 */
export interface GraphCheckpointer {
  /** Save a checkpoint */
  save(checkpoint: Checkpoint): Promise<void>;
  /** Load a checkpoint by ID */
  load(checkpointId: string): Promise<Checkpoint | null>;
  /** List checkpoints for an execution */
  list(executionId: string): Promise<CheckpointSummary[]>;
  /** Delete a checkpoint */
  delete(checkpointId: string): Promise<void>;
  /** Get the latest checkpoint for an execution */
  getLatest(executionId: string): Promise<Checkpoint | null>;
}

/**
 * Checkpoint data structure
 */
export interface Checkpoint {
  /** Unique checkpoint identifier */
  readonly id: string;
  /** Execution ID this checkpoint belongs to */
  readonly executionId: string;
  /** Step number */
  readonly stepNumber: number;
  /** Node that created this checkpoint */
  readonly nodeName: string;
  /** Full state snapshot */
  readonly state: AgentState;
  /** Timestamp of checkpoint creation */
  readonly timestamp: Date;
  /** Parent checkpoint ID for branching */
  readonly parentId?: string;
  /** Custom metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Summary of a checkpoint for listing
 */
export interface CheckpointSummary {
  /** Checkpoint ID */
  readonly id: string;
  /** Execution ID */
  readonly executionId: string;
  /** Step number */
  readonly stepNumber: number;
  /** Node name */
  readonly nodeName: string;
  /** Timestamp */
  readonly timestamp: Date;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Options for graph execution
 */
export interface ExecutionOptions {
  /** Initial state */
  readonly initialState?: Partial<AgentState>;
  /** Checkpoint ID to resume from */
  readonly resumeFrom?: string;
  /** Override graph config */
  readonly configOverrides?: Partial<GraphGlobalConfig>;
  /** Abort signal */
  readonly signal?: AbortSignal;
  /** Event handlers */
  readonly handlers?: ExecutionHandlers;
}

/**
 * Event handlers for execution lifecycle
 */
export interface ExecutionHandlers {
  /** Called when execution starts */
  onStart?: (state: AgentState) => void;
  /** Called when entering a node */
  onNodeEnter?: (nodeName: string, state: AgentState) => void;
  /** Called when exiting a node */
  onNodeExit?: (nodeName: string, result: NodeResult) => void;
  /** Called on checkpoint creation */
  onCheckpoint?: (checkpoint: Checkpoint) => void;
  /** Called on error */
  onError?: (error: WorkflowError) => void;
  /** Called when execution completes */
  onComplete?: (state: AgentState) => void;
}

/**
 * Result of graph execution
 */
export interface ExecutionResult {
  /** Final state */
  readonly state: AgentState;
  /** Whether execution was successful */
  readonly success: boolean;
  /** Error if failed */
  readonly error?: WorkflowError;
  /** Execution statistics */
  readonly stats: ExecutionStats;
  /** Path through the graph */
  readonly path: string[];
}

/**
 * Statistics from graph execution
 */
export interface ExecutionStats {
  /** Total execution time in milliseconds */
  readonly duration: number;
  /** Number of nodes executed */
  readonly nodesExecuted: number;
  /** Number of iterations */
  readonly iterations: number;
  /** Total tokens used */
  readonly tokensUsed: number;
  /** Checkpoints created */
  readonly checkpointsCreated: number;
  /** Retries performed */
  readonly retries: number;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for validating message structure
 */
export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        arguments: z.record(z.unknown()),
      })
    )
    .optional(),
  toolResult: z
    .object({
      toolCallId: z.string(),
      content: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    })
    .optional(),
  timestamp: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for validating graph configuration
 */
export const GraphConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  entryPoint: z.string(),
  config: z.object({
    maxIterations: z.number().min(1).max(10000),
    timeout: z.number().min(0),
    checkpointEnabled: z.boolean(),
    checkpointInterval: z.number().min(1),
    parallelExecution: z.boolean(),
    retry: z.object({
      maxRetries: z.number().min(0),
      initialDelay: z.number().min(0),
      backoffMultiplier: z.number().min(1),
      maxDelay: z.number().min(0),
      retryableErrors: z.array(z.string()),
    }),
    logLevel: z.enum(['debug', 'info', 'warn', 'error', 'silent']),
  }),
});

/**
 * Schema for validating checkpoint data
 */
export const CheckpointSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  stepNumber: z.number(),
  nodeName: z.string(),
  timestamp: z.date(),
  parentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
