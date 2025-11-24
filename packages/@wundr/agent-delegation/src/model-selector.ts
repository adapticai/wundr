/**
 * @wundr/agent-delegation - Model Selector
 *
 * Provides intelligent model selection for subagent tasks based on
 * task complexity, required capabilities, cost constraints, and
 * performance requirements.
 */

import { v4 as uuidv4 } from 'uuid';

import { DelegationError, DelegationErrorCode } from './types';

import type {
  ModelConfig,
  ModelTier,
  ModelSelectionCriteria,
  ModelSelectionCriteriaInput,
  DelegationTask,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the model selector
 */
export interface ModelSelectorOptions {
  /** Default model to use when no match is found */
  readonly defaultModelId?: string;
  /** Model selection strategy */
  readonly strategy?:
    | 'capability_match'
    | 'cost_optimize'
    | 'speed_optimize'
    | 'balanced';
  /** Weight for capability matching (0-1) */
  readonly capabilityWeight?: number;
  /** Weight for cost optimization (0-1) */
  readonly costWeight?: number;
  /** Weight for speed optimization (0-1) */
  readonly speedWeight?: number;
  /** Enable caching of selection decisions */
  readonly enableCaching?: boolean;
  /** Cache TTL in milliseconds */
  readonly cacheTTL?: number;
}

/**
 * Model selection result
 */
export interface ModelSelectionResult {
  /** The selected model */
  model: ModelConfig;
  /** Score for the selection */
  score: number;
  /** Reasoning for the selection */
  reasoning: string[];
  /** Alternative models considered */
  alternatives: Array<{ model: ModelConfig; score: number }>;
}

/**
 * Cached selection entry
 */
interface CachedSelection {
  key: string;
  result: ModelSelectionResult;
  expiresAt: Date;
}

// =============================================================================
// Default Model Registry
// =============================================================================

/**
 * Default model configurations
 */
const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    tier: 'premium',
    capabilities: [
      'reasoning',
      'coding',
      'analysis',
      'writing',
      'math',
      'tools',
    ],
    maxContextLength: 200000,
    costPerToken: 0.000015,
    averageLatencyMs: 1500,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'claude-haiku-3-5',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    tier: 'standard',
    capabilities: ['reasoning', 'coding', 'writing'],
    maxContextLength: 200000,
    costPerToken: 0.0000025,
    averageLatencyMs: 500,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    tier: 'premium',
    capabilities: [
      'reasoning',
      'coding',
      'analysis',
      'writing',
      'math',
      'tools',
    ],
    maxContextLength: 128000,
    costPerToken: 0.00001,
    averageLatencyMs: 1200,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'economy',
    capabilities: ['reasoning', 'coding', 'writing'],
    maxContextLength: 128000,
    costPerToken: 0.00000015,
    averageLatencyMs: 400,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2 Flash',
    provider: 'google',
    tier: 'standard',
    capabilities: ['reasoning', 'coding', 'analysis', 'writing'],
    maxContextLength: 1000000,
    costPerToken: 0.000001,
    averageLatencyMs: 600,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'ollama-llama3',
    name: 'Ollama Llama 3',
    provider: 'local',
    tier: 'local',
    capabilities: ['reasoning', 'coding', 'writing'],
    maxContextLength: 8192,
    costPerToken: 0,
    averageLatencyMs: 2000,
    supportsTools: false,
    supportsVision: false,
  },
];

// =============================================================================
// Model Selector Class
// =============================================================================

/**
 * ModelSelector - Selects optimal models for delegation tasks
 *
 * @example
 * ```typescript
 * const selector = new ModelSelector({
 *   strategy: 'balanced',
 * });
 *
 * const result = await selector.selectModel(task, {
 *   taskComplexity: 'complex',
 *   requiredCapabilities: ['coding', 'reasoning'],
 * });
 *
 * console.log(`Selected: ${result.model.name}`);
 * ```
 */
export class ModelSelector {
  private models: ModelConfig[] = [];
  private cache: Map<string, CachedSelection> = new Map();
  private readonly options: Required<ModelSelectorOptions>;

