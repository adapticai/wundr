/**
 * Loop Edge - Cyclic edges for iterative workflows
 * @module @wundr.io/langgraph-orchestrator
 */

import { z } from 'zod';

import type {
  AgentState,
  EdgeDefinition,
  EdgeCondition,
  EdgeConditionEvaluator,
  EdgeContext,
} from '../types';

/**
 * Configuration for loop behavior
 */
export interface LoopConfig {
  /** Maximum number of iterations */
  readonly maxIterations?: number;
  /** Counter field in state.data */
  readonly counterField?: string;
  /** Condition to continue looping */
  readonly condition: EdgeCondition;
  /** What to do when max iterations reached */
  readonly onMaxIterations?: 'error' | 'exit' | 'force-exit';
  /** Exit node when loop completes */
  readonly exitNode?: string;
}

/**
 * Builder for loop edges with fluent API
 */
export class LoopEdgeBuilder<TState extends AgentState = AgentState> {
  private readonly from: string;
  private readonly to: string;
  private maxIterations: number = 100;
  private counterField: string = '__loopCounter';
  private condition?: EdgeCondition;
  private exitNode?: string;
  private onMaxIterations: 'error' | 'exit' | 'force-exit' = 'exit';

  /**
   * Create a new loop edge builder
   * @param from - Source node name
   * @param to - Target node name (can be same as from for self-loop)
   */
  constructor(from: string, to?: string) {
    this.from = from;
    this.to = to ?? from; // Default to self-loop
  }

  /**
   * Set maximum iterations
   * @param max - Maximum number of loop iterations
   * @returns this for chaining
   */
  maxIter(max: number): this {
    this.maxIterations = max;
    return this;
  }

  /**
   * Set the counter field name in state
   * @param field - Field name for storing iteration count
   * @returns this for chaining
   */
  counter(field: string): this {
    this.counterField = field;
    return this;
  }

  /**
   * Set condition to continue looping
   * @param condition - Condition that must be true to continue
   * @returns this for chaining
   */
  while(condition: EdgeCondition): this {
    this.condition = condition;
    return this;
  }

  /**
   * Continue while field equals value
   * @param field - Field to check
   * @param value - Expected value
   * @returns this for chaining
   */
  whileEquals(field: string, value: unknown): this {
    return this.while({ type: 'equals', field, value });
  }

  /**
   * Continue while field is less than value
   * @param field - Field to check
   * @param value - Maximum value
   * @returns this for chaining
   */
  whileLessThan(field: string, value: number): this {
    return this.while({ type: 'less_than', field, value });
  }

  /**
   * Continue while custom condition is true
   * @param evaluate - Custom evaluator function
   * @returns this for chaining
   */
  whileCustom(evaluate: EdgeConditionEvaluator<TState>): this {
    return this.while({
      type: 'custom',
      evaluate: evaluate as EdgeConditionEvaluator,
    });
  }

  /**
   * Set the exit node when loop completes
   * @param node - Node to transition to after loop
   * @returns this for chaining
   */
  exitTo(node: string): this {
    this.exitNode = node;
    return this;
  }

  /**
   * Set behavior when max iterations reached
   * @param behavior - What to do on max iterations
   * @returns this for chaining
   */
  onMax(behavior: 'error' | 'exit' | 'force-exit'): this {
    this.onMaxIterations = behavior;
    return this;
  }

  /**
   * Build the loop edge configuration
   * @returns LoopConfig object
   */
  build(): LoopConfig {
    if (!this.condition) {
      throw new Error(
        'Loop condition is required. Call while() before build()'
      );
    }

    return {
      maxIterations: this.maxIterations,
      counterField: this.counterField,
      condition: this.condition,
      onMaxIterations: this.onMaxIterations,
      exitNode: this.exitNode,
    };
  }

  /**
   * Build as EdgeDefinition
   * @returns EdgeDefinition for the loop
   */
  buildEdge(): EdgeDefinition {
    if (!this.condition) {
      throw new Error(
        'Loop condition is required. Call while() before buildEdge()'
      );
    }

    return {
      from: this.from,
      to: this.to,
      type: 'loop',
      condition: this.createLoopCondition(),
      metadata: {
        maxIterations: this.maxIterations,
        counterField: this.counterField,
        onMaxIterations: this.onMaxIterations,
        exitNode: this.exitNode,
      },
    };
  }

