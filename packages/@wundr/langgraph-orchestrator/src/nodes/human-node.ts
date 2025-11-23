/**
 * Human Node - Human-in-the-loop interaction node
 * @module @wundr.io/langgraph-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type {
  AgentState,
  NodeDefinition,
  NodeContext,
  NodeResult,
  Message,
} from '../types';

/**
 * Configuration for human node
 */
export interface HumanNodeConfig {
  /** Prompt to display to the human */
  readonly prompt?: string | ((state: AgentState) => string);
  /** Input handler to collect human response */
  readonly inputHandler: HumanInputHandler;
  /** Validation for human input */
  readonly validation?: z.ZodSchema;
  /** Timeout for human response in milliseconds */
  readonly timeout?: number;
  /** What to do on timeout */
  readonly onTimeout?: 'error' | 'skip' | 'default';
  /** Default value to use on timeout */
  readonly defaultValue?: unknown;
  /** Pre-defined choices for the human */
  readonly choices?: HumanChoice[];
  /** Whether to require confirmation */
  readonly requireConfirmation?: boolean;
  /** Custom response processor */
  readonly processResponse?: (
    response: HumanResponse,
    state: AgentState
  ) => Partial<AgentState['data']>;
}

/**
 * Handler for collecting human input
 */
export interface HumanInputHandler {
  /** Request input from human */
  request(context: HumanInputContext): Promise<HumanResponse>;
  /** Cancel a pending request */
  cancel?(requestId: string): Promise<void>;
}

/**
 * Context provided to human input handler
 */
export interface HumanInputContext {
  /** Unique request ID */
  readonly requestId: string;
  /** Prompt to display */
  readonly prompt: string;
  /** Available choices */
  readonly choices?: HumanChoice[];
  /** Current workflow state (sanitized) */
  readonly state: Partial<AgentState>;
  /** Timeout in milliseconds */
  readonly timeout?: number;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Human choice option
 */
export interface HumanChoice {
  /** Choice value */
  readonly value: string;
  /** Display label */
  readonly label: string;
  /** Description */
  readonly description?: string;
  /** Whether this is the default choice */
  readonly default?: boolean;
}

/**
 * Response from human input
 */
export interface HumanResponse {
  /** The response value */
  readonly value: unknown;
  /** Response type */
  readonly type: 'input' | 'choice' | 'confirmation' | 'cancel' | 'timeout';
  /** Timestamp of response */
  readonly timestamp: Date;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Schema for human node configuration validation
 */
export const HumanNodeConfigSchema = z.object({
  prompt: z.union([z.string(), z.function()]).optional(),
  timeout: z.number().min(0).optional(),
  onTimeout: z.enum(['error', 'skip', 'default']).optional(),
  choices: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        description: z.string().optional(),
        default: z.boolean().optional(),
      })
    )
    .optional(),
  requireConfirmation: z.boolean().optional(),
});

/**
 * Create a human-in-the-loop node
 *
 * @example
 * ```typescript
 * const humanNode = createHumanNode({
 *   id: 'approval',
 *   name: 'Human Approval',
 *   config: {
 *     prompt: 'Please review and approve the generated content.',
 *     inputHandler: myInputHandler,
 *     choices: [
 *       { value: 'approve', label: 'Approve' },
 *       { value: 'reject', label: 'Reject' },
 *       { value: 'modify', label: 'Request Modifications' }
 *     ],
 *     timeout: 300000 // 5 minutes
 *   }
 * });
 *
 * graph.addNode('approval', humanNode);
 * ```
 *
 * @param options - Node creation options
 * @returns NodeDefinition for use in StateGraph
 */
