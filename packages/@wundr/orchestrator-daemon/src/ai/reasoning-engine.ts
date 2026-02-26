/**
 * AI Reasoning Engine for Orchestrator Daemon
 *
 * Wraps the LLMClient with orchestration logic to support multi-step, auditable
 * reasoning using a ReAct-style loop (Think -> Act -> Observe -> Decide).
 *
 * Core capabilities:
 * - Multi-step reasoning with configurable depth limits
 * - Tool execution via an injected ToolRegistry
 * - Chain-of-thought prompting
 * - Task planning and constraint-aware execution plans
 * - Action evaluation with risk scoring
 * - Summarisation helpers
 */

import { randomUUID } from 'crypto';

import type { LLMClient, Message, ToolCall } from '../types/llm';
import type { ToolRegistry } from './tool-registry';
import { DefaultToolRegistry } from './tool-registry';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration options for the ReasoningEngine.
 */
export interface ReasoningConfig {
  /** LLM model identifier to use for all calls. Defaults to 'gpt-4o-mini'. */
  model?: string;
  /** Sampling temperature (0.0 – 2.0). Defaults to 0.2 for deterministic reasoning. */
  temperature?: number;
  /** Maximum number of reasoning steps before the engine forces a final answer. Defaults to 8. */
  maxReasoningSteps?: number;
  /** System prompt injected at the start of every conversation. */
  systemPrompt?: string;
  /** When true, the engine requests explicit chain-of-thought from the LLM. Defaults to true. */
  enableChainOfThought?: boolean;
  /** Tool registry providing callable tools for the ReAct loop. */
  toolRegistry?: ToolRegistry;
}

/**
 * A single step captured during a reasoning run.
 */
export interface ReasoningStep {
  /** Unique identifier for this step. */
  id: string;
  /** Semantic type of this step within the ReAct loop. */
  type: 'thought' | 'action' | 'observation' | 'decision';
  /** Human-readable content for this step. */
  content: string;
  /** Tool calls made during this step, if any. */
  toolCalls?: ToolCall[];
  /** Wall-clock timestamp when this step was recorded. */
  timestamp: Date;
  /** Arbitrary metadata for debugging or downstream processing. */
  metadata?: Record<string, unknown>;
}

/**
 * Final output of a completed reasoning run.
 */
export interface ReasoningResult {
  /** The final decision or answer reached by the engine. */
  decision: string;
  /**
   * Confidence score between 0 and 1.
   * Derived heuristically from finish reason and step trajectory.
   */
  confidence: number;
  /** Ordered list of all steps taken to reach the decision. */
  steps: ReasoningStep[];
  /** Total LLM tokens consumed across all calls in this run. */
  totalTokensUsed: number;
  /** Wall-clock duration of the entire reasoning run in milliseconds. */
  durationMs: number;
}

/**
 * Result of an action evaluation.
 */
export interface ActionEvaluation {
  /** Whether the engine recommends proceeding with the action. */
  approved: boolean;
  /** Plain-text reasoning behind the approval or rejection. */
  reasoning: string;
  /** Assessed risk level. */
  riskLevel: 'low' | 'medium' | 'high';
  /** Alternative actions suggested when the evaluated action is rejected or high-risk. */
  alternatives?: string[];
}

// =============================================================================
// ReasoningEngine
// =============================================================================

/**
 * AI reasoning engine that wraps an LLMClient with orchestration logic.
 *
 * @example
 * ```typescript
 * const client = createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
 * const engine = new ReasoningEngine(client, { model: 'gpt-4o', maxReasoningSteps: 6 });
 *
 * const result = await engine.reason('Should we rebalance the portfolio today?', {
 *   portfolioValue: 1_000_000,
 *   currentAllocation: { equities: 0.6, bonds: 0.4 },
 * });
 *
 * console.log(result.decision);   // Final recommendation
 * console.log(result.confidence); // e.g. 0.85
 * console.log(result.steps);      // Full audit trail
 * ```
 */
export class ReasoningEngine {
  private readonly client: LLMClient;
  private readonly config: Required<Omit<ReasoningConfig, 'toolRegistry'>>;
  private readonly toolRegistry: ToolRegistry;

