/**
 * LangGraph Orchestrator - LangGraph-style cyclic, state-driven workflows
 * @module @wundr.io/langgraph-orchestrator
 *
 * @example
 * ```typescript
 * import {
 *   StateGraph,
 *   createLLMNode,
 *   createToolNode,
 *   createDecisionNode,
 *   MemoryCheckpointer
 * } from '@wundr.io/langgraph-orchestrator';
 *
 * // Create a workflow graph
 * const graph = new StateGraph('my-workflow')
 *   .addNode('agent', createLLMNode({
 *     id: 'agent',
 *     name: 'Agent',
 *     config: { model: 'claude-3-sonnet-20240229' }
 *   }))
 *   .addNode('tools', createToolNode({
 *     id: 'tools',
 *     name: 'Tools'
 *   }))
 *   .addEdge('agent', 'tools')
 *   .addConditionalEdge('tools', 'agent', {
 *     type: 'exists',
 *     field: 'data.pendingToolCalls'
 *   })
 *   .setEntryPoint('agent')
 *   .setCheckpointer(new MemoryCheckpointer());
 *
 * // Execute the workflow
 * const result = await graph.execute({
 *   initialState: {
 *     data: { task: 'Research AI developments' }
 *   }
 * });
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================
// ============================================================================
// Utility Functions
// ============================================================================

// Import for internal use in utility functions
import { createSwitchNode as createSwitchNodeFn } from './nodes/decision-node';
import {
  createLLMNode as createLLMNodeFn,
  createConversationalLLMNode as createConversationalLLMNodeFn,
} from './nodes/llm-node';
import {
  createToolNode as createToolNodeFn,
  createToolRegistry as createToolRegistryFn,
} from './nodes/tool-node';
import { StateGraph as StateGraphClass } from './state-graph';

import type { LLMProvider, Tool } from './types';

export type {
  // State types
  AgentState,
  Message,
  MessageRole,
  ToolCall,
  ToolResult,
  StateHistoryEntry,
  StateChange,
  WorkflowError,
  StateMetadata,

  // Graph configuration
  GraphConfig,
  GraphGlobalConfig,
  RetryConfig,
  LogLevel,

  // Node types
  NodeDefinition,
  NodeType,
  NodeConfig,
  NodeExecutor,
  NodeContext,
  NodeServices,
  NodeResult,
  NodeExecutionMetadata,
  NodeHook,
  Logger,

  // Tool types
  Tool,
  ToolRegistry,

  // LLM types
  LLMProvider,
  LLMRequest,
  LLMResponse,
  TokenUsage,
  FinishReason,
  LLMStreamChunk,

  // Edge types
  EdgeDefinition,
  EdgeType,
  EdgeCondition,
  ConditionType,
  EdgeConditionEvaluator,
  EdgeContext,

  // Checkpoint types
  GraphCheckpointer,
  Checkpoint,
  CheckpointSummary,

  // Execution types
  ExecutionOptions,
  ExecutionHandlers,
  ExecutionResult,
  ExecutionStats,
} from './types';

// Zod schemas
export { MessageSchema, GraphConfigSchema, CheckpointSchema } from './types';

// ============================================================================
// Core Classes
// ============================================================================
export { StateGraph, StateGraphEvents } from './state-graph';

// ============================================================================
// Nodes
// ============================================================================

// LLM Node
export {
  createLLMNode,
  createLLMRouter,
  createStructuredLLMNode,
  createConversationalLLMNode,
  LLMNodeConfig,
  LLMNodeConfigSchema,
} from './nodes/llm-node';

// Tool Node
export {
  createToolNode,
  createToolRegistry,
  createTool,
  createBatchToolNode,
  ToolNodeConfig,
  ToolNodeConfigSchema,
} from './nodes/tool-node';

// Decision Node
export {
  createDecisionNode,
  createSwitchNode,
  createThresholdNode,
  createIfElseNode,
  createMultiConditionNode,
  DecisionNodeConfig,
  DecisionBranch,
  DecisionNodeConfigSchema,
} from './nodes/decision-node';

// Human Node
export {
  createHumanNode,
  createConsoleInputHandler,
  createCallbackInputHandler,
  createConfirmationNode,
  createFeedbackNode,
  HumanNodeConfig,
  HumanInputHandler,
  HumanInputContext,
  HumanChoice,
  HumanResponse,
  HumanNodeConfigSchema,
} from './nodes/human-node';

// ============================================================================
// Edges
// ============================================================================

// Conditional Edge
export {
  ConditionalEdgeBuilder,
  conditionalEdge,
  createRouter,
  conditions,
  EdgeConditionSchema,
  validateCondition,
} from './edges/conditional-edge';

// Loop Edge
export {
  LoopEdgeBuilder,
  loopEdge,
  createForLoop,
  createWhileLoop,
  createDoWhileLoop,
  createRetryLoop,
  createPaginationLoop,
  LoopConfig,
  LoopConfigSchema,
  validateLoopConfig,
} from './edges/loop-edge';

// ============================================================================
// Checkpointing
// ============================================================================
export {
  MemoryCheckpointer,
  FileCheckpointer,
  TimeTravelDebugger,
  createCheckpoint,
  applyRetentionPolicy,
  validateCheckpoint,
  FileSystem,
  StateDiff,
  StateHistoryItem,
  RetentionPolicy,
  CheckpointSchema as CheckpointValidationSchema,
} from './checkpointing';

// ============================================================================
// Prebuilt Graphs
// ============================================================================
export {
  createPlanExecuteRefineGraph,
  createSimpleTaskGraph,
  PlanExecuteState,
  PlanStep,
  StepResult,
  PlanExecuteRefineConfig,
  PlanSchema,
} from './prebuilt-graphs/plan-execute-refine';

/**
 * Create a simple agent workflow
 *
 * @example
 * ```typescript
 * const graph = createAgentWorkflow({
 *   name: 'research-agent',
 *   llmProvider: myProvider,
 *   tools: [searchTool, writeTool],
 *   systemPrompt: 'You are a helpful research assistant.'
 * });
 * ```
 */
