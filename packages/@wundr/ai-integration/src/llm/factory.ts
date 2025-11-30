/**
 * LLM Client Factory
 *
 * Factory function for creating LLM client instances with auto-detection and validation.
 */

import {
  LLMClient,
  LLMClientConfig,
  LLMInvalidRequestError,
  LLMAuthenticationError,
} from './client';
import {
  LLMProvider,
  LLMProviderConfig,
  detectProvider,
  validateModel,
  getDefaultProviderConfig,
  getApiKeyFromEnv,
} from './config';

/**
 * Extended configuration for creating an LLM client
 */
export interface CreateLLMClientConfig extends LLMClientConfig {
  /** Provider type (auto-detected from model if not specified) */
  provider?: LLMProvider;
  /** Model to use (required for auto-detection) */
  model?: string;
}

/**
 * Validate LLM client configuration
 *
 * @param config - Configuration to validate
 * @throws LLMInvalidRequestError if configuration is invalid
 * @throws LLMAuthenticationError if API key is missing
 */
function validateConfig(config: CreateLLMClientConfig): void {
  // Validate API key
  if (!config.apiKey) {
    throw new LLMAuthenticationError(
      'API key is required. Provide it in config or set the appropriate environment variable.',
      config.provider
    );
  }

  // Validate provider
  if (config.provider && !['openai', 'anthropic', 'azure', 'custom'].includes(config.provider)) {
    throw new LLMInvalidRequestError(
      `Invalid provider: ${config.provider}. Supported providers: openai, anthropic, azure, custom`,
      config.provider
    );
  }

  // Validate model if provided
  if (config.model && config.provider !== 'custom') {
    try {
      validateModel(config.model);
    } catch (error) {
      if (error instanceof Error) {
        throw new LLMInvalidRequestError(error.message, config.provider);
      }
      throw error;
    }
  }

  // Validate timeout
  if (config.timeout !== undefined && config.timeout <= 0) {
    throw new LLMInvalidRequestError(
      'Timeout must be a positive number',
      config.provider
    );
  }

  // Validate max retries
  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    throw new LLMInvalidRequestError(
      'Max retries must be a non-negative number',
      config.provider
    );
  }
}

/**
 * Merge configuration with provider defaults
 *
 * @param config - User-provided configuration
 * @returns Merged configuration with defaults
 */
function mergeWithDefaults(config: CreateLLMClientConfig): LLMProviderConfig {
  let provider = config.provider;

  // Auto-detect provider from model name if not specified
  if (!provider && config.model) {
    provider = detectProvider(config.model);
  }

  // Default to custom provider if still not determined
  if (!provider) {
    provider = 'custom';
  }

  // Get provider defaults
  const defaults = getDefaultProviderConfig(provider);

  // Merge configurations (user config takes precedence)
  return {
    provider,
    apiKey: config.apiKey || defaults.apiKey || '',
    baseUrl: config.baseUrl || defaults.baseUrl,
    organization: config.organization || defaults.organization,
    timeout: config.timeout ?? defaults.timeout ?? 60000,
    maxRetries: config.maxRetries ?? defaults.maxRetries ?? 3,
    headers: config.headers || defaults.headers,
    defaultModel: config.model || defaults.defaultModel,
  };
}

/**
 * Create an LLM client instance
 *
 * This factory function creates the appropriate LLM client based on the configuration.
 * It supports auto-detection of providers from model names and automatic loading of
 * API keys from environment variables.
 *
 * @example
 * ```typescript
 * // Auto-detect provider from model name
 * const client = createLLMClient({
 *   model: 'gpt-4-turbo',
 *   apiKey: process.env.OPENAI_API_KEY!,
 * });
 *
 * // Explicit provider
 * const client = createLLMClient({
 *   provider: 'anthropic',
 *   model: 'claude-3-opus-20240229',
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 * });
 *
 * // Use environment variables for API key
 * const client = createLLMClient({
 *   model: 'gpt-4-turbo',
 *   // API key loaded from OPENAI_API_KEY env var
 * });
 * ```
 *
 * @param config - Client configuration
 * @returns LLM client instance
 * @throws LLMInvalidRequestError if configuration is invalid
 * @throws LLMAuthenticationError if API key is missing
 * @throws Error if provider is not supported
 */
export function createLLMClient(config: CreateLLMClientConfig): LLMClient {
  // Try to get API key from environment if not provided
  if (!config.apiKey && config.provider) {
    const envApiKey = getApiKeyFromEnv(config.provider);
    if (envApiKey) {
      config.apiKey = envApiKey;
    }
  }

  // Merge with defaults
  const mergedConfig = mergeWithDefaults(config);

  // Validate final configuration
  validateConfig(mergedConfig);

  // Create client based on provider
  switch (mergedConfig.provider) {
    case 'openai': {
      const { OpenAIClient } = require('./providers/openai');
      return new OpenAIClient(mergedConfig);
    }

    case 'anthropic': {
      const { AnthropicClient } = require('./providers/anthropic');
      return new AnthropicClient(mergedConfig);
    }

    case 'azure': {
      // Azure uses OpenAI client with different base URL
      const { OpenAIClient } = require('./providers/openai');
      return new OpenAIClient(mergedConfig);
    }

    case 'custom':
      throw new Error(
        'Custom provider requires manual client implementation. Implement LLMClient interface directly.'
      );

    default:
      throw new Error(
        `Unsupported provider: ${mergedConfig.provider}. This should never happen.`
      );
  }
}

/**
 * Create an LLM client with simplified configuration
 *
 * Convenience function that only requires a model name and API key.
 * The provider is automatically detected from the model name.
 *
 * @example
 * ```typescript
 * const client = createSimpleLLMClient('gpt-4-turbo', process.env.OPENAI_API_KEY!);
 * const client = createSimpleLLMClient('claude-3-opus-20240229'); // Uses env var
 * ```
 *
 * @param model - Model identifier
 * @param apiKey - Optional API key (loaded from env if not provided)
 * @returns LLM client instance
 */
export function createSimpleLLMClient(model: string, apiKey?: string): LLMClient {
  const provider = detectProvider(model);

  return createLLMClient({
    model,
    provider,
    apiKey: apiKey || getApiKeyFromEnv(provider) || '',
  });
}

/**
 * Type guard to check if a client configuration is valid
 *
 * @param config - Configuration to check
 * @returns True if configuration is valid
 */
export function isValidLLMConfig(config: Partial<CreateLLMClientConfig>): config is CreateLLMClientConfig {
  try {
    if (!config.apiKey && !config.provider) {
      return false;
    }
    // Create a test config with defaults
    const testConfig = mergeWithDefaults(config as CreateLLMClientConfig);
    validateConfig(testConfig);
    return true;
  } catch {
    return false;
  }
}
