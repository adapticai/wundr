/**
 * Provider Registry - Model catalog and provider configuration management
 *
 * Maintains a registry of available LLM providers and their models with
 * capabilities, pricing, and context window information. Supports static
 * catalog entries merged with runtime configuration for custom/local models.
 *
 * Inspired by OpenClaw's model-catalog.ts and model-selection.ts patterns.
 */

import { EventEmitter } from 'eventemitter3';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderKind = 'anthropic' | 'openai' | 'google' | 'local' | 'custom';

export interface ModelPricing {
  /** Cost per 1M input tokens in USD */
  input: number;
  /** Cost per 1M output tokens in USD */
  output: number;
}

export interface ModelCapabilities {
  reasoning: boolean;
  vision: boolean;
  streaming: boolean;
  toolCalling: boolean;
  jsonMode: boolean;
  systemMessages: boolean;
}

export interface ModelEntry {
  id: string;
  name: string;
  provider: ProviderKind;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  /** Optional aliases (e.g. "sonnet" -> "claude-sonnet-4-5") */
  aliases?: string[];
  deprecated?: boolean;
}

export interface ProviderConfig {
  id: ProviderKind;
  name: string;
  baseUrl?: string;
  defaultModel: string;
  models: ModelEntry[];
}

export interface ModelRef {
  provider: string;
  model: string;
}

export interface ProviderRegistryConfig {
  providers?: Record<string, {
    baseUrl?: string;
    defaultModel?: string;
    models?: Array<{
      id: string;
      name?: string;
      contextWindow?: number;
      maxOutputTokens?: number;
      pricing?: ModelPricing;
    }>;
  }>;
  allowlist?: Record<string, { alias?: string }>;
}

// ---------------------------------------------------------------------------
// Built-in model catalog
// ---------------------------------------------------------------------------

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  reasoning: false,
  vision: false,
  streaming: true,
  toolCalling: true,
  jsonMode: false,
  systemMessages: true,
};

const BUILTIN_MODELS: ModelEntry[] = [
  // -- Anthropic --
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 32_768,
    capabilities: { ...DEFAULT_CAPABILITIES, reasoning: true, vision: true },
    pricing: { input: 15.0, output: 75.0 },
    aliases: ['opus-4.6', 'opus'],
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 16_384,
    capabilities: { ...DEFAULT_CAPABILITIES, reasoning: true, vision: true },
    pricing: { input: 3.0, output: 15.0 },
    aliases: ['sonnet-4.5', 'sonnet'],
  },
  {
    id: 'claude-haiku-3-5',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    capabilities: { ...DEFAULT_CAPABILITIES, vision: true },
    pricing: { input: 0.25, output: 1.25 },
    aliases: ['haiku'],
  },

  // -- OpenAI --
  {
    id: 'o3',
    name: 'OpenAI o3',
    provider: 'openai',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    capabilities: { ...DEFAULT_CAPABILITIES, reasoning: true, vision: true, jsonMode: true },
    pricing: { input: 10.0, output: 40.0 },
    aliases: ['o3'],
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    capabilities: { ...DEFAULT_CAPABILITIES, vision: true, jsonMode: true },
    pricing: { input: 10.0, output: 30.0 },
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: { ...DEFAULT_CAPABILITIES, vision: true, jsonMode: true },
    pricing: { input: 2.5, output: 10.0 },
    aliases: ['gpt4o'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: { ...DEFAULT_CAPABILITIES, vision: true, jsonMode: true },
    pricing: { input: 0.15, output: 0.6 },
    aliases: ['gpt4o-mini'],
  },

  // -- Google --
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
    capabilities: { ...DEFAULT_CAPABILITIES, vision: true, jsonMode: true },
    pricing: { input: 0.075, output: 0.3 },
    aliases: ['gemini-flash'],
  },
  {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'google',
    contextWindow: 2_000_000,
    maxOutputTokens: 8_192,
    capabilities: { ...DEFAULT_CAPABILITIES, reasoning: true, vision: true, jsonMode: true },
    pricing: { input: 1.25, output: 10.0 },
    aliases: ['gemini-pro'],
  },
];

