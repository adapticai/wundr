/**
 * Decision Node - Conditional branching node for workflow control flow
 * @module @wundr.io/langgraph-orchestrator
 */

import { z } from 'zod';

import type {
  AgentState,
  NodeDefinition,
  NodeContext,
  NodeResult,
  EdgeCondition,
  ConditionType,
} from '../types';

/**
 * Configuration for decision node
 */
export interface DecisionNodeConfig {
  /** Decision branches */
  readonly branches: DecisionBranch[];
  /** Default branch if no conditions match */
  readonly defaultBranch?: string;
  /** Whether to throw error if no branch matches and no default */
  readonly throwOnNoMatch?: boolean;
  /** Custom decision function */
  readonly decide?: (state: AgentState) => string | Promise<string>;
}

/**
 * Decision branch definition
 */
export interface DecisionBranch {
  /** Name/ID of this branch */
  readonly name: string;
  /** Target node for this branch */
  readonly target: string;
  /** Condition for taking this branch */
  readonly condition: EdgeCondition;
  /** Priority (higher = checked first) */
  readonly priority?: number;
}

/**
 * Schema for decision node configuration validation
 */
export const DecisionNodeConfigSchema = z.object({
  branches: z.array(
    z.object({
      name: z.string(),
      target: z.string(),
      condition: z.object({
        type: z.enum([
          'equals',
          'not_equals',
          'contains',
          'greater_than',
          'less_than',
          'exists',
          'not_exists',
          'custom',
        ]),
        field: z.string().optional(),
        value: z.unknown().optional(),
      }),
      priority: z.number().optional(),
    })
  ),
  defaultBranch: z.string().optional(),
  throwOnNoMatch: z.boolean().optional(),
});

/**
 * Create a decision node for conditional branching
 *
 * @example
 * ```typescript
 * const decisionNode = createDecisionNode({
 *   id: 'router',
 *   name: 'Task Router',
 *   config: {
 *     branches: [
 *       {
 *         name: 'search',
 *         target: 'search-node',
 *         condition: { type: 'equals', field: 'data.action', value: 'search' }
 *       },
 *       {
 *         name: 'answer',
 *         target: 'answer-node',
 *         condition: { type: 'equals', field: 'data.action', value: 'answer' }
 *       }
 *     ],
 *     defaultBranch: 'fallback-node'
 *   }
 * });
 *
 * graph.addNode('router', decisionNode);
 * ```
 *
 * @param options - Node creation options
 * @returns NodeDefinition for use in StateGraph
 */
export function createDecisionNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  config: DecisionNodeConfig;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const { id, name, config, nodeConfig = {} } = options;

  return {
    id,
    name,
    type: 'decision',
    config: nodeConfig,
    execute: async (
      state: TState,
      context: NodeContext
    ): Promise<NodeResult<TState>> => {
      context.services.logger.debug('Evaluating decision branches', {
        branchCount: config.branches.length,
      });

      // If custom decision function provided, use it
      if (config.decide) {
        const target = await config.decide(state);
        context.services.logger.debug('Custom decision made', { target });
        return {
          state,
          next: target,
        };
      }

      // Sort branches by priority
      const sortedBranches = [...config.branches].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      );

      // Evaluate branches in order
      for (const branch of sortedBranches) {
        const matches = await evaluateCondition(branch.condition, state);

        if (matches) {
          context.services.logger.debug('Branch matched', {
            branch: branch.name,
            target: branch.target,
          });
          return {
            state,
            next: branch.target,
          };
        }
      }

      // No branch matched
      if (config.defaultBranch) {
        context.services.logger.debug('Using default branch', {
          target: config.defaultBranch,
        });
        return {
          state,
          next: config.defaultBranch,
        };
      }

      if (config.throwOnNoMatch) {
        throw new Error('No decision branch matched and no default configured');
      }

      context.services.logger.warn(
        'No decision branch matched, workflow may terminate'
      );
      return { state };
    },
  };
}

/**
 * Evaluate a condition against state
 */
async function evaluateCondition(
  condition: EdgeCondition,
  state: AgentState
): Promise<boolean> {
  const fieldValue = condition.field
    ? getFieldValue(state, condition.field)
    : undefined;

  switch (condition.type) {
    case 'equals':
      return fieldValue === condition.value;

    case 'not_equals':
      return fieldValue !== condition.value;

    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value);
      }
      if (typeof fieldValue === 'string') {
        return fieldValue.includes(String(condition.value));
      }
      return false;

    case 'greater_than':
      return (
        typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue > condition.value
      );

    case 'less_than':
      return (
        typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue < condition.value
      );

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;

    case 'custom':
      if (condition.evaluate) {
        return await condition.evaluate(state, {
          edge: { from: '', to: '', type: 'conditional', condition },
          sourceResult: { state },
          graph: {
            id: '',
            name: '',
            entryPoint: '',
            nodes: new Map(),
            edges: new Map(),
            config: {
              maxIterations: 100,
              timeout: 300000,
              checkpointEnabled: false,
              checkpointInterval: 1,
              parallelExecution: false,
              retry: {
                maxRetries: 0,
                initialDelay: 0,
                backoffMultiplier: 1,
                maxDelay: 0,
                retryableErrors: [],
              },
              logLevel: 'silent',
            },
          },
        });
      }
      return false;

    default:
      return false;
  }
}

/**
 * Get a nested field value from state
 */
