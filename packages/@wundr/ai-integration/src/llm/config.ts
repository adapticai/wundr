/**
 * LLM Configuration
 *
 * Provider configurations, model definitions, and environment variable handling.
 */

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'azure' | 'custom';

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  /** Supports function/tool calling */
  functionCalling: boolean;
  /** Supports vision/image inputs */
  vision: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports JSON mode */
  jsonMode: boolean;
  /** Supports system messages */
  systemMessages: boolean;
}

/**
 * Model pricing information (per 1M tokens)
 */
export interface ModelPricing {
  /** Cost per 1M input tokens in USD */
  inputTokens: number;
  /** Cost per 1M output tokens in USD */
  outputTokens: number;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Provider */
  provider: LLMProvider;
  /** Maximum context window size */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Model capabilities */
  capabilities: ModelCapabilities;
  /** Pricing information */
  pricing?: ModelPricing;
  /** Deprecation date (if applicable) */
  deprecatedAt?: Date;
}

/**
 * Provider-specific configuration
 */
export interface LLMProviderConfig {
  /** Provider type */
  provider: LLMProvider;
  /** API key for authentication */
  apiKey: string;
  /** Base URL for API requests (optional) */
  baseUrl?: string;
  /** Organization ID (optional, for OpenAI) */
  organization?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Custom headers for requests */
  headers?: Record<string, string>;
  /** Default model to use */
  defaultModel?: string;
}

/**
 * Default OpenAI model configurations
 */
export const OPENAI_MODELS: Record<string, ModelConfig> = {
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: {
      functionCalling: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
    },
    pricing: {
      inputTokens: 10.0,
      outputTokens: 30.0,
    },
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    capabilities: {
      functionCalling: true,
      vision: false,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
    },
    pricing: {
      inputTokens: 30.0,
      outputTokens: 60.0,
    },
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    capabilities: {
      functionCalling: true,
      vision: false,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
    },
    pricing: {
      inputTokens: 0.5,
      outputTokens: 1.5,
    },
  },
};

/**
 * Default Anthropic model configurations
 */
export const ANTHROPIC_MODELS: Record<string, ModelConfig> = {
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: {
      functionCalling: true,
      vision: true,
      streaming: true,
      jsonMode: false,
      systemMessages: true,
    },
    pricing: {
      inputTokens: 15.0,
      outputTokens: 75.0,
    },
  },
  'claude-3-sonnet-20240229': {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: {
      functionCalling: true,
      vision: true,
      streaming: true,
      jsonMode: false,
      systemMessages: true,
    },
    pricing: {
      inputTokens: 3.0,
      outputTokens: 15.0,
    },
  },
  'claude-3-haiku-20240307': {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: {
      functionCalling: true,
      vision: true,
      streaming: true,
      jsonMode: false,
      systemMessages: true,
    },
    pricing: {
      inputTokens: 0.25,
      outputTokens: 1.25,
    },
  },
};

/**
 * Combined model configurations
 */
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
};

/**
 * Environment variable names for API keys
 */
export const ENV_VARS = {
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  OPENAI_ORG_ID: 'OPENAI_ORG_ID',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  AZURE_OPENAI_API_KEY: 'AZURE_OPENAI_API_KEY',
  AZURE_OPENAI_ENDPOINT: 'AZURE_OPENAI_ENDPOINT',
} as const;

/**
 * Get API key from environment variables
 *
 * @param provider - Provider to get API key for
 * @returns API key or undefined if not found
 */
export function getApiKeyFromEnv(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env[ENV_VARS.OPENAI_API_KEY];
    case 'anthropic':
      return process.env[ENV_VARS.ANTHROPIC_API_KEY];
    case 'azure':
      return process.env[ENV_VARS.AZURE_OPENAI_API_KEY];
    default:
      return undefined;
  }
}

/**
 * Get organization ID from environment variables (OpenAI only)
 *
 * @returns Organization ID or undefined if not found
 */
export function getOrgIdFromEnv(): string | undefined {
  return process.env[ENV_VARS.OPENAI_ORG_ID];
}

/**
 * Get base URL from environment variables
 *
 * @param provider - Provider to get base URL for
 * @returns Base URL or undefined if not found
 */
export function getBaseUrlFromEnv(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'azure':
      return process.env[ENV_VARS.AZURE_OPENAI_ENDPOINT];
    default:
      return undefined;
  }
}

/**
 * Auto-detect provider from model name
 *
 * @param modelId - Model identifier
 * @returns Detected provider or 'custom' if unknown
 */
export function detectProvider(modelId: string): LLMProvider {
  if (modelId.startsWith('gpt-')) {
    return 'openai';
  }
  if (modelId.startsWith('claude-')) {
    return 'anthropic';
  }
  // Check if model exists in known configurations
  const config = MODEL_CONFIGS[modelId];
  if (config) {
    return config.provider;
  }
  return 'custom';
}

/**
 * Get model configuration by ID
 *
 * @param modelId - Model identifier
 * @returns Model configuration or undefined if not found
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS[modelId];
}

/**
 * Validate model configuration
 *
 * @param modelId - Model identifier
 * @throws Error if model is not supported or deprecated
 */
export function validateModel(modelId: string): void {
  const config = getModelConfig(modelId);

  if (!config) {
    throw new Error(
      `Unknown model: ${modelId}. Supported models: ${Object.keys(MODEL_CONFIGS).join(', ')}`
    );
  }

  if (config.deprecatedAt && config.deprecatedAt < new Date()) {
    throw new Error(
      `Model ${modelId} was deprecated on ${config.deprecatedAt.toISOString()}`
    );
  }
}

/**
 * Get default configuration for a provider
 *
 * @param provider - Provider type
 * @returns Default provider configuration
 */
export function getDefaultProviderConfig(provider: LLMProvider): Partial<LLMProviderConfig> {
  const config: Partial<LLMProviderConfig> = {
    provider,
    timeout: 60000, // 60 seconds
    maxRetries: 3,
  };

  // Add API key from environment if available
  const apiKey = getApiKeyFromEnv(provider);
  if (apiKey) {
    config.apiKey = apiKey;
  }

  // Add provider-specific defaults
  switch (provider) {
    case 'openai':
      config.organization = getOrgIdFromEnv();
      config.defaultModel = 'gpt-4-turbo';
      break;
    case 'anthropic':
      config.defaultModel = 'claude-3-sonnet-20240229';
      break;
    case 'azure':
      config.baseUrl = getBaseUrlFromEnv(provider);
      break;
  }

  return config;
}