export function createAgentWorkflow(options: {
  name: string;
  llmProvider: LLMProvider;
  tools?: Tool[];
  systemPrompt?: string;
  maxIterations?: number;
}): StateGraphClass {
  const graph = new StateGraphClass(options.name, {
    maxIterations: options.maxIterations ?? 50,
  });

  const registry = createToolRegistryFn();
  options.tools?.forEach(tool => registry.register(tool));

  graph.setServices({
    llmProvider: options.llmProvider,
    toolRegistry: registry,
  });

  // Add agent node
  graph.addNode(
    'agent',
    createLLMNodeFn({
      id: 'agent',
      name: 'Agent',
      config: {
        systemPrompt: options.systemPrompt,
        tools: options.tools,
      },
    })
  );

  // Add tool node if tools provided
  if (options.tools?.length) {
    graph.addNode(
      'tools',
      createToolNodeFn({
        id: 'tools',
        name: 'Tool Executor',
        config: {
          tools: options.tools,
          parallel: true,
        },
      })
    );

    // Add edges
    graph.addConditionalEdge('agent', 'tools', {
      type: 'exists',
      field: 'data.pendingToolCalls',
    });
    graph.addEdge('tools', 'agent');
  }

  graph.setEntryPoint('agent');

  return graph;
}

/**
 * Create a chat workflow with conversation history
 *
 * @example
 * ```typescript
 * const chat = createChatWorkflow({
 *   name: 'chat-assistant',
 *   llmProvider: myProvider,
 *   systemPrompt: 'You are a friendly assistant.',
 *   maxHistory: 20
 * });
 * ```
 */
export function createChatWorkflow(options: {
  name: string;
  llmProvider: LLMProvider;
  systemPrompt?: string;
  maxHistory?: number;
}): StateGraphClass {
  const graph = new StateGraphClass(options.name);

  graph.setServices({
    llmProvider: options.llmProvider,
  });

  graph.addNode(
    'chat',
    createConversationalLLMNodeFn({
      id: 'chat',
      name: 'Chat',
      config: {
        systemPrompt: options.systemPrompt,
      },
      maxHistoryLength: options.maxHistory ?? 50,
    })
  );

  graph.setEntryPoint('chat');

  return graph;
}

/**
 * Create a decision tree workflow
 *
 * @example
 * ```typescript
 * const tree = createDecisionTree({
 *   name: 'support-router',
 *   decisions: [
 *     {
 *       field: 'data.category',
 *       branches: {
 *         'billing': 'billing-handler',
 *         'technical': 'tech-handler',
 *         'general': 'general-handler'
 *       },
 *       default: 'general-handler'
 *     }
 *   ]
 * });
 * ```
 */
export function createDecisionTree(options: {
  name: string;
  decisions: Array<{
    id?: string;
    field: string;
    branches: Record<string, string>;
    default?: string;
  }>;
}): StateGraphClass {
  const graph = new StateGraphClass(options.name);

  options.decisions.forEach((decision, index) => {
    const nodeId = decision.id ?? `decision-${index}`;
    graph.addNode(
      nodeId,
      createSwitchNodeFn({
        id: nodeId,
        name: nodeId,
        field: decision.field,
        cases: decision.branches,
        default: decision.default,
      })
    );
  });

  if (options.decisions.length > 0) {
    const firstDecision = options.decisions[0];
    if (firstDecision) {
      graph.setEntryPoint(firstDecision.id ?? 'decision-0');
    }
  }

  return graph;
}

// ============================================================================
// Version
// ============================================================================
export const VERSION = '1.0.3';
