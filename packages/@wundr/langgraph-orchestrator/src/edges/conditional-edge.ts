/**
 * Conditional Edge - Routing based on state conditions
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
 * Builder for conditional edges with fluent API
 */
export class ConditionalEdgeBuilder<TState extends AgentState = AgentState> {
  private readonly from: string;
  private readonly conditions: Array<{
    condition: EdgeCondition;
    target: string;
  }> = [];
  private defaultTarget?: string;

  /**
   * Create a new conditional edge builder
   * @param from - Source node name
   */
  constructor(from: string) {
    this.from = from;
  }

  /**
   * Add a condition branch
   * @param condition - Condition to evaluate
   * @param target - Target node if condition matches
   * @returns this for chaining
   */
  when(condition: EdgeCondition, target: string): this {
    this.conditions.push({ condition, target });
    return this;
  }

  /**
   * Add an equals condition
   * @param field - Field path to check
   * @param value - Value to compare
   * @param target - Target node if matches
   * @returns this for chaining
   */
  whenEquals(field: string, value: unknown, target: string): this {
    return this.when({ type: 'equals', field, value }, target);
  }

  /**
   * Add a not-equals condition
   * @param field - Field path to check
   * @param value - Value to compare
   * @param target - Target node if doesn't match
   * @returns this for chaining
   */
  whenNotEquals(field: string, value: unknown, target: string): this {
    return this.when({ type: 'not_equals', field, value }, target);
  }

  /**
   * Add a contains condition
   * @param field - Field path to check (array or string)
   * @param value - Value to look for
   * @param target - Target node if contains
   * @returns this for chaining
   */
  whenContains(field: string, value: unknown, target: string): this {
    return this.when({ type: 'contains', field, value }, target);
  }

  /**
   * Add a greater-than condition
   * @param field - Field path to check
   * @param value - Value to compare
   * @param target - Target node if greater
   * @returns this for chaining
   */
  whenGreaterThan(field: string, value: number, target: string): this {
    return this.when({ type: 'greater_than', field, value }, target);
  }

  /**
   * Add a less-than condition
   * @param field - Field path to check
   * @param value - Value to compare
   * @param target - Target node if less
   * @returns this for chaining
   */
  whenLessThan(field: string, value: number, target: string): this {
    return this.when({ type: 'less_than', field, value }, target);
  }

  /**
   * Add an exists condition
   * @param field - Field path to check
   * @param target - Target node if field exists
   * @returns this for chaining
   */
  whenExists(field: string, target: string): this {
    return this.when({ type: 'exists', field }, target);
  }

  /**
   * Add a not-exists condition
   * @param field - Field path to check
   * @param target - Target node if field doesn't exist
   * @returns this for chaining
   */
  whenNotExists(field: string, target: string): this {
    return this.when({ type: 'not_exists', field }, target);
  }

  /**
   * Add a custom condition
   * @param evaluate - Custom evaluator function
   * @param target - Target node if evaluator returns true
   * @returns this for chaining
   */
  whenCustom(evaluate: EdgeConditionEvaluator<TState>, target: string): this {
    return this.when(
      { type: 'custom', evaluate: evaluate as EdgeConditionEvaluator },
      target
    );
  }

  /**
   * Set the default target if no conditions match
   * @param target - Default target node
   * @returns this for chaining
   */
  otherwise(target: string): this {
    this.defaultTarget = target;
    return this;
  }

  /**
   * Build the edge definitions
   * @returns Array of EdgeDefinition
   */
  build(): EdgeDefinition[] {
    const edges: EdgeDefinition[] = this.conditions.map(
      ({ condition, target }) => ({
        from: this.from,
        to: target,
        type: 'conditional' as const,
        condition,
      })
    );

    if (this.defaultTarget) {
      edges.push({
        from: this.from,
        to: this.defaultTarget,
        type: 'direct',
      });
    }

    return edges;
  }
}

/**
 * Create a conditional edge builder
 *
 * @example
 * ```typescript
 * const edges = conditionalEdge('router')
 *   .whenEquals('data.action', 'search', 'search-node')
 *   .whenEquals('data.action', 'answer', 'answer-node')
 *   .whenGreaterThan('data.confidence', 0.9, 'direct-answer')
 *   .otherwise('fallback')
 *   .build();
 *
 * for (const edge of edges) {
 *   graph.addConditionalEdge(edge.from, edge.to, edge.condition!);
 * }
 * ```
 *
 * @param from - Source node name
 * @returns ConditionalEdgeBuilder
 */
export function conditionalEdge<TState extends AgentState = AgentState>(
  from: string
): ConditionalEdgeBuilder<TState> {
  return new ConditionalEdgeBuilder<TState>(from);
}

/**
 * Create a router function for LLM-based routing
 *
 * @example
 * ```typescript
 * const router = createRouter({
 *   routes: {
 *     'search': 'search-node',
 *     'calculate': 'calculator-node',
 *     'answer': 'answer-node'
 *   },
 *   routeExtractor: (state) => state.data.nextAction as string,
 *   defaultRoute: 'answer'
 * });
 * ```
 *
 * @param options - Router configuration
 * @returns Router function
 */
