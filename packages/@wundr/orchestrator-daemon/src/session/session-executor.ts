/**
 * Session Executor - Executes agent sessions using LLM clients and MCP tools
 *
 * Orchestrates the execution of tasks within a session, managing:
 * - LLM interactions with context building
 * - Tool call handling and execution
 * - Token usage tracking
 * - Session state management
 */

import { EventEmitter } from 'eventemitter3';

import { ToolExecutor } from './tool-executor';
import { Logger } from '../utils/logger';

import type { Session, Task, SessionMetrics, MemoryEntry } from '../types';
import type { McpToolRegistry } from './tool-executor';
import type {
  LLMClient,
  ChatParams,
  Message,
  ToolDefinition,
} from '../types/llm';

/**
 * Session execution options
 */
export interface SessionExecutionOptions {
  /** Maximum number of tool call iterations (prevent infinite loops) */
  maxIterations?: number;
  /** Model to use for the session */
  model?: string;
  /** Temperature for LLM sampling */
  temperature?: number;
  /** Maximum tokens per response */
  maxTokens?: number;
  /** System prompt override */
  systemPrompt?: string;
  /** Enable streaming responses */
  streaming?: boolean;
  /** User message to send */
  userMessage?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Session execution result
 */
export interface SessionExecutionResult {
  success: boolean;
  output: string;
  tokensUsed: number;
  iterations: number;
  executionTime: number;
  toolCallsMade: number;
  error?: string;
}

/**
 * Session Executor class
 */
export class SessionExecutor extends EventEmitter {
  private logger: Logger;
  private llmClient: LLMClient;
  private toolExecutor: ToolExecutor;
  private mcpRegistry: McpToolRegistry;

  // Default execution options
  private readonly DEFAULT_OPTIONS: Required<SessionExecutionOptions> = {
    maxIterations: 10,
    model: 'gpt-5-mini',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: this.buildDefaultSystemPrompt(),
    streaming: false,
    userMessage: '',
    context: {},
  };

  constructor(llmClient: LLMClient, mcpRegistry: McpToolRegistry) {
    super();
    this.logger = new Logger('SessionExecutor');
    this.llmClient = llmClient;
    this.mcpRegistry = mcpRegistry;
    this.toolExecutor = new ToolExecutor(mcpRegistry);
  }

  /**
   * Execute a session with the given task
   */
  async executeSession(
    session: Session,
    task: Task,
    options?: SessionExecutionOptions,
  ): Promise<SessionExecutionResult> {
    const startTime = Date.now();
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    this.logger.info(
      `Starting session execution: ${session.id} for task: ${task.id}`,
    );

    try {
      // Build initial messages with context
      const messages = this.buildInitialMessages(session, task, opts);

      // Get available tools
      const tools = this.getAvailableToolDefinitions();

      // Execute conversation loop with tool calls
      const currentMessages = messages;
      let iterations = 0;
      let totalTokens = 0;
      let toolCallsMade = 0;
      let finalOutput = '';

      while (iterations < opts.maxIterations) {
        iterations++;
        this.logger.debug(`Iteration ${iterations}/${opts.maxIterations}`);

        // Call LLM
        const chatParams: ChatParams = {
          model: opts.model,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
        };

        const response = await this.llmClient.chat(chatParams);

        // Track tokens
        totalTokens += response.usage.totalTokens;

        // Add assistant response to messages
        currentMessages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        });

        finalOutput = response.content;

        // Emit progress event
        this.emit('session:progress', {
          session,
          iteration: iterations,
          response: response.content,
          tokensUsed: totalTokens,
        });

        // Check if we have tool calls to execute
        if (
          response.toolCalls &&
          response.toolCalls.length > 0 &&
          response.finishReason === 'tool_calls'
        ) {
          this.logger.info(
            `Executing ${response.toolCalls.length} tool calls`,
          );

          // Execute tool calls
          const toolResults =
            await this.toolExecutor.executeToolCalls(response.toolCalls);
          toolCallsMade += response.toolCalls.length;

          // Convert results to messages
          const toolMessages =
            this.toolExecutor.convertResultsToMessages(toolResults);

          // Add tool results to conversation
          currentMessages.push(...toolMessages);

          // Emit tool execution event
          this.emit('session:tools_executed', {
            session,
            toolResults,
          });

          // Continue loop to let LLM process tool results
          continue;
        }

        // No more tool calls, execution complete
        break;
      }

      const executionTime = Date.now() - startTime;

      this.logger.info(
        `Session execution completed: ${session.id} in ${executionTime}ms, ${iterations} iterations, ${toolCallsMade} tool calls`,
      );

