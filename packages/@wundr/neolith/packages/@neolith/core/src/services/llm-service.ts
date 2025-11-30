/**
 * LLM Service - Wrapper around @adaptic/lumic-utils for Neolith
 *
 * Provides a unified interface for LLM operations including:
 * - Chat completions
 * - Streaming chat
 * - Embeddings generation
 * - Advanced features (web search, code interpreter, etc.)
 */

import { lumic } from '@adaptic/lumic-utils';
import { ChatCompletionContentPart } from 'openai/resources/chat';

import type {
  LLMOptions,
  LLMResponse,
  OpenAIModel,
  OpenAIResponseFormat,
} from '@adaptic/lumic-utils';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

/**
 * Configuration for LLM service
 */
export interface LLMServiceConfig {
  apiKey?: string;
  defaultModel?: OpenAIModel;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

/**
 * Chat message interface for simplified API
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
}

/**
 * Streaming callback function type
 */
export type StreamCallback = (chunk: string, done: boolean) => void;

/**
 * LLM Service class providing high-level LLM operations
 */
export class LLMService {
  private config: LLMServiceConfig;

  constructor(config: LLMServiceConfig = {}) {
    this.config = {
      defaultModel: 'gpt-5-mini',
      defaultTemperature: 1,
      defaultMaxTokens: 4096,
      ...config,
    };

    // Validate API key
    if (!this.config.apiKey && !process.env.OPENAI_API_KEY) {
      console.warn(
        'LLMService: No API key provided and OPENAI_API_KEY environment variable not set. LLM calls will fail.',
      );
    }
  }

  /**
   * Make a simple chat completion call
   *
   * @param prompt - The user prompt
   * @param options - Optional LLM options to override defaults
   * @returns Promise with the LLM response
   */
  async chat<T = string>(
    prompt: string,
    options: Partial<LLMOptions> = {},
  ): Promise<LLMResponse<T>> {
    const mergedOptions: LLMOptions = {
      model: this.config.defaultModel,
      temperature: this.config.defaultTemperature,
      max_completion_tokens: this.config.defaultMaxTokens,
      apiKey: this.config.apiKey,
      ...options,
    };

    return await lumic.llm.call<T>(prompt, 'text', mergedOptions);
  }

  /**
   * Make a chat completion with JSON response
   *
   * @param prompt - The user prompt
   * @param options - Optional LLM options to override defaults
   * @returns Promise with the parsed JSON response
   */
  async chatJSON<T = any>(
    prompt: string,
    options: Partial<LLMOptions> = {},
  ): Promise<LLMResponse<T>> {
    const mergedOptions: LLMOptions = {
      model: this.config.defaultModel,
      temperature: this.config.defaultTemperature,
      max_completion_tokens: this.config.defaultMaxTokens,
      apiKey: this.config.apiKey,
      ...options,
    };

    return await lumic.llm.call<T>(prompt, 'json', mergedOptions);
  }

  /**
   * Make a chat completion with structured JSON schema validation
   *
   * @param prompt - The user prompt
   * @param schema - JSON schema for response validation
   * @param options - Optional LLM options to override defaults
   * @returns Promise with the validated structured response
   */
  async chatStructured<T = any>(
    prompt: string,
    schema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    },
    options: Partial<LLMOptions> = {},
  ): Promise<LLMResponse<T>> {
    const mergedOptions: LLMOptions = {
      model: this.config.defaultModel,
      temperature: this.config.defaultTemperature,
      max_completion_tokens: this.config.defaultMaxTokens,
      apiKey: this.config.apiKey,
      ...options,
    };

    const responseFormat: OpenAIResponseFormat = {
      type: 'json_schema',
      schema,
    };

    return await lumic.llm.call<T>(prompt, responseFormat, mergedOptions);
  }