function getFieldValue(state: AgentState, field: string): unknown {
  const parts = field.split('.');
  let current: unknown = state;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Create a switch-case style decision node
 *
 * @example
 * ```typescript
 * const switchNode = createSwitchNode({
 *   id: 'type-switch',
 *   name: 'Type Switch',
 *   field: 'data.messageType',
 *   cases: {
 *     'question': 'question-handler',
 *     'command': 'command-handler',
 *     'feedback': 'feedback-handler'
 *   },
 *   default: 'unknown-handler'
 * });
 * ```
 *
 * @param options - Switch node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createSwitchNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  field: string;
  cases: Record<string, string>;
  default?: string;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const branches: DecisionBranch[] = Object.entries(options.cases).map(
    ([value, target]) => ({
      name: `case-${value}`,
      target,
      condition: {
        type: 'equals' as ConditionType,
        field: options.field,
        value,
      },
    })
  );

  return createDecisionNode<TState>({
    id: options.id,
    name: options.name,
    config: {
      branches,
      defaultBranch: options.default,
      throwOnNoMatch: !options.default,
    },
    nodeConfig: options.nodeConfig,
  });
}

/**
 * Create a threshold-based decision node
 *
 * @example
 * ```typescript
 * const confidenceRouter = createThresholdNode({
 *   id: 'confidence-router',
 *   name: 'Confidence Router',
 *   field: 'data.confidence',
 *   thresholds: [
 *     { value: 0.9, target: 'high-confidence' },
 *     { value: 0.7, target: 'medium-confidence' },
 *     { value: 0.5, target: 'low-confidence' }
 *   ],
 *   default: 'very-low-confidence'
 * });
 * ```
 *
 * @param options - Threshold node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createThresholdNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  field: string;
  thresholds: Array<{ value: number; target: string }>;
  default?: string;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  // Sort thresholds in descending order
  const sortedThresholds = [...options.thresholds].sort(
    (a, b) => b.value - a.value
  );

  const branches: DecisionBranch[] = sortedThresholds.map(
    (threshold, index) => ({
      name: `threshold-${threshold.value}`,
      target: threshold.target,
      condition: {
        type: 'custom' as ConditionType,
        evaluate: async (state: AgentState) => {
          const value = getFieldValue(state, options.field);
          if (typeof value !== 'number') {
            return false;
          }

          // Check if value is >= this threshold but < the next higher threshold
          const isAboveThreshold = value >= threshold.value;
          const nextHigherThreshold = sortedThresholds[index - 1];
          const isBelowNextThreshold =
            !nextHigherThreshold || value < nextHigherThreshold.value;

          return isAboveThreshold && isBelowNextThreshold;
        },
      },
      priority: sortedThresholds.length - index,
    })
  );

  return createDecisionNode<TState>({
    id: options.id,
    name: options.name,
    config: {
      branches,
      defaultBranch: options.default,
      throwOnNoMatch: !options.default,
    },
    nodeConfig: options.nodeConfig,
  });
}

/**
 * Create a boolean decision node (if-else)
 *
 * @example
 * ```typescript
 * const ifElseNode = createIfElseNode({
 *   id: 'has-error',
 *   name: 'Error Check',
 *   condition: {
 *     type: 'exists',
 *     field: 'error'
 *   },
 *   ifTrue: 'error-handler',
 *   ifFalse: 'success-handler'
 * });
 * ```
 *
 * @param options - If-else node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createIfElseNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  condition: EdgeCondition;
  ifTrue: string;
  ifFalse: string;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  return createDecisionNode<TState>({
    id: options.id,
    name: options.name,
    config: {
      branches: [
        {
          name: 'if-true',
          target: options.ifTrue,
          condition: options.condition,
          priority: 1,
        },
      ],
      defaultBranch: options.ifFalse,
    },
    nodeConfig: options.nodeConfig,
  });
}

/**
 * Create a multi-condition decision node (AND/OR logic)
 *
 * @example
 * ```typescript
 * const multiConditionNode = createMultiConditionNode({
 *   id: 'complex-router',
 *   name: 'Complex Router',
 *   branches: [
 *     {
 *       name: 'premium-user',
 *       target: 'premium-flow',
 *       conditions: [
 *         { type: 'equals', field: 'data.userType', value: 'premium' },
 *         { type: 'greater_than', field: 'data.credits', value: 0 }
 *       ],
 *       logic: 'AND'
 *     },
 *     {
 *       name: 'needs-upgrade',
 *       target: 'upgrade-flow',
 *       conditions: [
 *         { type: 'equals', field: 'data.userType', value: 'free' },
 *         { type: 'less_than', field: 'data.credits', value: 1 }
 *       ],
 *       logic: 'OR'
 *     }
 *   ],
 *   default: 'standard-flow'
 * });
 * ```
 *
 * @param options - Multi-condition node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createMultiConditionNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  branches: Array<{
    name: string;
    target: string;
    conditions: EdgeCondition[];
    logic: 'AND' | 'OR';
    priority?: number;
  }>;
  default?: string;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const branches: DecisionBranch[] = options.branches.map(branch => ({
    name: branch.name,
    target: branch.target,
    priority: branch.priority,
    condition: {
      type: 'custom' as ConditionType,
      evaluate: async (state: AgentState) => {
        const results = await Promise.all(
          branch.conditions.map(cond => evaluateCondition(cond, state))
        );

        if (branch.logic === 'AND') {
          return results.every(r => r);
        } else {
          return results.some(r => r);
        }
      },
    },
  }));

  return createDecisionNode<TState>({
    id: options.id,
    name: options.name,
    config: {
      branches,
      defaultBranch: options.default,
      throwOnNoMatch: !options.default,
    },
    nodeConfig: options.nodeConfig,
  });
}
