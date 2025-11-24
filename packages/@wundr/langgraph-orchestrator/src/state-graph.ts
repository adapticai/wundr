/**
 * StateGraph - Core class for defining workflow graphs with nodes and edges
 * @module @wundr.io/langgraph-orchestrator
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import type {
  AgentState,
  GraphConfig,
  GraphGlobalConfig,
  NodeDefinition,
  EdgeDefinition,
  EdgeCondition,
  ExecutionOptions,
  ExecutionResult,
  ExecutionStats,
  NodeContext,
  NodeResult,
  NodeServices,
  Checkpoint,
  WorkflowError,
  StateHistoryEntry,
  StateChange,
  StateMetadata,
  Logger,
  GraphCheckpointer,
} from './types';

/**
 * Default graph configuration
 */
const DEFAULT_CONFIG: GraphGlobalConfig = {
  maxIterations: 100,
  timeout: 300000, // 5 minutes
  checkpointEnabled: true,
  checkpointInterval: 1,
  parallelExecution: false,
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    retryableErrors: ['TIMEOUT', 'RATE_LIMIT', 'NETWORK_ERROR'],
  },
  logLevel: 'info',
};

/**
 * Events emitted by StateGraph
 */
export interface StateGraphEvents {
  'execution:start': (state: AgentState) => void;
  'execution:complete': (result: ExecutionResult) => void;
  'execution:error': (error: WorkflowError) => void;
  'node:enter': (nodeName: string, state: AgentState) => void;
  'node:exit': (nodeName: string, result: NodeResult) => void;
  'checkpoint:created': (checkpoint: Checkpoint) => void;
  'state:updated': (state: AgentState) => void;
}

/**
 * Console-based logger implementation
 */
class ConsoleLogger implements Logger {
  constructor(private readonly level: string) {}

  private shouldLog(msgLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'silent'];
    return levels.indexOf(msgLevel) >= levels.indexOf(this.level);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      // Using process.stderr for logging to avoid polluting stdout
      process.stderr.write(
        `[DEBUG] ${message} ${data ? JSON.stringify(data) : ''}\n`,
      );
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      // Using process.stderr for logging to avoid polluting stdout
      process.stderr.write(
        `[INFO] ${message} ${data ? JSON.stringify(data) : ''}\n`,
      );
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, data ?? '');
    }
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, data ?? '');
    }
  }
}

/**
 * StateGraph class for defining and executing workflow graphs
 *
 * @example
 * ```typescript
 * const graph = new StateGraph('my-workflow')
 *   .addNode('start', {
 *     id: 'start',
 *     name: 'Start Node',
 *     type: 'start',
 *     config: {},
 *     execute: async (state) => ({ state, next: 'process' })
 *   })
 *   .addNode('process', {
 *     id: 'process',
 *     name: 'Process Node',
 *     type: 'transform',
 *     config: {},
 *     execute: async (state) => ({ state, next: 'end' })
 *   })
 *   .addEdge('start', 'process')
 *   .setEntryPoint('start');
 *
 * const result = await graph.execute();
 * ```
 */
export class StateGraph<
  TState extends AgentState = AgentState,
