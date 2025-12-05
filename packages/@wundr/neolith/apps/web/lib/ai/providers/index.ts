/**
 * AI Provider Management
 *
 * Centralized provider selection and model initialization for AI chat APIs.
 * Supports OpenAI, Anthropic, and DeepSeek with automatic fallback.
 *
 * @module lib/ai/providers
 */

import { anthropic } from '@ai-sdk/anthropic';
import { deepseek } from '@ai-sdk/deepseek';
import { openai } from '@ai-sdk/openai';

import type { LanguageModel } from 'ai';

export type AIProvider = 'openai' | 'anthropic' | 'deepseek';
export type ModelName = string;

export interface ProviderConfig {
  provider: AIProvider;
  model: ModelName;
  apiKey?: string;
}

export interface ModelMetadata {
  name: string;
  provider: AIProvider;
  contextWindow: number;
  maxOutput: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

/**
 * Available models with metadata
 */
export const AVAILABLE_MODELS: Record<string, ModelMetadata> = {
  // OpenAI Models
  'gpt-4o': {
    name: 'gpt-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 4096,
    supportsTools: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.005, output: 0.015 },
  },
  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 16384,
    supportsTools: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
  },
  'gpt-4-turbo': {
    name: 'gpt-4-turbo',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 4096,
    supportsTools: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.01, output: 0.03 },
  },

  // Anthropic Models
  'claude-sonnet-4-20250514': {
    name: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    supportsTools: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.003, output: 0.015 },
  },
  'claude-opus-4-20250514': {
    name: 'claude-opus-4-20250514',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    supportsTools: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.015, output: 0.075 },
  },
  'claude-3-5-sonnet-20241022': {
    name: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    supportsTools: true,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.003, output: 0.015 },
  },

  // DeepSeek Models
  'deepseek-chat': {
    name: 'deepseek-chat',
    provider: 'deepseek',
    contextWindow: 64000,
    maxOutput: 4096,
    supportsTools: false,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.00014, output: 0.00028 },
  },
  'deepseek-reasoner': {
    name: 'deepseek-reasoner',
    provider: 'deepseek',
    contextWindow: 64000,
    maxOutput: 8000,
    supportsTools: false,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.00055, output: 0.0022 },
  },
};

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: AIProvider): string {
  const defaults: Record<AIProvider, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
    deepseek: 'deepseek-chat',
  };
  return defaults[provider];
}

/**
 * Validate provider API key is configured
 */
export function validateProviderKey(provider: AIProvider): {
  valid: boolean;
  error?: string;
} {
  const keys: Record<AIProvider, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };

  const key = keys[provider];
  if (!key) {
    return {
      valid: false,
      error: `${provider.toUpperCase()}_API_KEY not configured`,
    };
  }

  return { valid: true };
}

/**
 * Get LanguageModel instance for provider and model
 */
export function getLanguageModel(
  provider: AIProvider,
  modelName: string
): LanguageModel {
  const models: Record<AIProvider, (name: string) => LanguageModel> = {
    openai: name => openai(name),
    anthropic: name => anthropic(name),
    deepseek: name => deepseek(name),
  };

  const createModel = models[provider];
  return createModel(modelName);
}

/**
 * Get provider from environment or use default
 */
export function getDefaultProvider(): AIProvider {
  const envProvider = process.env.DEFAULT_LLM_PROVIDER?.toLowerCase();
  if (
    envProvider === 'openai' ||
    envProvider === 'anthropic' ||
    envProvider === 'deepseek'
  ) {
    return envProvider;
  }
  return 'openai';
}

/**
 * Get model metadata
 */
export function getModelMetadata(modelName: string): ModelMetadata | null {
  return AVAILABLE_MODELS[modelName] || null;
}

/**
 * List available models for a provider
 */
export function getProviderModels(provider: AIProvider): ModelMetadata[] {
  return Object.values(AVAILABLE_MODELS).filter(
    model => model.provider === provider
  );
}

/**
 * Estimate cost for token usage
 */
export function estimateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number {
  const metadata = getModelMetadata(modelName);
  if (!metadata) return 0;

  const inputCost = (inputTokens / 1000) * metadata.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * metadata.costPer1kTokens.output;

  return inputCost + outputCost;
}

/**
 * Check if model supports specific feature
 */
export function supportsFeature(
  modelName: string,
  feature: 'tools' | 'streaming'
): boolean {
  const metadata = getModelMetadata(modelName);
  if (!metadata) return false;

  return feature === 'tools'
    ? metadata.supportsTools
    : metadata.supportsStreaming;
}