  /**
   * Creates a new ModelSelector instance
   *
   * @param options - Configuration options
   */
  constructor(options: ModelSelectorOptions = {}) {
    this.options = {
      defaultModelId: options.defaultModelId ?? 'claude-sonnet-4-5',
      strategy: options.strategy ?? 'balanced',
      capabilityWeight: options.capabilityWeight ?? 0.4,
      costWeight: options.costWeight ?? 0.3,
      speedWeight: options.speedWeight ?? 0.3,
      enableCaching: options.enableCaching ?? true,
      cacheTTL: options.cacheTTL ?? 300000, // 5 minutes
    };

    // Initialize with default models
    this.models = [...DEFAULT_MODELS];
  }

  /**
   * Registers a new model configuration
   *
   * @param model - The model configuration to register
   */
  registerModel(model: ModelConfig): void {
    const existing = this.models.findIndex(m => m.id === model.id);
    if (existing >= 0) {
      this.models[existing] = model;
    } else {
      this.models.push(model);
    }
    // Clear cache when models change
    this.clearCache();
  }

  /**
   * Registers multiple model configurations
   *
   * @param models - Array of model configurations
   */
  registerModels(models: ModelConfig[]): void {
    for (const model of models) {
      this.registerModel(model);
    }
  }

  /**
   * Removes a model from the registry
   *
   * @param modelId - The model ID to remove
   * @returns True if removed, false if not found
   */
  removeModel(modelId: string): boolean {
    const index = this.models.findIndex(m => m.id === modelId);
    if (index >= 0) {
      this.models.splice(index, 1);
      this.clearCache();
      return true;
    }
    return false;
  }

  /**
   * Gets all registered models
   *
   * @returns Array of registered models
   */
  getModels(): ModelConfig[] {
    return [...this.models];
  }

  /**
   * Gets a model by ID
   *
   * @param modelId - The model ID
   * @returns The model configuration or undefined
   */
  getModel(modelId: string): ModelConfig | undefined {
    return this.models.find(m => m.id === modelId);
  }

  /**
   * Gets models by tier
   *
   * @param tier - The model tier
   * @returns Array of models in that tier
   */
  getModelsByTier(tier: ModelTier): ModelConfig[] {
    return this.models.filter(m => m.tier === tier);
  }

  /**
   * Selects the optimal model for a task
   *
   * @param task - The delegation task
   * @param criteria - Selection criteria
   * @returns The model selection result
   * @throws {DelegationError} If no suitable model found
   */
  async selectModel(
    task: DelegationTask,
    criteria: ModelSelectionCriteriaInput = {},
  ): Promise<ModelSelectionResult> {
    // Check cache
    const cacheKey = this.getCacheKey(task, criteria);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Apply defaults to criteria
    const fullCriteria: ModelSelectionCriteria = {
      taskComplexity: criteria.taskComplexity ?? this.inferComplexity(task),
      requiredCapabilities:
        criteria.requiredCapabilities ?? task.requiredCapabilities ?? [],
      maxCost: criteria.maxCost,
      maxLatency: criteria.maxLatency,
      preferredTier: criteria.preferredTier,
      requiresTools: criteria.requiresTools ?? false,
      requiresVision: criteria.requiresVision ?? false,
      contextLength: criteria.contextLength,
    };

    // Filter and score models
    const candidates = this.filterModels(fullCriteria);
    if (candidates.length === 0) {
      throw new DelegationError(
        DelegationErrorCode.MODEL_SELECTION_FAILED,
        'No suitable model found for the given criteria',
        { criteria: fullCriteria },
      );
    }

    const scored = candidates.map(model => ({
      model,
      score: this.scoreModel(model, fullCriteria),
    }));

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    const result: ModelSelectionResult = {
      model: scored[0].model,
      score: scored[0].score,
      reasoning: this.generateReasoning(scored[0].model, fullCriteria),
      alternatives: scored.slice(1, 4), // Top 3 alternatives
    };

    // Cache result
    this.addToCache(cacheKey, result);

    return result;
  }

  /**
   * Selects a model for a specific tier
   *
   * @param tier - The desired tier
   * @param criteria - Additional criteria
   * @returns The model selection result
   */
  async selectModelByTier(
    tier: ModelTier,
    criteria: ModelSelectionCriteriaInput = {},
  ): Promise<ModelSelectionResult> {
    const tieredCriteria = {
      ...criteria,
      preferredTier: tier,
    };

    // Create a minimal task for selection
    const task: DelegationTask = {
      id: uuidv4(),
      description: 'Tier-based selection',
      requiredCapabilities: criteria.requiredCapabilities ?? [],
      priority: 'medium',
      createdAt: new Date(),
    };

    return this.selectModel(task, tieredCriteria);
  }