export function createHumanNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  config: HumanNodeConfig;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  const { id, name, config, nodeConfig = {} } = options;

  return {
    id,
    name,
    type: 'human',
    config: nodeConfig,
    execute: async (
      state: TState,
      context: NodeContext
    ): Promise<NodeResult<TState>> => {
      const requestId = uuidv4();

      // Build prompt
      const prompt =
        typeof config.prompt === 'function'
          ? config.prompt(state)
          : (config.prompt ?? 'Please provide input:');

      context.services.logger.info('Requesting human input', {
        requestId,
        hasChoices: Boolean(config.choices?.length),
      });

      // Build input context
      const inputContext: HumanInputContext = {
        requestId,
        prompt,
        choices: config.choices,
        state: sanitizeStateForHuman(state),
        timeout: config.timeout,
        metadata: {
          nodeId: id,
          nodeName: name,
          executionId: context.executionId,
        },
      };

      let response: HumanResponse;

      try {
        // Request input with timeout if configured
        if (config.timeout) {
          response = await Promise.race([
            config.inputHandler.request(inputContext),
            createTimeoutPromise(config.timeout, requestId),
          ]);
        } else {
          response = await config.inputHandler.request(inputContext);
        }
      } catch (error) {
        // Handle timeout
        if ((error as Error).message === 'TIMEOUT') {
          response = {
            value: config.defaultValue,
            type: 'timeout',
            timestamp: new Date(),
          };

          if (config.onTimeout === 'error') {
            throw new Error(`Human input timed out after ${config.timeout}ms`);
          }

          if (config.onTimeout === 'skip') {
            context.services.logger.warn('Human input timed out, skipping');
            return { state };
          }
        } else {
          throw error;
        }
      }

      context.services.logger.debug('Received human response', {
        requestId,
        type: response.type,
      });

      // Handle cancellation
      if (response.type === 'cancel') {
        context.services.logger.info('Human cancelled input');
        return {
          state,
          terminate: true,
        };
      }

      // Validate response if schema provided
      if (config.validation && response.type !== 'timeout') {
        try {
          config.validation.parse(response.value);
        } catch (validationError) {
          throw new Error(
            `Human input validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`
          );
        }
      }

      // Build human message
      const humanMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: formatResponseContent(response),
        timestamp: response.timestamp,
        metadata: {
          requestId,
          responseType: response.type,
          ...response.metadata,
        },
      };

      // Build updated state
      let newData = { ...state.data };
      newData['lastHumanResponse'] = response;

      // Apply custom response processor
      if (config.processResponse) {
        const processed = config.processResponse(response, state);
        newData = { ...newData, ...processed };
      }

      const newState: TState = {
        ...state,
        messages: [...state.messages, humanMessage],
        data: newData,
      } as TState;

      return {
        state: newState,
        metadata: {
          duration: 0,
        },
      };
    },
  };
}

/**
 * Sanitize state for human viewing
 */
function sanitizeStateForHuman(state: AgentState): Partial<AgentState> {
  return {
    currentStep: state.currentStep,
    data: state.data,
    messages: state.messages.slice(-5), // Only show recent messages
  };
}

/**
 * Create a timeout promise
 */
function createTimeoutPromise(
  timeout: number,
  _requestId: string
): Promise<HumanResponse> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), timeout);
  });
}

/**
 * Format response content as string
 */
function formatResponseContent(response: HumanResponse): string {
  if (response.type === 'timeout') {
    return '[Timed out - using default]';
  }

  if (response.type === 'cancel') {
    return '[Cancelled]';
  }

  if (typeof response.value === 'string') {
    return response.value;
  }

  return JSON.stringify(response.value);
}

/**
 * Create a console-based human input handler
 *
 * @example
 * ```typescript
 * const handler = createConsoleInputHandler();
 *
 * const humanNode = createHumanNode({
 *   id: 'input',
 *   name: 'User Input',
 *   config: {
 *     inputHandler: handler,
 *     prompt: 'Enter your response:'
 *   }
 * });
 * ```
 *
 * @returns HumanInputHandler for console input
 */
export function createConsoleInputHandler(): HumanInputHandler {
  // Note: This is a placeholder - actual console input would need readline
  // In production, use a proper event-based input handler
  return {
    async request(_context: HumanInputContext): Promise<HumanResponse> {
      // In a real implementation, this would read from stdin
      // For now, return a placeholder response
      return {
        value: 'placeholder-response',
        type: 'input',
        timestamp: new Date(),
      };
    },
  };
}

/**
 * Create a callback-based human input handler
 *
 * @example
 * ```typescript
 * const pendingRequests = new Map();
 *
 * const handler = createCallbackInputHandler({
 *   onRequest: (context) => {
 *     pendingRequests.set(context.requestId, context);
 *     // Notify UI or external system
 *   },
 *   onResolve: (requestId) => pendingRequests.delete(requestId)
 * });
 *
 * // External system resolves:
 * handler.resolve(requestId, { value: 'user input', type: 'input', timestamp: new Date() });
 * ```
 *
 * @param options - Handler options
 * @returns HumanInputHandler with resolve capability
 */