  constructor(client: LLMClient, config: ReasoningConfig = {}) {
    this.client = client;
    this.config = {
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.2,
      maxReasoningSteps: config.maxReasoningSteps ?? 8,
      systemPrompt: config.systemPrompt ?? this.defaultSystemPrompt(),
      enableChainOfThought: config.enableChainOfThought ?? true,
    };
    this.toolRegistry = config.toolRegistry ?? new DefaultToolRegistry();
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Runs a ReAct-style reasoning loop to answer `prompt`.
   *
   * The loop proceeds as:
   * 1. Think: ask the LLM what it needs to know or do next.
   * 2. Act: if the LLM calls a tool, execute it and record the observation.
   * 3. Repeat until the LLM produces a final answer or `maxReasoningSteps` is reached.
   * 4. Decide: extract the final answer from the last LLM response.
   *
   * @param prompt - The question or task to reason about.
   * @param context - Optional key/value context injected into the user message.
   * @returns A ReasoningResult containing the decision, confidence, and full step trace.
   */
  async reason(
    prompt: string,
    context?: Record<string, unknown>,
  ): Promise<ReasoningResult> {
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    let totalTokens = 0;

    const messages: Message[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: this.buildUserMessage(prompt, context) },
    ];

    const toolDefs = this.toolRegistry.toToolDefinitions();
    let stepCount = 0;
    let finalContent = '';

    while (stepCount < this.config.maxReasoningSteps) {
      stepCount++;

      const response = await this.client.chat({
        model: this.config.model,
        temperature: this.config.temperature,
        messages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
      });

      totalTokens += response.usage.totalTokens;

      // Record thought step
      if (response.content) {
        steps.push(this.makeStep('thought', response.content));
        finalContent = response.content;
      }

      // Handle tool calls (Act + Observe)
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Record the action step
        const actionContent = response.toolCalls
          .map(tc => `${tc.name}(${tc.arguments})`)
          .join('\n');

        steps.push(
          this.makeStep('action', actionContent, { toolCalls: response.toolCalls }),
        );

        // Append assistant message with tool calls to conversation
        messages.push({
          role: 'assistant',
          content: response.content ?? '',
          toolCalls: response.toolCalls,
        });

        // Execute each tool and add observations
        for (const toolCall of response.toolCalls) {
          const observation = await this.executeToolCall(toolCall);
          const observationText = typeof observation === 'string'
            ? observation
            : JSON.stringify(observation, null, 2);

          steps.push(
            this.makeStep('observation', observationText, { toolName: toolCall.name }),
          );

          // Add tool result to conversation
          messages.push({
            role: 'tool',
            content: observationText,
            toolCallId: toolCall.id,
          });
        }

        // Continue the loop to let the LLM process observations
        continue;
      }

      // No tool calls means the LLM has reached a final answer
      if (response.finishReason === 'stop' || response.finishReason === 'length') {
        break;
      }
    }

    // Append assistant response only if no tool calls were present on last turn
    messages.push({ role: 'assistant', content: finalContent });

    const decision = this.extractDecision(finalContent);
    const confidence = this.estimateConfidence(steps, stepCount);

    steps.push(this.makeStep('decision', decision));