  /**
   * Gets the default model
   *
   * @returns The default model configuration
   * @throws {DelegationError} If default model not found
   */
  getDefaultModel(): ModelConfig {
    const model = this.models.find(m => m.id === this.options.defaultModelId);
    if (!model) {
      throw new DelegationError(
        DelegationErrorCode.MODEL_SELECTION_FAILED,
        `Default model not found: ${this.options.defaultModelId}`,
      );
    }
    return model;
  }

  /**
   * Estimates cost for a task with a given model
   *
   * @param model - The model to estimate for
   * @param estimatedTokens - Estimated token count
   * @returns Estimated cost
   */
  estimateCost(model: ModelConfig, estimatedTokens: number): number {
    return model.costPerToken * estimatedTokens;
  }

  /**
   * Clears the selection cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Filters models based on criteria
   */
  private filterModels(criteria: ModelSelectionCriteria): ModelConfig[] {
    return this.models.filter(model => {
      // Check tool support
      if (criteria.requiresTools && !model.supportsTools) {
        return false;
      }

      // Check vision support
      if (criteria.requiresVision && !model.supportsVision) {
        return false;
      }

      // Check context length
      if (
        criteria.contextLength &&
        model.maxContextLength < criteria.contextLength
      ) {
        return false;
      }

      // Check cost constraint
      if (criteria.maxCost && model.costPerToken > criteria.maxCost) {
        return false;
      }

      // Check latency constraint
      if (criteria.maxLatency && model.averageLatencyMs > criteria.maxLatency) {
        return false;
      }

      // Check required capabilities
      if (criteria.requiredCapabilities.length > 0) {
        const hasCapabilities = criteria.requiredCapabilities.every(cap =>
          model.capabilities.includes(cap),
        );
        if (!hasCapabilities) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Scores a model based on criteria and strategy
   */
  private scoreModel(
    model: ModelConfig,
    criteria: ModelSelectionCriteria,
  ): number {
    let capabilityScore = 0;
    let costScore = 0;
    let speedScore = 0;
    let tierScore = 0;

    // Capability score (0-1)
    if (criteria.requiredCapabilities.length > 0) {
      const matchCount = criteria.requiredCapabilities.filter(cap =>
        model.capabilities.includes(cap),
      ).length;
      capabilityScore = matchCount / criteria.requiredCapabilities.length;
    } else {
      capabilityScore = model.capabilities.length / 10; // Normalize to max ~1
    }

    // Bonus for extra capabilities
    const extraCapabilities =
      model.capabilities.length - criteria.requiredCapabilities.length;
    if (extraCapabilities > 0) {
      capabilityScore = Math.min(1, capabilityScore + extraCapabilities * 0.05);
    }

    // Cost score (0-1, lower cost = higher score)
    const maxCost = 0.0001; // Reference max cost
    costScore = 1 - Math.min(1, model.costPerToken / maxCost);

    // Speed score (0-1, lower latency = higher score)
    const maxLatency = 3000; // Reference max latency
    speedScore = 1 - Math.min(1, model.averageLatencyMs / maxLatency);

    // Tier score based on complexity
    const tierRank: Record<ModelTier, number> = {
      premium: 4,
      standard: 3,
      economy: 2,
      local: 1,
    };

    const complexityTier: Record<string, ModelTier> = {
      simple: 'economy',
      moderate: 'standard',
      complex: 'premium',
      expert: 'premium',
    };

    const targetTier =
      criteria.preferredTier ?? complexityTier[criteria.taskComplexity];
    const tierDiff = Math.abs(tierRank[model.tier] - tierRank[targetTier]);
    tierScore = 1 - tierDiff * 0.25;

    // Apply strategy weights
    let weights = {
      capability: this.options.capabilityWeight,
      cost: this.options.costWeight,
      speed: this.options.speedWeight,
      tier: 0.2,
    };

    switch (this.options.strategy) {
      case 'capability_match':
        weights = { capability: 0.6, cost: 0.1, speed: 0.1, tier: 0.2 };
        break;
      case 'cost_optimize':
        weights = { capability: 0.2, cost: 0.5, speed: 0.1, tier: 0.2 };
        break;
      case 'speed_optimize':
        weights = { capability: 0.2, cost: 0.1, speed: 0.5, tier: 0.2 };
        break;
      case 'balanced':
        // Use default weights
        break;
    }

    const totalWeight =
      weights.capability + weights.cost + weights.speed + weights.tier;
    const normalizedScore =
      (capabilityScore * weights.capability +
        costScore * weights.cost +
        speedScore * weights.speed +
        tierScore * weights.tier) /
      totalWeight;

    return normalizedScore;
  }

  /**
   * Infers task complexity from the task
   */
  private inferComplexity(
    task: DelegationTask,
  ): 'simple' | 'moderate' | 'complex' | 'expert' {
    const description = task.description.toLowerCase();
    const capabilities = task.requiredCapabilities ?? [];

    // Expert-level indicators
    if (
      description.includes('architecture') ||
      description.includes('design system') ||
      capabilities.includes('expert')
    ) {
      return 'expert';
    }

    // Complex indicators
    if (
      description.includes('implement') ||
      description.includes('analyze') ||
      description.includes('complex') ||
      capabilities.length >= 3
    ) {
      return 'complex';
    }

    // Simple indicators
    if (
      description.includes('simple') ||
      description.includes('basic') ||
      description.length < 50
    ) {
      return 'simple';
    }

    return 'moderate';
  }

  /**
   * Generates reasoning for model selection
   */
  private generateReasoning(
    model: ModelConfig,
    criteria: ModelSelectionCriteria,
  ): string[] {
    const reasons: string[] = [];

    // Capability match
    if (criteria.requiredCapabilities.length > 0) {
      const matches = criteria.requiredCapabilities.filter(cap =>
        model.capabilities.includes(cap),
      );
      reasons.push(
        `Matches ${matches.length}/${criteria.requiredCapabilities.length} required capabilities`,
      );
    }

    // Tier match
    reasons.push(
      `Model tier (${model.tier}) appropriate for ${criteria.taskComplexity} complexity`,
    );

    // Cost
    reasons.push(`Cost per token: $${model.costPerToken.toFixed(8)}`);

    // Speed
    reasons.push(`Average latency: ${model.averageLatencyMs}ms`);

    // Special features
    if (criteria.requiresTools && model.supportsTools) {
      reasons.push('Supports tool use');
    }
    if (criteria.requiresVision && model.supportsVision) {
      reasons.push('Supports vision');
    }

    return reasons;
  }

  /**
   * Gets cache key for a selection
   */
  private getCacheKey(
    task: DelegationTask,
    criteria: ModelSelectionCriteriaInput,
  ): string {
    const parts = [
      task.requiredCapabilities?.join(',') ?? '',
      criteria.taskComplexity ?? '',
      criteria.preferredTier ?? '',
      criteria.requiresTools ?? false,
      criteria.requiresVision ?? false,
      criteria.maxCost ?? '',
      criteria.maxLatency ?? '',
    ];
    return parts.join('|');
  }

  /**
   * Gets from cache if valid
   */
  private getFromCache(key: string): ModelSelectionResult | null {
    if (!this.options.enableCaching) {
      return null;
    }

    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    if (new Date() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Adds to cache
   */
  private addToCache(key: string, result: ModelSelectionResult): void {
    if (!this.options.enableCaching) {
      return;
    }

    this.cache.set(key, {
      key,
      result,
      expiresAt: new Date(Date.now() + this.options.cacheTTL),
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a model selector with default configuration
 *
 * @returns Configured ModelSelector instance
 */
export function createModelSelector(): ModelSelector {
  return new ModelSelector();
}

/**
 * Creates a model selector optimized for cost
 *
 * @returns Cost-optimized ModelSelector instance
 */
export function createCostOptimizedSelector(): ModelSelector {
  return new ModelSelector({
    strategy: 'cost_optimize',
    defaultModelId: 'gpt-4o-mini',
  });
}

/**
 * Creates a model selector optimized for speed
 *
 * @returns Speed-optimized ModelSelector instance
 */
export function createSpeedOptimizedSelector(): ModelSelector {
  return new ModelSelector({
    strategy: 'speed_optimize',
    defaultModelId: 'gpt-4o-mini',
  });
}

/**
 * Creates a model selector optimized for capability
 *
 * @returns Capability-optimized ModelSelector instance
 */
export function createCapabilityOptimizedSelector(): ModelSelector {
  return new ModelSelector({
    strategy: 'capability_match',
    defaultModelId: 'claude-sonnet-4-5',
  });
}
