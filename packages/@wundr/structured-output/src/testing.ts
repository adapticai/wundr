/**
 * @wundr.io/structured-output - Test Utilities
 *
 * Mock LLM providers for use in tests. Import from this module in test files:
 *
 * @example
 * ```typescript
 * import { createMockLLMProvider, createMockStreamingProvider } from '@wundr.io/structured-output/testing';
 * ```
 *
 * Do NOT import these from the main package entry point.
 */

import { sleep } from './retry-strategies';

import type {
  InstructorConfig,
  LLMProvider,
  StreamingLLMProvider,
  StreamChunk,
} from './types';

/**
 * Create a mock LLM provider for testing.
 *
 * Accepts a fixed string response, an array of responses to cycle through,
 * or a function that receives the prompt and returns a string.
 */
export function createMockLLMProvider(
  responses: string | string[] | ((prompt: string) => string)
): LLMProvider {
  let responseIndex = 0;
  const responseArray = Array.isArray(responses)
    ? responses
    : typeof responses === 'string'
      ? [responses]
      : [];

  return async (
    prompt: string,
    _systemPrompt: string,
    config: InstructorConfig
  ) => {
    let content: string;

    if (typeof responses === 'function') {
      content = responses(prompt);
    } else {
      content = responseArray[responseIndex % responseArray.length] ?? '';
      responseIndex++;
    }

    return {
      content,
      model: config.model,
      usage: {
        promptTokens: Math.round(prompt.length / 4),
        completionTokens: Math.round(content.length / 4),
        totalTokens: Math.round((prompt.length + content.length) / 4),
      },
    };
  };
}

/**
 * Create a mock streaming provider for testing.
 *
 * Splits the response into chunks of `chunkSize` characters and yields them
 * with a short simulated delay between each chunk.
 */
export function createMockStreamingProvider(
  response: string,
  chunkSize = 10
): StreamingLLMProvider {
  return async function* (
    _prompt: string,
    _systemPrompt: string,
    _config: InstructorConfig
  ): AsyncIterable<StreamChunk> {
    let accumulated = '';

    for (let i = 0; i < response.length; i += chunkSize) {
      const delta = response.substring(i, i + chunkSize);
      accumulated += delta;

      yield {
        delta,
        accumulated,
        isFinal: i + chunkSize >= response.length,
      };

      // Simulate streaming delay
      await sleep(10);
    }
  };
}