  /**
   * Make a conversational chat with message history
   *
   * @param messages - Array of chat messages
   * @param options - Optional LLM options to override defaults
   * @returns Promise with the LLM response
   */
  async chatWithHistory<T = string>(
    messages: ChatMessage[],
    options: Partial<LLMOptions> = {},
  ): Promise<LLMResponse<T>> {
    // Convert to OpenAI message format
    const context: ChatCompletionMessageParam[] = messages.map((msg) => ({
      role: msg.role === 'developer' ? 'developer' : msg.role,
      content: msg.content,
    }));

    // Take the last message as the prompt
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    const mergedOptions: LLMOptions = {
      model: this.config.defaultModel,
      temperature: this.config.defaultTemperature,
      max_completion_tokens: this.config.defaultMaxTokens,
      apiKey: this.config.apiKey,
      context: context.slice(0, -1), // All messages except the last
      ...options,
    };

    return await lumic.llm.call<T>(lastMessage.content, 'text', mergedOptions);
  }

  /**
   * Make a chat call with advanced features using Responses API
   *
   * @param prompt - The user prompt
   * @param features - Advanced features to enable
   * @param options - Optional LLM options to override defaults
   * @returns Promise with the LLM response
   */
  async chatAdvanced<T = string>(
    prompt: string,
    features: {
      useWebSearch?: boolean;
      useCodeInterpreter?: boolean;
      imageBase64?: string;
      imageDetail?: 'low' | 'high' | 'auto';
    } = {},
    options: Partial<LLMOptions> = {},
  ): Promise<LLMResponse<T>> {
    return await lumic.llm.responses<T>(prompt, {
      apiKey: this.config.apiKey || options.apiKey,
      model: options.model || this.config.defaultModel,
      responseFormat: 'text',
      useWebSearch: features.useWebSearch,
      useCodeInterpreter: features.useCodeInterpreter,
      imageBase64: features.imageBase64,
      imageDetail: features.imageDetail,
    });
  }

  /**
   * Analyze an image with AI
   *
   * @param imageBase64 - Base64 encoded image or data URL
   * @param prompt - Question or instruction about the image
   * @param options - Optional LLM options
   * @returns Promise with the image analysis response
   */
  async analyzeImage<T = string>(
    imageBase64: string,
    prompt: string = 'What is in this image?',
    options: Partial<LLMOptions> = {},
  ): Promise<LLMResponse<T>> {
    return await this.chatAdvanced<T>(
      prompt,
      {
        imageBase64,
        imageDetail: 'high',
      },
      options,
    );
  }

  /**
   * Generate embeddings for semantic search
   *
   * Note: OpenAI's chat models don't generate embeddings directly.
   * This is a placeholder for when embedding models are added to lumic-utils.
   * For now, you'll need to use OpenAI's embeddings API directly.
   *
   * @param text - Text to generate embeddings for
   * @returns Promise with the embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error(
      'Embedding generation is not yet implemented in lumic-utils. ' +
        'Please use OpenAI SDK directly with text-embedding-3-small or text-embedding-3-large models.',
    );
  }

  /**
   * Update service configuration
   *
   * @param config - Partial configuration to merge
   */
  updateConfig(config: Partial<LLMServiceConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   *
   * @returns Current service configuration
   */
  getConfig(): Readonly<LLMServiceConfig> {
    return { ...this.config };
  }
}

/**
 * Create a singleton instance of LLM service
 */
let llmServiceInstance: LLMService | null = null;

/**
 * Get or create the LLM service singleton instance
 *
 * @param config - Optional configuration for initialization
 * @returns LLM service instance
 */
export function getLLMService(config?: LLMServiceConfig): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService(config);
  } else if (config) {
    llmServiceInstance.updateConfig(config);
  }
  return llmServiceInstance;
}

/**
 * Export the lumic utilities directly for advanced use cases
 */
export { lumic };

/**
 * Re-export types from lumic-utils
 */
export type {
  LLMOptions,
  LLMResponse,
  LLMUsage,
  OpenAIModel,
  OpenAIResponseFormat,
} from '@adaptic/lumic-utils';
