/**
 * Token Counter - Token estimation and context window management
 *
 * Provides token counting (exact when possible, estimated otherwise) and
 * context window validation to prevent requests that would overflow the
 * model's context limit.
 *
 * Inspired by OpenClaw's context-window-guard.ts.
 */

import type { Message, ToolDefinition } from '../types/llm';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum context window below which we refuse to send requests */
export const CONTEXT_WINDOW_HARD_MIN_TOKENS = 16_000;

/** Context window size below which we emit a warning */
export const CONTEXT_WINDOW_WARN_BELOW_TOKENS = 32_000;

/**
 * Conservative estimate: ~4 characters per token for English text.
 * This is intentionally conservative (real ratio is often 3.5-4.5 for English)
 * to avoid underestimating and hitting context limits.
 */
const CHARS_PER_TOKEN_ESTIMATE = 4;

/**
 * Overhead per message for framing tokens (role markers, separators, etc.)
 * Different providers use ~4-8 tokens per message for framing.
 */
const MESSAGE_FRAMING_TOKENS = 6;

/**
 * Overhead per tool definition (name, description, schema serialization).
 * Tool schemas are typically 50-200 tokens each.
 */
const TOOL_DEFINITION_BASE_TOKENS = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextWindowSource =
  | 'model_catalog'
  | 'config_override'
  | 'cap'
  | 'default';

export interface ContextWindowInfo {
  tokens: number;
  source: ContextWindowSource;
}

export interface ContextValidation {
  /** Estimated total tokens for the request */
  totalEstimatedTokens: number;
  /** Model's context window size */
  contextWindow: number;
  /** Remaining capacity after estimated tokens */
  remainingCapacity: number;
  /** Whether the request fits in the context window */
  canFit: boolean;
  /** Warning: remaining capacity below WARN threshold */
  shouldWarn: boolean;
  /** Block: remaining capacity below HARD_MIN threshold */
  shouldBlock: boolean;
  /** Actionable recommendation if the context is tight */
  recommendation?: string;
}

export interface TokenEstimate {
  /** Total estimated tokens */
  total: number;
  /** Breakdown by component */
  breakdown: {
    systemPrompt: number;
    messages: number;
    toolDefinitions: number;
    reservedForOutput: number;
  };
}

export interface TokenCounterConfig {
  /** Override the hard minimum tokens threshold */
  hardMinTokens?: number;
  /** Override the warning threshold */
  warnBelowTokens?: number;
  /** Global context window cap */
  capTokens?: number;
}

// ---------------------------------------------------------------------------
// TokenCounter class
// ---------------------------------------------------------------------------

export class TokenCounter {
  private readonly hardMinTokens: number;
  private readonly warnBelowTokens: number;
  private readonly capTokens: number | null;

  /** Optional tiktoken encoder for exact OpenAI token counts */
  private tiktokenEncoder: { encode: (text: string) => { length: number }; free: () => void } | null = null;
  private tiktokenLoadAttempted = false;

  constructor(config?: TokenCounterConfig) {
    this.hardMinTokens = config?.hardMinTokens ?? CONTEXT_WINDOW_HARD_MIN_TOKENS;
    this.warnBelowTokens = config?.warnBelowTokens ?? CONTEXT_WINDOW_WARN_BELOW_TOKENS;
    this.capTokens = config?.capTokens ?? null;
  }

  // -------------------------------------------------------------------------
  // Token estimation
  // -------------------------------------------------------------------------

  /**
   * Estimate token count for a string of text.
   */
  estimateTextTokens(text: string): number {
    if (!text) {
      return 0;
    }
    return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
  }