export function createRouter<TState extends AgentState = AgentState>(options: {
  routes: Record<string, string>;
  routeExtractor: (state: TState) => string;
  defaultRoute?: string;
  validator?: (route: string) => boolean;
}): (state: TState) => string {
  return (state: TState): string => {
    const extractedRoute = options.routeExtractor(state);

    if (options.validator && !options.validator(extractedRoute)) {
      if (options.defaultRoute) {
        return options.defaultRoute;
      }
      throw new Error(`Invalid route: ${extractedRoute}`);
    }

    const target = options.routes[extractedRoute];
    if (target) {
      return target;
    }

    if (options.defaultRoute) {
      return options.defaultRoute;
    }

    throw new Error(`No route found for: ${extractedRoute}`);
  };
}

/**
 * Condition factory functions
 */
export const conditions = {
  /**
   * Create an equals condition
   */
  equals(field: string, value: unknown): EdgeCondition {
    return { type: 'equals', field, value };
  },

  /**
   * Create a not-equals condition
   */
  notEquals(field: string, value: unknown): EdgeCondition {
    return { type: 'not_equals', field, value };
  },

  /**
   * Create a contains condition
   */
  contains(field: string, value: unknown): EdgeCondition {
    return { type: 'contains', field, value };
  },

  /**
   * Create a greater-than condition
   */
  greaterThan(field: string, value: number): EdgeCondition {
    return { type: 'greater_than', field, value };
  },

  /**
   * Create a less-than condition
   */
  lessThan(field: string, value: number): EdgeCondition {
    return { type: 'less_than', field, value };
  },

  /**
   * Create an exists condition
   */
  exists(field: string): EdgeCondition {
    return { type: 'exists', field };
  },

  /**
   * Create a not-exists condition
   */
  notExists(field: string): EdgeCondition {
    return { type: 'not_exists', field };
  },

  /**
   * Create a custom condition
   */
  custom<TState extends AgentState = AgentState>(
    evaluate: EdgeConditionEvaluator<TState>
  ): EdgeCondition {
    return { type: 'custom', evaluate: evaluate as EdgeConditionEvaluator };
  },

  /**
   * Create an AND condition (all must be true)
   */
  and(...conditionList: EdgeCondition[]): EdgeCondition {
    return {
      type: 'custom',
      evaluate: async (state: AgentState, context: EdgeContext) => {
        for (const condition of conditionList) {
          const result = await evaluateCondition(condition, state, context);
          if (!result) {
            return false;
          }
        }
        return true;
      },
    };
  },

  /**
   * Create an OR condition (any must be true)
   */
  or(...conditionList: EdgeCondition[]): EdgeCondition {
    return {
      type: 'custom',
      evaluate: async (state: AgentState, context: EdgeContext) => {
        for (const condition of conditionList) {
          const result = await evaluateCondition(condition, state, context);
          if (result) {
            return true;
          }
        }
        return false;
      },
    };
  },

  /**
   * Create a NOT condition (negate result)
   */
  not(condition: EdgeCondition): EdgeCondition {
    return {
      type: 'custom',
      evaluate: async (state: AgentState, context: EdgeContext) => {
        const result = await evaluateCondition(condition, state, context);
        return !result;
      },
    };
  },

  /**
   * Create a range condition (value between min and max)
   */
  inRange(field: string, min: number, max: number): EdgeCondition {
    return {
      type: 'custom',
      evaluate: async (state: AgentState) => {
        const value = getFieldValue(state, field);
        return typeof value === 'number' && value >= min && value <= max;
      },
    };
  },

  /**
   * Create a regex match condition
   */
  matches(field: string, pattern: RegExp): EdgeCondition {
    return {
      type: 'custom',
      evaluate: async (state: AgentState) => {
        const value = getFieldValue(state, field);
        return typeof value === 'string' && pattern.test(value);
      },
    };
  },

  /**
   * Create an "in array" condition
   */
  isIn(field: string, values: unknown[]): EdgeCondition {
    return {
      type: 'custom',
      evaluate: async (state: AgentState) => {
        const value = getFieldValue(state, field);
        return values.includes(value);
      },
    };
  },

  /**
   * Create a type check condition
   */
  isType(
    field: string,
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  ): EdgeCondition {
    return {
      type: 'custom',
      evaluate: async (state: AgentState) => {
        const value = getFieldValue(state, field);
        if (type === 'array') {
          return Array.isArray(value);
        }
        return typeof value === type;
      },
    };
  },
};

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
 * Schema for edge condition validation
 */
export const EdgeConditionSchema = z.object({
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
});

/**
 * Validate an edge condition
 */
export function validateCondition(condition: EdgeCondition): boolean {
  try {
    EdgeConditionSchema.parse(condition);
    return true;
  } catch {
    return false;
  }
}