> extends EventEmitter<StateGraphEvents> {
  private readonly id: string;
  private readonly name: string;
  private readonly description?: string;
  private readonly nodes: Map<string, NodeDefinition<TState>> = new Map();
  private readonly edges: Map<string, EdgeDefinition[]> = new Map();
  private entryPoint?: string;
  private config: GraphGlobalConfig;
  private _checkpointer?: GraphCheckpointer;
  private services: Partial<NodeServices> = {};
  private logger: Logger;

  /** Get the checkpointer */
  get checkpointer(): GraphCheckpointer | undefined {
    return this._checkpointer;
  }

  /**
   * Create a new StateGraph
   * @param name - Human-readable name for the graph
   * @param config - Optional configuration overrides
   */
  constructor(name: string, config?: Partial<GraphGlobalConfig>) {
    super();
    this.id = uuidv4();
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new ConsoleLogger(this.config.logLevel);
  }

  /**
   * Add a node to the graph
   * @param name - Unique name for the node
   * @param definition - Node definition
   * @returns this for chaining
   */
  addNode(name: string, definition: NodeDefinition<TState>): this {
    if (this.nodes.has(name)) {
      throw new Error(`Node "${name}" already exists in graph "${this.name}"`);
    }
    this.nodes.set(name, definition);
    this.edges.set(name, []);
    return this;
  }

  /**
   * Add a direct edge between nodes
   * @param from - Source node name
   * @param to - Target node name
   * @returns this for chaining
   */
  addEdge(from: string, to: string): this {
    this.validateNodeExists(from);
    this.validateNodeExists(to);

    const edge: EdgeDefinition = {
      from,
      to,
      type: 'direct',
    };

    const edges = this.edges.get(from) ?? [];
    edges.push(edge);
    this.edges.set(from, edges);
    return this;
  }

  /**
   * Add a conditional edge
   * @param from - Source node name
   * @param to - Target node name
   * @param condition - Condition for traversal
   * @returns this for chaining
   */
  addConditionalEdge(from: string, to: string, condition: EdgeCondition): this {
    this.validateNodeExists(from);
    this.validateNodeExists(to);

    const edge: EdgeDefinition = {
      from,
      to,
      type: 'conditional',
      condition,
    };

    const edges = this.edges.get(from) ?? [];
    edges.push(edge);
    this.edges.set(from, edges);
    return this;
  }

  /**
   * Add a loop edge that can cycle back
   * @param from - Source node name
   * @param to - Target node name (can be same as from)
   * @param condition - Condition to continue looping
   * @returns this for chaining
   */
  addLoopEdge(from: string, to: string, condition: EdgeCondition): this {
    this.validateNodeExists(from);
    this.validateNodeExists(to);

    const edge: EdgeDefinition = {
      from,
      to,
      type: 'loop',
      condition,
    };

    const edges = this.edges.get(from) ?? [];
    edges.push(edge);
    this.edges.set(from, edges);
    return this;
  }

  /**
   * Add parallel edges to multiple targets
   * @param from - Source node name
   * @param targets - Target node names
   * @returns this for chaining
   */
  addParallelEdges(from: string, targets: string[]): this {
    this.validateNodeExists(from);
    targets.forEach(t => this.validateNodeExists(t));

    for (const to of targets) {
      const edge: EdgeDefinition = {
        from,
        to,
        type: 'parallel',
      };
      const edges = this.edges.get(from) ?? [];
      edges.push(edge);
      this.edges.set(from, edges);
    }
    return this;
  }

  /**
   * Set the entry point node
   * @param nodeName - Name of the entry point node
   * @returns this for chaining
   */
  setEntryPoint(nodeName: string): this {
    this.validateNodeExists(nodeName);
    this.entryPoint = nodeName;
    return this;
  }

  /**
   * Set the checkpointer for state persistence
   * @param checkpointer - Checkpointer implementation
   * @returns this for chaining
   */
  setCheckpointer(checkpointer: GraphCheckpointer): this {
    this._checkpointer = checkpointer;
    this.services = { ...this.services, checkpointer };
    return this;
  }

  /**
   * Set services available to nodes
   * @param services - Services to provide
   * @returns this for chaining
   */
  setServices(services: Partial<NodeServices>): this {
    this.services = { ...this.services, ...services };
    return this;
  }

  /**
   * Get the graph configuration
   * @returns GraphConfig object
   */
  getConfig(): GraphConfig {
    if (!this.entryPoint) {
      throw new Error(
        'Entry point not set. Call setEntryPoint() before getConfig()',
      );
    }

    // The nodes Map uses TState-specific NodeDefinition, but GraphConfig uses the base type.
    // This cast is safe because GraphConfig is used for inspection/serialization,
    // while actual execution uses the strongly-typed internal this.nodes Map.
    const typedNodes: Map<string, NodeDefinition> = new Map();
    for (const [key, value] of this.nodes) {
      // Cast through unknown is necessary here because NodeDefinition<TState>
      // has contravariant parameter in execute function signature
      typedNodes.set(key, value as unknown as NodeDefinition);
    }

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      entryPoint: this.entryPoint,
      nodes: typedNodes,
      edges: new Map(this.edges),
      config: this.config,
    };
  }

  /**
   * Execute the graph
   * @param options - Execution options
   * @returns Execution result
   */
  async execute(options?: ExecutionOptions): Promise<ExecutionResult> {
    if (!this.entryPoint) {
      throw new Error(
        'Entry point not set. Call setEntryPoint() before execute()',
      );
    }

    const executionId = uuidv4();
    const startTime = Date.now();
    const path: string[] = [];
    let nodesExecuted = 0;
    let iterations = 0;
    let tokensUsed = 0;
    let checkpointsCreated = 0;
    let retries = 0;

    // Initialize or restore state
    let state = await this.initializeState(executionId, options);

    this.emit('execution:start', state);
    options?.handlers?.onStart?.(state);

    let currentNode = options?.resumeFrom
      ? await this.getNodeFromCheckpoint(options.resumeFrom)
      : this.entryPoint;

    try {
      while (currentNode && iterations < this.config.maxIterations) {
        iterations++;
        const node = this.nodes.get(currentNode);

        if (!node) {
          throw this.createError(
            'NODE_NOT_FOUND',
            `Node "${currentNode}" not found`,
          );
        }

        path.push(currentNode);
        this.logger.debug(`Entering node: ${currentNode}`, {
          iteration: iterations,
        });
        this.emit('node:enter', currentNode, state);
        options?.handlers?.onNodeEnter?.(currentNode, state);

        // Execute node with retry logic
        const result = await this.executeNodeWithRetry(
          node,
          state,
          executionId,
          iterations,
        );
        nodesExecuted++;

        if (result.metadata?.tokensUsed) {
          tokensUsed += result.metadata.tokensUsed;
        }
        if (result.metadata?.retryCount) {
          retries += result.metadata.retryCount;
        }

        // Update state with history
        state = this.updateStateWithHistory(result.state, currentNode, state);

        this.emit('node:exit', currentNode, result);
        this.emit('state:updated', state);
        options?.handlers?.onNodeExit?.(currentNode, result);

        // Create checkpoint if enabled
        if (
          this.config.checkpointEnabled &&
          iterations % this.config.checkpointInterval === 0 &&
          this.checkpointer
        ) {
          const checkpoint = await this.createCheckpoint(
            state,
            currentNode,
            executionId,
            iterations,
          );
          checkpointsCreated++;
          this.emit('checkpoint:created', checkpoint);
          options?.handlers?.onCheckpoint?.(checkpoint);
        }

        // Check for termination
        if (result.terminate) {
          this.logger.info('Workflow terminated by node', {
            node: currentNode,
          });
          break;
        }

        // Determine next node
        const nextNode = await this.determineNextNode(
          currentNode,
          result,
          state,
        );
        currentNode = nextNode ?? '';

        // Check abort signal
        if (options?.signal?.aborted) {
          throw this.createError('ABORTED', 'Execution was aborted');
        }
      }

      if (iterations >= this.config.maxIterations) {
        throw this.createError(
          'MAX_ITERATIONS',
          `Exceeded maximum iterations (${this.config.maxIterations})`,
        );
      }

      const duration = Date.now() - startTime;
      const stats: ExecutionStats = {
        duration,
        nodesExecuted,
        iterations,
        tokensUsed,
        checkpointsCreated,
        retries,
      };

      const result: ExecutionResult = {
        state,
        success: true,
        stats,
        path,
      };

      this.emit('execution:complete', result);
      options?.handlers?.onComplete?.(state);

      return result;
    } catch (error) {
      const workflowError = this.normalizeError(
        error,
        currentNode ?? 'unknown',
      );
      state = {
        ...state,
        error: workflowError,
        updatedAt: new Date(),
      } as TState;

      this.emit('execution:error', workflowError);
      options?.handlers?.onError?.(workflowError);

      const duration = Date.now() - startTime;
      return {
        state,
        success: false,
        error: workflowError,
        stats: {
          duration,
          nodesExecuted,
          iterations,
          tokensUsed,
          checkpointsCreated,
          retries,
        },
        path,
      };
    }
  }

  /**
   * Compile the graph into an executable form
   * @returns Compiled graph configuration
   */
  compile(): GraphConfig {
    // Validate graph structure
    this.validateGraph();
    return this.getConfig();
  }

  /**
   * Create a subgraph from a subset of nodes
   * @param nodeNames - Names of nodes to include
   * @returns New StateGraph containing the subgraph
   */
  subgraph(nodeNames: string[]): StateGraph<TState> {
    const sub = new StateGraph<TState>(`${this.name}-subgraph`, this.config);

    for (const name of nodeNames) {
      const node = this.nodes.get(name);
      if (node) {
        sub.addNode(name, node);

        // Add edges that connect nodes within the subgraph
        const edges = this.edges.get(name) ?? [];
        for (const edge of edges) {
          if (nodeNames.includes(edge.to)) {
            const existing = sub.edges.get(name) ?? [];
            existing.push(edge);
            sub.edges.set(name, existing);
          }
        }
      }
    }

    return sub;
  }

  // Private helper methods

  private validateNodeExists(nodeName: string): void {
    if (!this.nodes.has(nodeName)) {
      throw new Error(
        `Node "${nodeName}" does not exist in graph "${this.name}"`,
      );
    }
  }

  private validateGraph(): void {
    if (!this.entryPoint) {
      throw new Error('Graph validation failed: No entry point defined');
    }

    if (this.nodes.size === 0) {
      throw new Error('Graph validation failed: No nodes defined');
    }

    // Check all edge targets exist
    for (const [source, edges] of this.edges) {
      for (const edge of edges) {
        if (!this.nodes.has(edge.to)) {
          throw new Error(
            `Graph validation failed: Edge from "${source}" references non-existent node "${edge.to}"`,
          );
        }
      }
    }

    // Check entry point is reachable
    if (!this.nodes.has(this.entryPoint)) {
      throw new Error(
        `Graph validation failed: Entry point "${this.entryPoint}" does not exist`,
      );
    }
  }

  private async initializeState(
    executionId: string,
    options?: ExecutionOptions,
  ): Promise<TState> {
    const now = new Date();
    const metadata: StateMetadata = {
      sessionId: uuidv4(),
      executionId,
      stepCount: 0,
      tags: [],
    };

    const baseState: AgentState = {
      id: uuidv4(),
      messages: [],
      data: {},
      currentStep: this.entryPoint ?? '',
      history: [],
      createdAt: now,
      updatedAt: now,
      metadata,
      ...options?.initialState,
    };

    return baseState as TState;
  }

  private async getNodeFromCheckpoint(checkpointId: string): Promise<string> {
    if (!this.checkpointer) {
      throw new Error('Checkpointer not configured');
    }

    const checkpoint = await this.checkpointer.load(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint "${checkpointId}" not found`);
    }

    return checkpoint.nodeName;
  }

  private async executeNodeWithRetry(
    node: NodeDefinition<TState>,
    state: TState,
    executionId: string,
    iterationCount: number,
  ): Promise<NodeResult<TState>> {
    const retryConfig = { ...this.config.retry, ...node.config.retry };
    let lastError: Error | null = null;
    let retryCount = 0;

    const context: NodeContext = {
      node: node as unknown as NodeDefinition,
      graph: this.getConfig(),
      executionId,
      iterationCount,
      services: {
        logger: this.logger,
        checkpointer: this._checkpointer,
        toolRegistry: this.services.toolRegistry,
        llmProvider: this.services.llmProvider,
      },
    };

    while (retryCount <= retryConfig.maxRetries) {
      try {
        // Execute pre-hooks
        let currentState = state;
        if (node.preHooks) {
          for (const hook of node.preHooks) {
            currentState = await hook(currentState, context);
          }
        }

        // Execute node
        const startTime = Date.now();
        let result = await node.execute(currentState, context);
        const duration = Date.now() - startTime;

        // Execute post-hooks
        if (node.postHooks) {
          for (const hook of node.postHooks) {
            result = {
              ...result,
              state: await hook(result.state, context),
            };
          }
        }

        // Validate output if schema provided
        if (node.outputSchema) {
          node.outputSchema.parse(result.state);
        }

        return {
          ...result,
          metadata: {
            ...result.metadata,
            duration,
            retryCount,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorCode = (error as { code?: string }).code ?? 'UNKNOWN';

        if (
          !retryConfig.retryableErrors.includes(errorCode) ||
          retryCount >= retryConfig.maxRetries
        ) {
          throw error;
        }

        const delay = Math.min(
          retryConfig.initialDelay *
            Math.pow(retryConfig.backoffMultiplier, retryCount),
          retryConfig.maxDelay,
        );

        this.logger.warn(`Retrying node ${node.name} after ${delay}ms`, {
          attempt: retryCount + 1,
          error: lastError.message,
        });

        await this.sleep(delay);
        retryCount++;
      }
    }

    throw lastError ?? new Error('Unknown error during node execution');
  }

  private updateStateWithHistory(
    newState: TState,
    nodeName: string,
    previousState: TState,
  ): TState {
    const changes = this.computeStateChanges(previousState, newState);

    const historyEntry: StateHistoryEntry = {
      step: nodeName,
      timestamp: new Date(),
      snapshot: {
        currentStep: previousState.currentStep,
        data: { ...previousState.data },
      },
      changes,
    };

    return {
      ...newState,
      currentStep: nodeName,
      history: [...previousState.history, historyEntry],
      updatedAt: new Date(),
      metadata: {
        ...newState.metadata,
        stepCount: previousState.metadata.stepCount + 1,
      },
    } as TState;
  }

  private computeStateChanges(
    previous: TState,
    current: TState,
  ): StateChange[] {
    const changes: StateChange[] = [];

    // Compare data fields
    const allKeys = new Set([
      ...Object.keys(previous.data),
      ...Object.keys(current.data),
    ]);

    for (const key of allKeys) {
      const prevValue = previous.data[key];
      const currValue = current.data[key];

      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        changes.push({
          path: `data.${key}`,
          previousValue: prevValue,
          newValue: currValue,
        });
      }
    }

    // Compare messages
    if (current.messages.length !== previous.messages.length) {
      changes.push({
        path: 'messages',
        previousValue: previous.messages.length,
        newValue: current.messages.length,
      });
    }

    return changes;
  }

  private async determineNextNode(
    currentNode: string,
    result: NodeResult<TState>,
    state: TState,
  ): Promise<string | undefined> {
    // If node explicitly specifies next
    if (result.next) {
      if (Array.isArray(result.next)) {
        // For parallel execution, return the first one
        // (proper parallel execution would need more complex handling)
        return result.next[0];
      }
      return result.next;
    }

    // Evaluate edges
    const edges = this.edges.get(currentNode) ?? [];

    for (const edge of edges) {
      const shouldFollow = await this.evaluateEdgeCondition(
        edge,
        result,
        state,
      );
      if (shouldFollow) {
        return edge.to;
      }
    }

    // No matching edge - end of workflow
    return undefined;
  }

  private async evaluateEdgeCondition(
    edge: EdgeDefinition,
    result: NodeResult<TState>,
    state: TState,
  ): Promise<boolean> {
    // Direct edges always follow
    if (edge.type === 'direct' || edge.type === 'parallel') {
      return true;
    }

    // Conditional and loop edges need condition evaluation
    if (!edge.condition) {
      return true;
    }

    const { condition } = edge;
    const context = {
      edge,
      sourceResult: result,
      graph: this.getConfig(),
    };

    switch (condition.type) {
      case 'equals':
        return this.getFieldValue(state, condition.field) === condition.value;

      case 'not_equals':
        return this.getFieldValue(state, condition.field) !== condition.value;

      case 'contains': {
        const fieldValue = this.getFieldValue(state, condition.field);
        return (
          Array.isArray(fieldValue) && fieldValue.includes(condition.value)
        );
      }

      case 'greater_than':
        return (
          (this.getFieldValue(state, condition.field) as number) >
          (condition.value as number)
        );

      case 'less_than':
        return (
          (this.getFieldValue(state, condition.field) as number) <
          (condition.value as number)
        );

      case 'exists':
        return this.getFieldValue(state, condition.field) !== undefined;

      case 'not_exists':
        return this.getFieldValue(state, condition.field) === undefined;

      case 'custom':
        if (condition.evaluate) {
          return await condition.evaluate(state, context);
        }
        return false;

      default:
        return false;
    }
  }

  private getFieldValue(state: TState, field?: string): unknown {
    if (!field) {
      return undefined;
    }

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

  private async createCheckpoint(
    state: TState,
    nodeName: string,
    executionId: string,
    stepNumber: number,
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: uuidv4(),
      executionId,
      stepNumber,
      nodeName,
      state,
      timestamp: new Date(),
    };

    if (this.checkpointer) {
      await this.checkpointer.save(checkpoint);
    }

    return checkpoint;
  }

  private createError(
    code: string,
    message: string,
    node?: string,
  ): WorkflowError {
    return {
      code,
      message,
      node,
      recoverable: ['TIMEOUT', 'RATE_LIMIT', 'NETWORK_ERROR'].includes(code),
      recoveryHints: this.getRecoveryHints(code),
    };
  }

  private normalizeError(error: unknown, node: string): WorkflowError {
    if (this.isWorkflowError(error)) {
      return error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    return {
      code: (error as { code?: string }).code ?? 'EXECUTION_ERROR',
      message: err.message,
      stack: err.stack,
      node,
      recoverable: false,
    };
  }

  private isWorkflowError(error: unknown): error is WorkflowError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'recoverable' in error
    );
  }

  private getRecoveryHints(code: string): string[] {
    const hints: Record<string, string[]> = {
      TIMEOUT: [
        'Increase timeout configuration',
        'Check network connectivity',
        'Reduce payload size',
      ],
      RATE_LIMIT: [
        'Add delay between requests',
        'Reduce concurrency',
        'Contact API provider',
      ],
      NETWORK_ERROR: [
        'Check network connectivity',
        'Verify endpoint availability',
        'Check firewall settings',
      ],
      MAX_ITERATIONS: [
        'Review loop conditions',
        'Increase maxIterations config',
        'Check for infinite loops',
      ],
      ABORTED: [
        'Execution was cancelled by user',
        'Resume from checkpoint if needed',
      ],
    };
    return hints[code] ?? [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
