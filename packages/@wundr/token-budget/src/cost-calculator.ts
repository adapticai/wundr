/**
 * @wundr.io/token-budget - Cost Calculator
 *
 * Utilities for calculating token costs across different models and providers.
 * Supports caching, batch discounts, and custom pricing configurations.
 */

import { DEFAULT_MODEL_PRICING } from './types';

import type { ModelPricing, TokenUsage, OperationType } from './types';

// ============================================================================
// Cost Calculator Class
// ============================================================================

/**
 * Token cost calculator for various AI models
 *
 * @example
 * ```typescript
 * const calculator = new CostCalculator();
 *
 * // Calculate cost for a single operation
 * const cost = calculator.calculateCost({
 *   model: 'claude-sonnet-4-20250514',
 *   inputTokens: 1000,
 *   outputTokens: 500,
 * });
 *
 * // Add custom pricing
 * calculator.addPricing({
 *   modelId: 'custom-model',
 *   inputCostPer1K: 0.002,
 *   outputCostPer1K: 0.01,
 * });
 * ```
 */
export class CostCalculator {
  private pricingMap: Map<string, ModelPricing>;

  /**
   * Creates a new CostCalculator instance
   *
   * @param customPricing - Optional custom pricing configurations to add
   */
  constructor(customPricing: ModelPricing[] = []) {
    this.pricingMap = new Map();

    // Load default pricing
    for (const pricing of DEFAULT_MODEL_PRICING) {
      this.pricingMap.set(pricing.modelId, pricing);
    }

    // Load custom pricing (overrides defaults)
    for (const pricing of customPricing) {
      this.pricingMap.set(pricing.modelId, pricing);
    }
  }

