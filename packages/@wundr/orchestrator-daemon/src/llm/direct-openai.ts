/**
 * Direct OpenAI SDK Wrapper
 *
 * Simple, working implementation using the official openai package.
 * Serves as a backup to @adaptic/lumic-utils.
 */

import OpenAI from 'openai';

/**
 * Parameters for LLM call
 */
export interface LLMCallParams {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Response from LLM call
 */
export interface LLMCallResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Lazy-initialized OpenAI client
 */
let openaiClient: OpenAI | null = null;

/**
 * Get or initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
    });
  }
  return openaiClient;
}

/**
 * Make a direct LLM call using OpenAI SDK
 *
 * @param params - Parameters for the LLM call
 * @returns Response with content, tool calls, and usage stats
 * @throws Error if API key is missing or API call fails
 *
 * @example
 * ```typescript
 * const response = await llmCall({
 *   model: 'gpt-4o-mini',
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   temperature: 0.7,
 *   maxTokens: 4096
 * });
 *
 * console.log(response.content);
 * console.log(`Used ${response.usage.totalTokens} tokens`);
 * ```
 */
export async function llmCall(params: LLMCallParams): Promise<LLMCallResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: params.model || 'gpt-4o-mini',
      messages: params.messages as any,
      tools: params.tools,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OpenAI API call failed: ${error.message}`);
    }
    throw new Error('OpenAI API call failed with unknown error');
  }
}

/**
 * Create a configured LLM call function with default parameters
 *
 * @param defaultModel - Default model to use
 * @param defaultTemperature - Default temperature
 * @returns Configured llmCall function
 *
 * @example
 * ```typescript
 * const fastLLM = createLLMCall('gpt-4o-mini', 0.3);
 * const response = await fastLLM({
 *   messages: [{ role: 'user', content: 'Quick question?' }]
 * });
 * ```
 */
export function createLLMCall(defaultModel?: string, defaultTemperature?: number) {
  return (params: LLMCallParams) =>
    llmCall({
      ...params,
      model: params.model || defaultModel,
      temperature: params.temperature ?? defaultTemperature,
    });
}