  /**
   * Create the composite loop condition
   */
  private createLoopCondition(): EdgeCondition {
    const originalCondition = this.condition!;
    const maxIterations = this.maxIterations;
    const counterField = this.counterField;
    const onMaxIterations = this.onMaxIterations;

    return {
      type: 'custom',
      evaluate: async (state: AgentState, context: EdgeContext) => {
        // Get current iteration count
        const currentCount = (state.data[counterField] as number) ?? 0;

        // Check max iterations
        if (currentCount >= maxIterations) {
          if (onMaxIterations === 'error') {
            throw new Error(
              `Loop exceeded maximum iterations (${maxIterations})`
            );
          }
          return false; // Exit loop
        }

        // Evaluate the actual condition
        return await evaluateCondition(originalCondition, state, context);
      },
    };
  }
}

/**
 * Create a loop edge builder
 *
 * @example
 * ```typescript
 * const loopEdge = loopEdge('process')
 *   .maxIter(10)
 *   .whileLessThan('data.retryCount', 3)
 *   .exitTo('success')
 *   .onMax('exit')
 *   .buildEdge();
 *
 * graph.addLoopEdge(loopEdge.from, loopEdge.to, loopEdge.condition!);
 * ```
 *
 * @param from - Source node name
 * @param to - Optional target node (defaults to from for self-loop)
 * @returns LoopEdgeBuilder
 */
export function loopEdge<TState extends AgentState = AgentState>(
  from: string,
  to?: string
): LoopEdgeBuilder<TState> {
  return new LoopEdgeBuilder<TState>(from, to);
}

/**
 * Create a for-loop style edge
 *
 * @example
 * ```typescript
 * const forLoop = createForLoop({
 *   from: 'process-item',
 *   iterations: 5,
 *   counterField: 'data.itemIndex',
 *   exitNode: 'complete'
 * });
 * ```
 *
 * @param options - For loop configuration
 * @returns EdgeDefinition for the loop
 */
export function createForLoop<
  _TState extends AgentState = AgentState,
>(options: {
  from: string;
  to?: string;
  iterations: number;
  counterField?: string;
  exitNode?: string;
}): EdgeDefinition {
  const counterField = options.counterField ?? '__forLoopCounter';

  return {
    from: options.from,
    to: options.to ?? options.from,
    type: 'loop',
    condition: {
      type: 'custom',
      evaluate: async (state: AgentState) => {
        const current = (state.data[counterField] as number) ?? 0;
        return current < options.iterations;
      },
    },
    metadata: {
      loopType: 'for',
      iterations: options.iterations,
      counterField,
      exitNode: options.exitNode,
    },
  };
}

/**
 * Create a while-loop style edge
 *
 * @example
 * ```typescript
 * const whileLoop = createWhileLoop({
 *   from: 'check',
 *   to: 'process',
 *   condition: conditions.lessThan('data.errorCount', 5),
 *   exitNode: 'done',
 *   maxIterations: 100
 * });
 * ```
 *
 * @param options - While loop configuration
 * @returns EdgeDefinition for the loop
 */
export function createWhileLoop(options: {
  from: string;
  to?: string;
  condition: EdgeCondition;
  exitNode?: string;
  maxIterations?: number;
}): EdgeDefinition {
  const maxIterations = options.maxIterations ?? 1000;

  return {
    from: options.from,
    to: options.to ?? options.from,
    type: 'loop',
    condition: {
      type: 'custom',
      evaluate: async (state: AgentState, context: EdgeContext) => {
        // Check iteration guard
        const iterations =
          context.graph?.config?.maxIterations ?? maxIterations;
        if (state.metadata.stepCount >= iterations) {
          return false;
        }

        return await evaluateCondition(options.condition, state, context);
      },
    },
    metadata: {
      loopType: 'while',
      exitNode: options.exitNode,
      maxIterations,
    },
  };
}

/**
 * Create a do-while loop (executes at least once)
 *
 * @example
 * ```typescript
 * const doWhileLoop = createDoWhileLoop({
 *   from: 'retry',
 *   condition: conditions.equals('data.success', false),
 *   exitNode: 'complete',
 *   maxIterations: 5
 * });
 * ```
 *
 * @param options - Do-while loop configuration
 * @returns EdgeDefinition for the loop
 */