export function createCallbackInputHandler(options: {
  onRequest?: (context: HumanInputContext) => void;
  onResolve?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
}): HumanInputHandler & {
  resolve: (requestId: string, response: HumanResponse) => void;
  reject: (requestId: string, error: Error) => void;
} {
  const pending = new Map<
    string,
    {
      resolve: (response: HumanResponse) => void;
      reject: (error: Error) => void;
    }
  >();

  return {
    async request(context: HumanInputContext): Promise<HumanResponse> {
      return new Promise((resolve, reject) => {
        pending.set(context.requestId, { resolve, reject });
        options.onRequest?.(context);
      });
    },

    async cancel(requestId: string): Promise<void> {
      const handlers = pending.get(requestId);
      if (handlers) {
        handlers.resolve({
          value: null,
          type: 'cancel',
          timestamp: new Date(),
        });
        pending.delete(requestId);
        options.onCancel?.(requestId);
      }
    },

    resolve(requestId: string, response: HumanResponse): void {
      const handlers = pending.get(requestId);
      if (handlers) {
        handlers.resolve(response);
        pending.delete(requestId);
        options.onResolve?.(requestId);
      }
    },

    reject(requestId: string, error: Error): void {
      const handlers = pending.get(requestId);
      if (handlers) {
        handlers.reject(error);
        pending.delete(requestId);
      }
    },
  };
}

/**
 * Create a confirmation node for human approval
 *
 * @example
 * ```typescript
 * const confirmNode = createConfirmationNode({
 *   id: 'confirm-action',
 *   name: 'Confirm Action',
 *   inputHandler: myHandler,
 *   message: (state) => `Are you sure you want to ${state.data.action}?`,
 *   onConfirm: 'execute-action',
 *   onReject: 'cancel-action'
 * });
 * ```
 *
 * @param options - Confirmation node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createConfirmationNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  inputHandler: HumanInputHandler;
  message: string | ((state: TState) => string);
  onConfirm: string;
  onReject: string;
  timeout?: number;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  return createHumanNode<TState>({
    id: options.id,
    name: options.name,
    config: {
      prompt: options.message as string | ((state: AgentState) => string),
      inputHandler: options.inputHandler,
      choices: [
        { value: 'confirm', label: 'Confirm', default: false },
        { value: 'reject', label: 'Reject', default: false },
      ],
      timeout: options.timeout,
      onTimeout: 'error',
      processResponse: response => ({
        confirmationResult: response.value,
      }),
    },
    nodeConfig: options.nodeConfig,
  });
}

/**
 * Create a feedback collection node
 *
 * @example
 * ```typescript
 * const feedbackNode = createFeedbackNode({
 *   id: 'collect-feedback',
 *   name: 'Collect Feedback',
 *   inputHandler: myHandler,
 *   questions: [
 *     { id: 'rating', prompt: 'Rate this response (1-5):', type: 'number' },
 *     { id: 'comments', prompt: 'Any additional comments?', type: 'text' }
 *   ]
 * });
 * ```
 *
 * @param options - Feedback node options
 * @returns NodeDefinition for use in StateGraph
 */
export function createFeedbackNode<
  TState extends AgentState = AgentState,
>(options: {
  id: string;
  name: string;
  inputHandler: HumanInputHandler;
  questions: Array<{
    id: string;
    prompt: string;
    type: 'text' | 'number' | 'choice';
    choices?: string[];
    required?: boolean;
  }>;
  timeout?: number;
  nodeConfig?: NodeDefinition<TState>['config'];
}): NodeDefinition<TState> {
  return {
    id: options.id,
    name: options.name,
    type: 'human',
    config: options.nodeConfig ?? {},
    execute: async (
      state: TState,
      _context: NodeContext
    ): Promise<NodeResult<TState>> => {
      const feedback: Record<string, unknown> = {};

      for (const question of options.questions) {
        const requestId = uuidv4();

        const inputContext: HumanInputContext = {
          requestId,
          prompt: question.prompt,
          choices: question.choices?.map(c => ({ value: c, label: c })),
          state: sanitizeStateForHuman(state),
          timeout: options.timeout,
        };

        const response = await options.inputHandler.request(inputContext);

        if (response.type === 'cancel') {
          return { state, terminate: true };
        }

        feedback[question.id] = response.value;
      }

      const newState: TState = {
        ...state,
        data: {
          ...state.data,
          feedback,
        },
      } as TState;

      return { state: newState };
    },
  };
}
