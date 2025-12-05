/**
 * AI Model Definitions and Management
 * Comprehensive model catalog with capabilities, pricing, and provider information
 */

export type AIProvider = 'openai' | 'anthropic' | 'deepseek';

export interface ModelCapabilities {
  vision: boolean;
  functionCalling: boolean;
  streaming: boolean;
  reasoning: boolean;
  json: boolean;
}

export interface ModelPricing {
  input: number; // per 1M tokens
  output: number; // per 1M tokens
  currency: 'USD';
}

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  contextLength: number;
  maxOutputTokens: number;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  description: string;
  isRecommended?: boolean;
  releaseDate?: string;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt?: string;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Comprehensive AI model catalog
 */
export const AI_MODELS: Record<string, AIModel> = {
  // OpenAI Models
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextLength: 128000,
    maxOutputTokens: 16384,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      reasoning: false,
      json: true,
    },
    pricing: {
      input: 2.5,
      output: 10.0,
      currency: 'USD',
    },
    description: 'Latest multimodal flagship model with vision capabilities',
    isRecommended: true,
    releaseDate: '2024-05',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextLength: 128000,
    maxOutputTokens: 16384,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      reasoning: false,
      json: true,
    },
    pricing: {
      input: 0.15,
      output: 0.6,
      currency: 'USD',
    },
    description: 'Fast and affordable model for most tasks',
    isRecommended: true,
    releaseDate: '2024-07',
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextLength: 128000,
    maxOutputTokens: 4096,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      reasoning: false,
      json: true,
    },
    pricing: {
      input: 10.0,
      output: 30.0,
      currency: 'USD',
    },
    description: 'Previous generation flagship with vision',
    releaseDate: '2024-04',
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextLength: 16385,
    maxOutputTokens: 4096,
    capabilities: {
      vision: false,
      functionCalling: true,
      streaming: true,
      reasoning: false,
      json: true,
    },
    pricing: {
      input: 0.5,
      output: 1.5,
      currency: 'USD',
    },
    description: 'Fast and cost-effective for simple tasks',
    releaseDate: '2023-03',
  },

  // Anthropic Models
  'claude-opus-4-5-20251101': {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    contextLength: 200000,
    maxOutputTokens: 16384,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      reasoning: true,
      json: true,
    },
    pricing: {
      input: 15.0,
      output: 75.0,
      currency: 'USD',
    },
    description: 'Most capable model with advanced reasoning',
    isRecommended: true,
    releaseDate: '2025-01',
  },
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    contextLength: 200000,
    maxOutputTokens: 16384,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      reasoning: true,
      json: true,
    },
    pricing: {
      input: 3.0,
      output: 15.0,
      currency: 'USD',
    },
    description: 'Balanced performance and cost with extended thinking',
    isRecommended: true,
    releaseDate: '2025-01',
  },
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextLength: 200000,
    maxOutputTokens: 8192,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      reasoning: false,
      json: true,
    },
    pricing: {
      input: 3.0,
      output: 15.0,
      currency: 'USD',
    },
    description: 'Intelligent and versatile for complex tasks',
    releaseDate: '2024-06',
  },
  'claude-haiku-4-20250116': {
    id: 'claude-haiku-4-20250116',
    name: 'Claude Haiku 4',
    provider: 'anthropic',
    contextLength: 200000,
    maxOutputTokens: 8192,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      reasoning: false,
      json: true,
    },
    pricing: {
      input: 0.8,
      output: 4.0,
      currency: 'USD',
    },
    description: 'Fastest and most compact model',
    releaseDate: '2025-01',
  },

  // DeepSeek Models
  'deepseek-chat': {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    contextLength: 64000,
    maxOutputTokens: 8192,
    capabilities: {
      vision: false,
      functionCalling: true,
      streaming: true,
      reasoning: false,
      json: true,
    },
    pricing: {
      input: 0.14,
      output: 0.28,
      currency: 'USD',
    },
    description: 'Cost-effective general purpose chat model',
    releaseDate: '2024-01',
  },
  'deepseek-reasoner': {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    contextLength: 64000,
    maxOutputTokens: 8192,
    capabilities: {
      vision: false,
      functionCalling: true,
      streaming: true,
      reasoning: true,
      json: true,
    },
    pricing: {
      input: 0.55,
      output: 2.19,
      currency: 'USD',
    },
    description: 'Advanced reasoning capabilities at low cost',
    isRecommended: true,
    releaseDate: '2025-01',
  },
};

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return Object.values(AI_MODELS).filter(model => model.provider === provider);
}

/**
 * Get recommended models
 */
export function getRecommendedModels(): AIModel[] {
  return Object.values(AI_MODELS).filter(model => model.isRecommended);
}

/**
 * Get model by ID
 */
export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS[id];
}

/**
 * Calculate estimated cost for a request
 */
export function calculateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModelById(modelId);
  if (!model) return 0;

  const inputCost = (inputTokens / 1_000_000) * model.pricing.input;
  const outputCost = (outputTokens / 1_000_000) * model.pricing.output;

  return inputCost + outputCost;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Get provider display name
 */
export function getProviderName(provider: AIProvider): string {
  const names: Record<AIProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    deepseek: 'DeepSeek',
  };
  return names[provider];
}

/**
 * Get provider color scheme
 */
export function getProviderColor(provider: AIProvider): string {
  const colors: Record<AIProvider, string> = {
    openai: 'bg-green-500',
    anthropic: 'bg-orange-500',
    deepseek: 'bg-blue-500',
  };
  return colors[provider];
}

/**
 * Default model configurations
 */
export const DEFAULT_MODEL_CONFIGS: Record<string, Partial<ModelConfig>> = {
  'gpt-4o': {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
  },
  'gpt-4o-mini': {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
  },
  'claude-sonnet-4-5-20250929': {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 8192,
  },
  'claude-opus-4-5-20251101': {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 8192,
  },
  'deepseek-reasoner': {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
  },
};

/**
 * Get default config for a model
 */
export function getDefaultModelConfig(modelId: string): ModelConfig {
  const baseConfig = DEFAULT_MODEL_CONFIGS[modelId] || {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
  };

  return {
    model: modelId,
    ...baseConfig,
  } as ModelConfig;
}