      return {
        success: true,
        output: finalOutput,
        tokensUsed: totalTokens,
        iterations,
        executionTime,
        toolCallsMade,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Session execution failed: ${session.id}`,
        error,
      );

      return {
        success: false,
        output: '',
        tokensUsed: 0,
        iterations: 0,
        executionTime,
        toolCallsMade: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Build initial messages for the session
   */
  private buildInitialMessages(
    session: Session,
    task: Task,
    options: Required<SessionExecutionOptions>,
  ): Message[] {
    const messages: Message[] = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: options.systemPrompt,
    });

    // Add context from session memory (episodic and semantic)
    const contextMessages = this.buildContextMessages(session);
    messages.push(...contextMessages);

    // Add current task
    messages.push({
      role: 'user',
      content: this.formatTaskMessage(task),
    });

    return messages;
  }

  /**
   * Build context messages from session memory
   */
  private buildContextMessages(session: Session): Message[] {
    const messages: Message[] = [];

    // Add recent episodic memories (conversation history)
    if (
      session.memoryContext.episodic &&
      session.memoryContext.episodic.length > 0
    ) {
      const recentEpisodic = session.memoryContext.episodic
        .slice(-5) // Last 5 entries
        .filter((entry) => entry.type === 'interaction');

      if (recentEpisodic.length > 0) {
        const contextContent = recentEpisodic
          .map((entry) => `[${entry.timestamp.toISOString()}] ${entry.content}`)
          .join('\n');

        messages.push({
          role: 'user',
          content: `Previous context:\n${contextContent}`,
        });
      }
    }

    // Add relevant semantic knowledge
    if (
      session.memoryContext.semantic &&
      session.memoryContext.semantic.length > 0
    ) {
      const relevantKnowledge = session.memoryContext.semantic
        .filter((entry) => entry.type === 'knowledge')
        .slice(-3); // Last 3 knowledge entries

      if (relevantKnowledge.length > 0) {
        const knowledgeContent = relevantKnowledge
          .map((entry) => entry.content)
          .join('\n');

        messages.push({
          role: 'user',
          content: `Relevant knowledge:\n${knowledgeContent}`,
        });
      }
    }

    return messages;
  }

  /**
   * Format task as a message
   */
  private formatTaskMessage(task: Task): string {
    return `Task: ${task.description}

Type: ${task.type}
Priority: ${task.priority}
Status: ${task.status}

${task.metadata ? `Additional context:\n${JSON.stringify(task.metadata, null, 2)}` : ''}

Please analyze this task and execute it using the available tools. Provide a comprehensive response with your findings and actions taken.`;
  }

  /**
   * Get available tool definitions for LLM
   */
  private getAvailableToolDefinitions(): ToolDefinition[] {
    // Get available tools from registry
    const availableTools = this.toolExecutor.getAvailableTools();

    // Convert to LLM tool definitions
    // For now, return a basic set of common MCP tools
    // This should be extended to dynamically get tool schemas from MCP registry
    return this.buildStandardToolDefinitions(availableTools);
  }

  /**
   * Build standard tool definitions for common MCP tools
   */
  private buildStandardToolDefinitions(
    toolNames: string[],
  ): ToolDefinition[] {
    const standardTools: ToolDefinition[] = [
      {
        name: 'drift_detection',
        description: 'Monitor code quality drift and create baselines',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['check', 'baseline', 'trends'],
            },
            path: { type: 'string' },
          },
          required: ['operation'],
        },
      },
      {
        name: 'pattern_standardize',
        description: 'Automatically fix and standardize code patterns',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['fix', 'review', 'apply'],
            },
            pattern: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['operation'],
        },
      },
      {
        name: 'dependency_analyze',
        description: 'Analyze project dependencies and detect issues',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['circular', 'unused', 'graph'],
            },
            path: { type: 'string' },
          },
          required: ['operation'],
        },
      },
    ];

    // Filter to only include tools that are available
    if (toolNames.length > 0) {
      return standardTools.filter((tool) => toolNames.includes(tool.name));
    }

    return standardTools;
  }

  /**
   * Build default system prompt
   */
  private buildDefaultSystemPrompt(): string {
    return `You are an AI assistant integrated with the Wundr orchestrator system. You have access to various tools and capabilities through MCP (Model Context Protocol) integrations.

Your role is to:
1. Analyze tasks and break them down into actionable steps
2. Use available tools to gather information and execute actions
3. Provide clear, comprehensive responses
4. Track your progress and report results

When using tools:
- Choose the most appropriate tool for each step
- Parse tool results carefully and use them to inform your next actions
- If a tool fails, try alternative approaches
- Always provide context about what you're doing and why

Be proactive, thorough, and clear in your communication.`;
  }

  /**
   * Update session metrics based on execution result
   */
  updateSessionMetrics(
    session: Session,
    result: SessionExecutionResult,
  ): void {
    const metrics: Partial<SessionMetrics> = {
      tokensUsed: session.metrics.tokensUsed + result.tokensUsed,
      duration: session.metrics.duration + result.executionTime,
      tasksCompleted: result.success
        ? session.metrics.tasksCompleted + 1
        : session.metrics.tasksCompleted,
      errorsEncountered: result.success
        ? session.metrics.errorsEncountered
        : session.metrics.errorsEncountered + 1,
      averageResponseTime:
        (session.metrics.averageResponseTime + result.executionTime) / 2,
    };

    Object.assign(session.metrics, metrics);

    this.emit('session:metrics_updated', { session, metrics });
  }

  /**
   * Add execution result to session memory
   */
  addToSessionMemory(
    session: Session,
    task: Task,
    result: SessionExecutionResult,
  ): void {
    // Add to episodic memory
    const episodicEntry: MemoryEntry = {
      id: `memory_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      content: `Task: ${task.description}\nResult: ${result.output}`,
      timestamp: new Date(),
      type: 'interaction',
      metadata: {
        taskId: task.id,
        tokensUsed: result.tokensUsed,
        toolCallsMade: result.toolCallsMade,
        success: result.success,
      },
    };

    session.memoryContext.episodic.push(episodicEntry);

    // Trim episodic memory if too large (keep last 20 entries)
    if (session.memoryContext.episodic.length > 20) {
      session.memoryContext.episodic =
        session.memoryContext.episodic.slice(-20);
    }

    this.emit('session:memory_updated', { session, entry: episodicEntry });
  }
}