  /**
   * Calculates the cost for a given token usage
   *
   * @param options - Cost calculation options
   * @returns Cost in USD
   */
  calculateCost(options: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheHit?: boolean;
  }): number {
    const { model, inputTokens, outputTokens, cacheHit = false } = options;

    const pricing = this.getPricing(model);
    if (!pricing) {
      throw new CostCalculationError(
        `Unknown model: ${model}. Please add pricing configuration.`
      );
    }

    let inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;

    // Apply cache discount if applicable
    if (cacheHit && pricing.cacheDiscount > 0) {
      inputCost *= 1 - pricing.cacheDiscount;
    }

    return Number((inputCost + outputCost).toFixed(6));
  }

  /**
   * Estimates cost for a planned operation
   *
   * @param options - Estimation options
   * @returns Estimated cost breakdown
   */
  estimateCost(options: {
    model: string;
    inputTokens: number;
    estimatedOutputTokens: number;
    cacheHitProbability?: number;
  }): CostEstimate {
    const {
      model,
      inputTokens,
      estimatedOutputTokens,
      cacheHitProbability = 0,
    } = options;

    const pricing = this.getPricing(model);
    if (!pricing) {
      throw new CostCalculationError(`Unknown model: ${model}`);
    }

    const baseCost = this.calculateCost({
      model,
      inputTokens,
      outputTokens: estimatedOutputTokens,
      cacheHit: false,
    });

    const cachedCost = this.calculateCost({
      model,
      inputTokens,
      outputTokens: estimatedOutputTokens,
      cacheHit: true,
    });

    // Expected cost based on cache probability
    const expectedCost =
      cacheHitProbability * cachedCost + (1 - cacheHitProbability) * baseCost;

    return {
      model,
      inputTokens,
      estimatedOutputTokens,
      inputCost: (inputTokens / 1000) * pricing.inputCostPer1K,
      outputCost: (estimatedOutputTokens / 1000) * pricing.outputCostPer1K,
      baseCost,
      cachedCost,
      expectedCost,
      savingsWithCache: baseCost - cachedCost,
    };
  }

  /**
   * Calculates cost for a batch of operations
   *
   * @param usages - Array of token usage records
   * @returns Total cost and breakdown
   */
  calculateBatchCost(usages: TokenUsage[]): BatchCostResult {
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const byModel: Record<string, ModelCostBreakdown> = {};
    const byOperation: Record<string, OperationCostBreakdown> = {};

    for (const usage of usages) {
      const cost = this.calculateCost({
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheHit: usage.cacheHit,
      });

      totalCost += cost;
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;

      // Aggregate by model
      if (!byModel[usage.model]) {
        byModel[usage.model] = {
          model: usage.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
          operationCount: 0,
        };
      }
      byModel[usage.model].inputTokens += usage.inputTokens;
      byModel[usage.model].outputTokens += usage.outputTokens;
      byModel[usage.model].totalTokens += usage.totalTokens;
      byModel[usage.model].cost += cost;
      byModel[usage.model].operationCount += 1;

      // Aggregate by operation type
      const opType = usage.operationType || 'other';
      if (!byOperation[opType]) {
        byOperation[opType] = {
          operationType: opType,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0,
          operationCount: 0,
        };
      }
      byOperation[opType].inputTokens += usage.inputTokens;
      byOperation[opType].outputTokens += usage.outputTokens;
      byOperation[opType].totalTokens += usage.totalTokens;
      byOperation[opType].cost += cost;
      byOperation[opType].operationCount += 1;
    }

    return {
      totalCost: Number(totalCost.toFixed(6)),
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      operationCount: usages.length,
      avgCostPerOperation:
        usages.length > 0 ? Number((totalCost / usages.length).toFixed(6)) : 0,
      byModel,
      byOperation,
    };
  }

  /**
   * Compares costs across different models for the same operation
   *
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Estimated output tokens
   * @param models - Models to compare (defaults to all known models)
   * @returns Comparison results sorted by cost (cheapest first)
   */
  compareModels(
    inputTokens: number,
    outputTokens: number,
    models?: string[]
  ): ModelComparison[] {
    const modelsToCompare = models || Array.from(this.pricingMap.keys());
    const comparisons: ModelComparison[] = [];

    for (const model of modelsToCompare) {
      const pricing = this.getPricing(model);
      if (!pricing) {
        continue;
      }

      const cost = this.calculateCost({
        model,
        inputTokens,
        outputTokens,
      });

      comparisons.push({
        model,
        cost,
        inputCost: (inputTokens / 1000) * pricing.inputCostPer1K,
        outputCost: (outputTokens / 1000) * pricing.outputCostPer1K,
        contextWindow: pricing.contextWindow,
        hasCaching: pricing.isCached || pricing.cacheDiscount > 0,
      });
    }

    // Sort by cost (ascending)
    comparisons.sort((a, b) => a.cost - b.cost);

    // Add relative cost information
    if (comparisons.length > 0) {
      const cheapestCost = comparisons[0].cost;
      for (const comparison of comparisons) {
        comparison.relativeCost =
          cheapestCost > 0 ? comparison.cost / cheapestCost : 1;
      }
    }

    return comparisons;
  }

  /**
   * Gets pricing for a specific model
   *
   * @param model - Model identifier
   * @returns Pricing configuration or undefined if not found
   */
  getPricing(model: string): ModelPricing | undefined {
    return this.pricingMap.get(model);
  }

  /**
   * Adds or updates pricing for a model
   *
   * @param pricing - Pricing configuration
   */
  addPricing(pricing: ModelPricing): void {
    this.pricingMap.set(pricing.modelId, pricing);
  }

  /**
   * Removes pricing for a model
   *
   * @param model - Model identifier
   * @returns True if removed, false if not found
   */
  removePricing(model: string): boolean {
    return this.pricingMap.delete(model);
  }

  /**
   * Gets all configured model IDs
   *
   * @returns Array of model identifiers
   */
  getConfiguredModels(): string[] {
    return Array.from(this.pricingMap.keys());
  }

  /**
   * Gets all pricing configurations
   *
   * @returns Array of pricing configurations
   */
  getAllPricing(): ModelPricing[] {
    return Array.from(this.pricingMap.values());
  }

  /**
   * Calculates cost savings from using cache
   *
   * @param model - Model identifier
   * @param inputTokens - Input tokens
   * @param outputTokens - Output tokens
   * @returns Savings information
   */
  calculateCacheSavings(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): CacheSavings {
    const pricing = this.getPricing(model);
    if (!pricing) {
      throw new CostCalculationError(`Unknown model: ${model}`);
    }

    const baseCost = this.calculateCost({
      model,
      inputTokens,
      outputTokens,
      cacheHit: false,
    });

    const cachedCost = this.calculateCost({
      model,
      inputTokens,
      outputTokens,
      cacheHit: true,
    });

    const savings = baseCost - cachedCost;

    return {
      baseCost,
      cachedCost,
      savings,
      savingsPercent:
        baseCost > 0 ? Number(((savings / baseCost) * 100).toFixed(2)) : 0,
      cacheDiscount: pricing.cacheDiscount,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Cost estimate for a planned operation
 */
export interface CostEstimate {
  model: string;
  inputTokens: number;
  estimatedOutputTokens: number;
  inputCost: number;
  outputCost: number;
  baseCost: number;
  cachedCost: number;
  expectedCost: number;
  savingsWithCache: number;
}

/**
 * Model cost breakdown
 */
export interface ModelCostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  operationCount: number;
}

/**
 * Operation cost breakdown
 */
export interface OperationCostBreakdown {
  operationType: OperationType | string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  operationCount: number;
}

/**
 * Batch cost calculation result
 */
export interface BatchCostResult {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  operationCount: number;
  avgCostPerOperation: number;
  byModel: Record<string, ModelCostBreakdown>;
  byOperation: Record<string, OperationCostBreakdown>;
}

/**
 * Model comparison result
 */
export interface ModelComparison {
  model: string;
  cost: number;
  inputCost: number;
  outputCost: number;
  contextWindow?: number;
  hasCaching: boolean;
  relativeCost?: number;
}

/**
 * Cache savings information
 */
export interface CacheSavings {
  baseCost: number;
  cachedCost: number;
  savings: number;
  savingsPercent: number;
  cacheDiscount: number;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown during cost calculation
 */
export class CostCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostCalculationError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a pre-configured cost calculator with default pricing
 *
 * @returns CostCalculator instance
 */
export function createCostCalculator(): CostCalculator {
  return new CostCalculator();
}

/**
 * Quick cost calculation without creating a calculator instance
 *
 * @param model - Model identifier
 * @param inputTokens - Input tokens
 * @param outputTokens - Output tokens
 * @returns Cost in USD
 */
export function quickCostCalculation(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const calculator = new CostCalculator();
  return calculator.calculateCost({ model, inputTokens, outputTokens });
}

/**
 * Estimates tokens from text (rough estimate: ~4 chars per token for English)
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokensFromText(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  // This is a simplification; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

/**
 * Formats cost as a human-readable string
 *
 * @param costUsd - Cost in USD
 * @returns Formatted string (e.g., "$0.0123")
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(4)}`;
  } else if (costUsd < 1) {
    return `$${costUsd.toFixed(3)}`;
  } else {
    return `$${costUsd.toFixed(2)}`;
  }
}