// ---------------------------------------------------------------------------
// Provider ID normalization (mirrors OpenClaw's normalizeProviderId)
// ---------------------------------------------------------------------------

export function normalizeProviderId(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'anthropic-ai') {
    return 'anthropic';
  }
  if (normalized === 'gpt' || normalized === 'openai-api') {
    return 'openai';
  }
  if (normalized === 'gemini' || normalized === 'google-ai') {
    return 'google';
  }
  if (normalized === 'ollama' || normalized === 'llama' || normalized === 'llamacpp') {
    return 'local';
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Model ref parsing (mirrors OpenClaw's parseModelRef)
// ---------------------------------------------------------------------------

export function parseModelRef(raw: string, defaultProvider: string): ModelRef | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const slash = trimmed.indexOf('/');
  if (slash === -1) {
    return {
      provider: normalizeProviderId(defaultProvider),
      model: trimmed,
    };
  }
  const provider = normalizeProviderId(trimmed.slice(0, slash).trim());
  const model = trimmed.slice(slash + 1).trim();
  if (!provider || !model) {
    return null;
  }
  return { provider, model };
}

export function modelKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

// ---------------------------------------------------------------------------
// ProviderRegistry class
// ---------------------------------------------------------------------------

interface ProviderRegistryEvents {
  'model:registered': (entry: ModelEntry) => void;
  'model:not_found': (ref: ModelRef) => void;
}

export class ProviderRegistry extends EventEmitter<ProviderRegistryEvents> {
  private models: Map<string, ModelEntry> = new Map();
  private aliases: Map<string, ModelRef> = new Map();
  private allowlistKeys: Set<string> | null = null;
  private defaultProvider: string = 'anthropic';
  private defaultModel: string = 'claude-sonnet-4-5';

  constructor(config?: ProviderRegistryConfig) {
    super();
    this.loadBuiltinModels();
    if (config) {
      this.applyConfig(config);
    }
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  private loadBuiltinModels(): void {
    for (const entry of BUILTIN_MODELS) {
      const key = modelKey(entry.provider, entry.id);
      this.models.set(key, entry);

      if (entry.aliases) {
        for (const alias of entry.aliases) {
          this.aliases.set(alias.toLowerCase(), {
            provider: entry.provider,
            model: entry.id,
          });
        }
      }
    }
  }

  private applyConfig(config: ProviderRegistryConfig): void {
    // Register custom provider models
    if (config.providers) {
      for (const [providerId, providerCfg] of Object.entries(config.providers)) {
        const provider = normalizeProviderId(providerId);
        if (providerCfg.models) {
          for (const modelCfg of providerCfg.models) {
            const entry: ModelEntry = {
              id: modelCfg.id,
              name: modelCfg.name ?? modelCfg.id,
              provider: provider as ProviderKind,
              contextWindow: modelCfg.contextWindow ?? 128_000,
              maxOutputTokens: modelCfg.maxOutputTokens ?? 4_096,
              capabilities: { ...DEFAULT_CAPABILITIES },
              pricing: modelCfg.pricing ?? { input: 0, output: 0 },
            };
            const key = modelKey(provider, modelCfg.id);
            this.models.set(key, entry);
            this.emit('model:registered', entry);
          }
        }
      }
    }

    // Build allowlist
    if (config.allowlist && Object.keys(config.allowlist).length > 0) {
      this.allowlistKeys = new Set<string>();
      for (const [raw, meta] of Object.entries(config.allowlist)) {
        const ref = parseModelRef(raw, this.defaultProvider);
        if (ref) {
          this.allowlistKeys.add(modelKey(ref.provider, ref.model));
        }
        if (meta?.alias) {
          const aliasRef = parseModelRef(raw, this.defaultProvider);
          if (aliasRef) {
            this.aliases.set(meta.alias.toLowerCase(), aliasRef);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  /**
   * Find a model by provider and ID, returning null if not found.
   */
  findModel(provider: string, modelId: string): ModelEntry | null {
    const normalizedProvider = normalizeProviderId(provider);
    const key = modelKey(normalizedProvider, modelId);
    return this.models.get(key) ?? null;
  }

  /**
   * Resolve a raw model string (e.g. "opus", "anthropic/claude-opus-4-6")
   * to a ModelEntry. Checks aliases first, then direct lookup.
   */
  resolveModelRef(raw: string): { ref: ModelRef; entry: ModelEntry | null } | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    // Check aliases first (for bare names like "opus" or "sonnet")
    if (!trimmed.includes('/')) {
      const aliasRef = this.aliases.get(trimmed.toLowerCase());
      if (aliasRef) {
        const entry = this.findModel(aliasRef.provider, aliasRef.model);
        return { ref: aliasRef, entry };
      }
    }

    const ref = parseModelRef(trimmed, this.defaultProvider);
    if (!ref) {
      return null;
    }

    const entry = this.findModel(ref.provider, ref.model);
    return { ref, entry };
  }

  /**
   * Check if a model is in the configured allowlist.
   * Returns true if no allowlist is configured (allow all).
   */
  isAllowed(provider: string, modelId: string): boolean {
    if (!this.allowlistKeys) {
      return true;
    }
    const key = modelKey(normalizeProviderId(provider), modelId);
    return this.allowlistKeys.has(key);
  }

  /**
   * Get all registered models, optionally filtered by provider.
   */
  listModels(provider?: string): ModelEntry[] {
    const entries = Array.from(this.models.values());
    if (!provider) {
      return entries;
    }
    const normalized = normalizeProviderId(provider);
    return entries.filter((e) => e.provider === normalized);
  }

  /**
   * Get the default model reference.
   */
  getDefault(): ModelRef {
    return { provider: this.defaultProvider, model: this.defaultModel };
  }

  /**
   * Set the default model.
   */
  setDefault(provider: string, model: string): void {
    this.defaultProvider = normalizeProviderId(provider);
    this.defaultModel = model;
  }

  /**
   * Get pricing for a specific model. Returns null for unknown models.
   */
  getModelPricing(provider: string, modelId: string): ModelPricing | null {
    const entry = this.findModel(provider, modelId);
    return entry?.pricing ?? null;
  }

  /**
   * Get the context window size for a model.
   */
  getContextWindow(provider: string, modelId: string): number {
    const entry = this.findModel(provider, modelId);
    return entry?.contextWindow ?? 128_000;
  }

  /**
   * Check if a model supports reasoning/thinking.
   */
  supportsReasoning(provider: string, modelId: string): boolean {
    const entry = this.findModel(provider, modelId);
    return entry?.capabilities.reasoning ?? false;
  }

  /**
   * Get the full capabilities object for a model.
   */
  getModelCapabilities(provider: string, modelId: string): ModelCapabilities | null {
    const entry = this.findModel(provider, modelId);
    return entry?.capabilities ?? null;
  }

  /**
   * Check if a model supports a specific capability.
   */
  supportsCapability(
    provider: string,
    modelId: string,
    capability: keyof ModelCapabilities,
  ): boolean {
    const entry = this.findModel(provider, modelId);
    if (!entry) {
      return false;
    }
    return entry.capabilities[capability] ?? false;
  }

  /**
   * Get the max output tokens for a model.
   */
  getMaxOutputTokens(provider: string, modelId: string): number {
    const entry = this.findModel(provider, modelId);
    return entry?.maxOutputTokens ?? 4_096;
  }

  /**
   * Register a model entry at runtime (for custom/local models).
   */
  registerModel(entry: ModelEntry): void {
    const key = modelKey(entry.provider, entry.id);
    this.models.set(key, entry);
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        this.aliases.set(alias.toLowerCase(), {
          provider: entry.provider,
          model: entry.id,
        });
      }
    }
    this.emit('model:registered', entry);
  }

  /**
   * Remove a model from the registry.
   */
  removeModel(provider: string, modelId: string): boolean {
    const key = modelKey(normalizeProviderId(provider), modelId);
    const entry = this.models.get(key);
    if (!entry) {
      return false;
    }
    this.models.delete(key);
    // Remove any aliases pointing to this model
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        this.aliases.delete(alias.toLowerCase());
      }
    }
    return true;
  }

  /**
   * Get unique list of registered provider kinds.
   */
  listProviders(): string[] {
    const providers = new Set<string>();
    for (const entry of this.models.values()) {
      providers.add(entry.provider);
    }
    return Array.from(providers);
  }
}