  /**
   * Estimate token count for an array of messages.
   */
  estimateMessageTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      // Message content
      total += this.estimateTextTokens(msg.content);
      // Message framing overhead
      total += MESSAGE_FRAMING_TOKENS;
      // Tool calls within message
      if (msg.toolCalls) {
        total += this.estimateTextTokens(JSON.stringify(msg.toolCalls));
      }
    }
    return total;
  }

  /**
   * Estimate token count for tool definitions.
   */
  estimateToolDefinitionTokens(tools: ToolDefinition[]): number {
    let total = 0;
    for (const tool of tools) {
      total += TOOL_DEFINITION_BASE_TOKENS;
      total += this.estimateTextTokens(tool.name);
      total += this.estimateTextTokens(tool.description);
      total += this.estimateTextTokens(JSON.stringify(tool.inputSchema));
    }
    return total;
  }

  /**
   * Build a complete token estimate for a request.
   */
  estimateRequest(params: {
    systemPrompt?: string;
    messages: Message[];
    tools?: ToolDefinition[];
    maxOutputTokens?: number;
  }): TokenEstimate {
    const systemPromptTokens = params.systemPrompt
      ? this.estimateTextTokens(params.systemPrompt) + MESSAGE_FRAMING_TOKENS
      : 0;

    const messageTokens = this.estimateMessageTokens(params.messages);

    const toolDefinitionTokens = params.tools
      ? this.estimateToolDefinitionTokens(params.tools)
      : 0;

    // Reserve space for the model's output
    const reservedForOutput = params.maxOutputTokens ?? 4_096;

    const total = systemPromptTokens + messageTokens + toolDefinitionTokens + reservedForOutput;

    return {
      total,
      breakdown: {
        systemPrompt: systemPromptTokens,
        messages: messageTokens,
        toolDefinitions: toolDefinitionTokens,
        reservedForOutput,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Context window management
  // -------------------------------------------------------------------------

  /**
   * Resolve the effective context window for a model, considering catalog
   * values, config overrides, and global caps.
   */
  resolveContextWindow(params: {
    modelContextWindow?: number;
    configOverride?: number;
  }): ContextWindowInfo {
    // Priority: configOverride > modelContextWindow > default
    let tokens: number;
    let source: ContextWindowSource;

    if (params.configOverride && params.configOverride > 0) {
      tokens = params.configOverride;
      source = 'config_override';
    } else if (params.modelContextWindow && params.modelContextWindow > 0) {
      tokens = params.modelContextWindow;
      source = 'model_catalog';
    } else {
      tokens = 128_000;
      source = 'default';
    }

    // Apply global cap if configured and smaller
    if (this.capTokens !== null && this.capTokens > 0 && this.capTokens < tokens) {
      tokens = this.capTokens;
      source = 'cap';
    }

    return { tokens: Math.floor(tokens), source };
  }

  /**
   * Validate whether a request fits within the context window.
   */
  validateContextWindow(params: {
    estimate: TokenEstimate;
    contextWindow: number;
  }): ContextValidation {
    const { estimate, contextWindow } = params;
    const remainingCapacity = contextWindow - estimate.total;
    const canFit = remainingCapacity >= 0;
    const shouldWarn = remainingCapacity < this.warnBelowTokens && remainingCapacity >= 0;
    const shouldBlock = contextWindow < this.hardMinTokens || remainingCapacity < 0;

    let recommendation: string | undefined;
    if (shouldBlock && remainingCapacity < 0) {
      const overshoot = Math.abs(remainingCapacity);
      recommendation = `Request exceeds context window by ~${overshoot.toLocaleString()} tokens. ` +
        'Consider compacting conversation history or using a model with a larger context window.';
    } else if (shouldWarn) {
      recommendation = `Only ~${remainingCapacity.toLocaleString()} tokens remaining in context window. ` +
        'Consider summarizing earlier messages to free space.';
    }

    return {
      totalEstimatedTokens: estimate.total,
      contextWindow,
      remainingCapacity,
      canFit,
      shouldWarn,
      shouldBlock,
      recommendation,
    };
  }

  /**
   * Combined estimate + validation in one call (convenience method).
   */
  checkRequest(params: {
    systemPrompt?: string;
    messages: Message[];
    tools?: ToolDefinition[];
    maxOutputTokens?: number;
    contextWindow: number;
  }): ContextValidation {
    const estimate = this.estimateRequest({
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      tools: params.tools,
      maxOutputTokens: params.maxOutputTokens,
    });
    return this.validateContextWindow({
      estimate,
      contextWindow: params.contextWindow,
    });
  }

  // -------------------------------------------------------------------------
  // Exact token counting (when available)
  // -------------------------------------------------------------------------

  /**
   * Attempt to get an exact token count using tiktoken (for OpenAI models).
   * Falls back to estimation if tiktoken is not available.
   */
  async countTokensExact(text: string, model: string): Promise<number> {
    const encoder = await this.loadTiktoken(model);
    if (encoder) {
      try {
        return encoder.encode(text).length;
      } catch {
        // Fall back to estimation on encoding errors
      }
    }
    return this.estimateTextTokens(text);
  }

  /**
   * Lazily load tiktoken encoder. Only attempts once to avoid repeated
   * import failures in environments where tiktoken is not installed.
   */
  private async loadTiktoken(
    model: string,
  ): Promise<{ encode: (text: string) => { length: number } } | null> {
    if (this.tiktokenEncoder) {
      return this.tiktokenEncoder;
    }
    if (this.tiktokenLoadAttempted) {
      return null;
    }
    this.tiktokenLoadAttempted = true;

    try {
      const { encoding_for_model } = await import('tiktoken');
      this.tiktokenEncoder = encoding_for_model(model as never);
      return this.tiktokenEncoder;
    } catch {
      // tiktoken not available, that is fine
      return null;
    }
  }

  /**
   * Clean up resources (tiktoken encoder).
   */
  destroy(): void {
    if (this.tiktokenEncoder && 'free' in this.tiktokenEncoder) {
      this.tiktokenEncoder.free();
    }
    this.tiktokenEncoder = null;
  }
}