export function createDoWhileLoop(options: {
  from: string;
  to?: string;
  condition: EdgeCondition;
  exitNode?: string;
  maxIterations?: number;
}): EdgeDefinition {
  const maxIterations = options.maxIterations ?? 1000;

  return {
    from: options.from,
    to: options.to ?? options.from,
    type: 'loop',
    condition: {
      type: 'custom',
      evaluate: async (state: AgentState, context: EdgeContext) => {
        // Check iteration guard
        const iterations =
          context.graph?.config?.maxIterations ?? maxIterations;
        if (state.metadata.stepCount >= iterations) {
          return false;
        }

        // First iteration always executes (check if this is first time through)
        const loopCount = (state.data['__doWhileCount'] as number) ?? 0;
        if (loopCount === 0) {
          return true;
        }

        return await evaluateCondition(options.condition, state, context);
      },
    },
    metadata: {
      loopType: 'do-while',
      exitNode: options.exitNode,
      maxIterations,
    },
  };
}

/**
 * Create a retry loop with exponential backoff
 *
 * @example
 * ```typescript
 * const retryLoop = createRetryLoop({
 *   from: 'api-call',
 *   maxRetries: 3,
 *   exitOnSuccess: 'process-result',
 *   exitOnFailure: 'handle-error',
 *   successCondition: conditions.equals('data.success', true)
 * });
 * ```
 *
 * @param options - Retry loop configuration
 * @returns EdgeDefinition for the loop
 */
export function createRetryLoop(options: {
  from: string;
  to?: string;
  maxRetries: number;
  retryCountField?: string;
  successCondition: EdgeCondition;
  exitOnSuccess?: string;
  exitOnFailure?: string;
}): EdgeDefinition {
  const retryCountField = options.retryCountField ?? '__retryCount';

  return {
    from: options.from,
    to: options.to ?? options.from,
    type: 'loop',
    condition: {
      type: 'custom',
      evaluate: async (state: AgentState, context: EdgeContext) => {
        const retryCount = (state.data[retryCountField] as number) ?? 0;

        // Check if we've succeeded
        const succeeded = await evaluateCondition(
          options.successCondition,
          state,
          context
        );
        if (succeeded) {
          return false; // Exit loop to success node
        }

        // Check if we've exhausted retries
        if (retryCount >= options.maxRetries) {
          return false; // Exit loop to failure node
        }

        // Continue retrying
        return true;
      },
    },
    metadata: {
      loopType: 'retry',
      maxRetries: options.maxRetries,
      retryCountField,
      exitOnSuccess: options.exitOnSuccess,
      exitOnFailure: options.exitOnFailure,
    },
  };
}

/**
 * Create a pagination loop for iterating through paged data
 *
 * @example
 * ```typescript
 * const paginationLoop = createPaginationLoop({
 *   from: 'fetch-page',
 *   pageField: 'data.currentPage',
 *   hasMoreField: 'data.hasMore',
 *   exitNode: 'process-all'
 * });
 * ```
 *
 * @param options - Pagination loop configuration
 * @returns EdgeDefinition for the loop
 */
export function createPaginationLoop(options: {
  from: string;
  to?: string;
  pageField?: string;
  hasMoreField: string;
  maxPages?: number;
  exitNode?: string;
}): EdgeDefinition {
  const pageField = options.pageField ?? '__currentPage';
  const maxPages = options.maxPages ?? 1000;

  return {
    from: options.from,
    to: options.to ?? options.from,
    type: 'loop',
    condition: {
      type: 'custom',
      evaluate: async (state: AgentState) => {
        const currentPage = (state.data[pageField] as number) ?? 0;

        // Check page limit
        if (currentPage >= maxPages) {
          return false;
        }

        // Check if there are more pages
        const hasMore = getFieldValue(state, options.hasMoreField);
        return hasMore === true;
      },
    },
    metadata: {
      loopType: 'pagination',
      pageField,
      hasMoreField: options.hasMoreField,
      maxPages,
      exitNode: options.exitNode,
    },
  };
}

/**
 * Evaluate a condition against state
 */
async function evaluateCondition(
  condition: EdgeCondition,
  state: AgentState,
  context: EdgeContext
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
        return await condition.evaluate(state, context);
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
 * Schema for loop configuration validation
 */
export const LoopConfigSchema = z.object({
  maxIterations: z.number().min(1).optional(),
  counterField: z.string().optional(),
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
  onMaxIterations: z.enum(['error', 'exit', 'force-exit']).optional(),
  exitNode: z.string().optional(),
});

/**
 * Validate a loop configuration
 */
export function validateLoopConfig(config: LoopConfig): boolean {
  try {
    LoopConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}