    return {
      decision,
      confidence,
      steps,
      totalTokensUsed: totalTokens,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Generates a structured execution plan for a described task.
   *
   * The plan is produced by reasoning about the goal and any constraints,
   * then parsing the LLM's structured output into a ReasoningResult whose
   * `decision` field contains the serialised plan.
   *
   * @param taskDescription - Natural-language description of the task to plan.
   * @param constraints - Optional list of constraints the plan must respect.
   * @returns A ReasoningResult; inspect `result.decision` for the plan text.
   */
  async planTask(
    taskDescription: string,
    constraints?: string[],
  ): Promise<ReasoningResult> {
    const constraintText = constraints && constraints.length > 0
      ? `\n\nConstraints that the plan MUST respect:\n${constraints.map(c => `- ${c}`).join('\n')}`
      : '';

    const prompt =
      `Create a detailed, step-by-step execution plan for the following task.\n\n` +
      `Task: ${taskDescription}${constraintText}\n\n` +
      `Return a numbered list of concrete steps. Each step must include:\n` +
      `- A clear action description\n` +
      `- Any dependencies on previous steps\n` +
      `- The expected output or success criterion`;

    return this.reason(prompt, { taskDescription, constraints });
  }

  /**
   * Evaluates whether a proposed action should be taken given the current context.
   *
   * The LLM is asked to reason about the action's risks, benefits, and alternatives
   * before returning a structured evaluation.
   *
   * @param action - Description of the action to evaluate.
   * @param context - Key/value context relevant to the evaluation.
   * @returns An ActionEvaluation with approval status, reasoning, risk level, and alternatives.
   */
  async evaluateAction(
    action: string,
    context: Record<string, unknown>,
  ): Promise<ActionEvaluation> {
    const prompt =
      `Evaluate the following action and decide whether it should be approved.\n\n` +
      `Action: ${action}\n\n` +
      `Respond with a JSON object containing:\n` +
      `{\n` +
      `  "approved": boolean,\n` +
      `  "reasoning": "string",\n` +
      `  "riskLevel": "low" | "medium" | "high",\n` +
      `  "alternatives": ["string"] (optional, only when not approved or risk is high)\n` +
      `}\n\n` +
      `Be concise. Do not include any text outside the JSON object.`;

    const result = await this.reason(prompt, context);

    try {
      // Strip markdown code fences if the LLM wrapped the JSON
      const cleaned = result.decision
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      const parsed = JSON.parse(cleaned) as Partial<ActionEvaluation>;

      return {
        approved: parsed.approved ?? false,
        reasoning: parsed.reasoning ?? result.decision,
        riskLevel: parsed.riskLevel ?? 'medium',
        alternatives: parsed.alternatives,
      };
    } catch {
      // Fallback: treat the raw decision as the reasoning
      return {
        approved: false,
        reasoning: result.decision,
        riskLevel: 'high',
      };
    }
  }

  /**
   * Summarises the provided content using the LLM.
   *
   * @param content - The text to summarise.
   * @param options - Optional formatting options.
   * @param options.maxLength - Approximate maximum character length of the summary.
   * @param options.format - Output format: 'bullets' for a bullet list, 'paragraph' for prose.
   * @returns The summarised text.
   */
  async summarize(
    content: string,
    options?: { maxLength?: number; format?: 'bullets' | 'paragraph' },
  ): Promise<string> {
    const format = options?.format ?? 'paragraph';
    const lengthGuide = options?.maxLength
      ? ` Keep the summary under ${options.maxLength} characters.`
      : '';

    const formatInstruction = format === 'bullets'
      ? 'Use a concise bullet-point list.'
      : 'Write a concise prose paragraph.';

    const response = await this.client.chat({
      model: this.config.model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a summarisation assistant. ${formatInstruction}${lengthGuide} ` +
                   'Return only the summary, with no preamble or explanation.',
        },
        {
          role: 'user',
          content: `Summarise the following content:\n\n${content}`,
        },
      ],
    });

    return response.content.trim();
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Builds the system prompt, optionally prepending chain-of-thought instructions.
   */
  private buildSystemPrompt(): string {
    const cot = this.config.enableChainOfThought
      ? '\n\nWhen reasoning, think step by step. ' +
        'Show your thought process before giving a final answer. ' +
        'If you need to call a tool, do so and wait for the result before continuing.'
      : '';

    return `${this.config.systemPrompt}${cot}`;
  }

  /**
   * Constructs the user-facing message, embedding any additional context as JSON.
   */
  private buildUserMessage(
    prompt: string,
    context?: Record<string, unknown>,
  ): string {
    if (!context || Object.keys(context).length === 0) {
      return prompt;
    }

    return `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;
  }

  /**
   * Attempts to execute a tool call.
   * Returns an error description string instead of throwing so the
   * LLM can reason about failures gracefully.
   */
  private async executeToolCall(toolCall: ToolCall): Promise<unknown> {
    try {
      const args = JSON.parse(toolCall.arguments) as Record<string, unknown>;
      return await this.toolRegistry.execute(toolCall.name, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }
  }

  /**
   * Extracts a clean decision string from the LLM's final response.
   * Strips common prefixes such as "Decision:", "Answer:", "Final answer:".
   */
  private extractDecision(content: string): string {
    const prefixPattern = /^(?:decision|answer|final\s+answer|conclusion)\s*:\s*/i;
    return content.replace(prefixPattern, '').trim();
  }

  /**
   * Heuristically estimates a confidence score [0, 1] based on the step
   * count relative to the maximum and whether tool calls were resolved.
   */
  private estimateConfidence(
    steps: ReasoningStep[],
    stepCount: number,
  ): number {
    // Start at high confidence and subtract for each heuristic signal
    let confidence = 0.9;

    // Penalise for hitting the step limit
    if (stepCount >= this.config.maxReasoningSteps) {
      confidence -= 0.3;
    }

    // Penalise if any tool execution returned an error
    const hasToolErrors = steps.some(
      s => s.type === 'observation' && s.content.includes('"error"'),
    );
    if (hasToolErrors) {
      confidence -= 0.2;
    }

    // Penalise for a very short decision (likely incomplete)
    const decisionStep = [...steps].reverse().find((s: ReasoningStep) => s.type === 'thought');
    if (decisionStep && decisionStep.content.length < 50) {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Creates a new ReasoningStep with a generated ID and the current timestamp.
   */
  private makeStep(
    type: ReasoningStep['type'],
    content: string,
    metadata?: Record<string, unknown>,
  ): ReasoningStep {
    return {
      id: randomUUID(),
      type,
      content,
      toolCalls: metadata?.toolCalls as ToolCall[] | undefined,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Returns the built-in default system prompt used when none is provided.
   */
  private defaultSystemPrompt(): string {
    return (
      'You are an intelligent orchestration engine for Adaptic.ai, ' +
      'an AI-managed tokenised hedge fund platform. ' +
      'Your role is to reason carefully, use available tools when needed, ' +
      'and produce clear, concise decisions that can be audited and acted upon. ' +
      'Always prefer factual grounding over speculation. ' +
      'When uncertain, acknowledge uncertainty explicitly.'
    );
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates a ReasoningEngine backed by the provided LLMClient.
 *
 * @param client - LLMClient instance to use for all LLM calls.
 * @param config - Optional configuration overrides.
 */
export function createReasoningEngine(
  client: LLMClient,
  config?: ReasoningConfig,
): ReasoningEngine {
  return new ReasoningEngine(client, config);
}
