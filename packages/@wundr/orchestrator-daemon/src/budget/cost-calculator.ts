/**
 * Cost Calculator - Model pricing and cost estimation
 */

import type {
  ModelPricing,
  CostEstimate,
  CostBreakdown,
  CostProjection,
  TokenUsageRecord,
} from './types';

/**
 * Default model pricing (as of 2025-01-01)
 */
const DEFAULT_MODEL_PRICING: ModelPricing[] = [
  // Anthropic Claude models
  {
    modelId: 'claude-sonnet-4-5',
    provider: 'anthropic',
    inputTokenCost: 3.0, // $3 per 1M tokens
    outputTokenCost: 15.0, // $15 per 1M tokens
    currency: 'USD',
    effectiveDate: new Date('2025-01-01'),
  },
  {
    modelId: 'claude-3-opus',
    provider: 'anthropic',
    inputTokenCost: 15.0,
    outputTokenCost: 75.0,
    currency: 'USD',
    effectiveDate: new Date('2024-03-01'),
  },
  {
    modelId: 'claude-3-sonnet',
    provider: 'anthropic',
    inputTokenCost: 3.0,
    outputTokenCost: 15.0,
    currency: 'USD',
    effectiveDate: new Date('2024-03-01'),
  },
  {
    modelId: 'claude-3-haiku',
    provider: 'anthropic',
    inputTokenCost: 0.25,
    outputTokenCost: 1.25,
    currency: 'USD',
    effectiveDate: new Date('2024-03-01'),
  },
  // OpenAI models
  {
    modelId: 'gpt-4-turbo',
    provider: 'openai',
    inputTokenCost: 10.0,
    outputTokenCost: 30.0,
    currency: 'USD',
    effectiveDate: new Date('2024-01-01'),
  },
  {
    modelId: 'gpt-4',
    provider: 'openai',
    inputTokenCost: 30.0,
    outputTokenCost: 60.0,
    currency: 'USD',
    effectiveDate: new Date('2023-03-01'),
  },
  {
    modelId: 'gpt-3.5-turbo',
    provider: 'openai',
    inputTokenCost: 0.5,
    outputTokenCost: 1.5,
    currency: 'USD',
    effectiveDate: new Date('2023-03-01'),
  },
  // Google models
  {
    modelId: 'gemini-pro',
    provider: 'google',
    inputTokenCost: 0.5,
    outputTokenCost: 1.5,
    currency: 'USD',
    effectiveDate: new Date('2024-01-01'),
  },
  {
    modelId: 'gemini-ultra',
    provider: 'google',
    inputTokenCost: 10.0,
    outputTokenCost: 30.0,
    currency: 'USD',
    effectiveDate: new Date('2024-01-01'),
  },
];

/**
 * Currency exchange rates (base: USD)
 */
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
};

/**
 * Cost Calculator
 */
export class CostCalculator {
  private pricingMap: Map<string, ModelPricing>;
  private customPricing: ModelPricing[] = [];

  constructor(customPricing?: ModelPricing[]) {
    this.pricingMap = new Map();
    this.loadPricing([...DEFAULT_MODEL_PRICING, ...(customPricing || [])]);
  }

  /**
   * Load pricing data into the map
   */
  private loadPricing(pricing: ModelPricing[]): void {
    for (const price of pricing) {
      this.pricingMap.set(price.modelId, price);
    }
  }

  /**
   * Add or update custom pricing for a model
   */
  public addCustomPricing(pricing: ModelPricing): void {
    this.pricingMap.set(pricing.modelId, pricing);
    this.customPricing.push(pricing);
  }

  /**
   * Get pricing for a specific model
   */
  public getModelPricing(modelId: string): ModelPricing | null {
    return this.pricingMap.get(modelId) || null;
  }

  /**
   * Calculate cost for a single usage record
   */
  public calculateRecordCost(
    record: TokenUsageRecord,
    targetCurrency: 'USD' | 'EUR' | 'GBP' = 'USD',
  ): number {
    const pricing = this.pricingMap.get(record.modelId);
    if (!pricing) {
      // Unknown model, return 0 cost
      return 0;
    }

    // Calculate cost per 1M tokens
    const inputCost = (record.inputTokens / 1_000_000) * pricing.inputTokenCost;
    const outputCost = (record.outputTokens / 1_000_000) * pricing.outputTokenCost;
    const totalCost = inputCost + outputCost;

    // Convert currency if needed
    return this.convertCurrency(totalCost, pricing.currency, targetCurrency);
  }

  /**
   * Calculate total cost estimate from usage records
   */
  public calculateCostEstimate(
    records: TokenUsageRecord[],
    targetCurrency: 'USD' | 'EUR' | 'GBP' = 'USD',
    includeProjection = false,
    projectionPeriod?: 'daily' | 'weekly' | 'monthly',
  ): CostEstimate {
    // Group records by model
    const modelGroups = new Map<string, TokenUsageRecord[]>();
    for (const record of records) {
      const existing = modelGroups.get(record.modelId) || [];
      existing.push(record);
      modelGroups.set(record.modelId, existing);
    }

    // Calculate breakdown for each model
    const breakdown: CostBreakdown[] = [];
    let totalCost = 0;

    for (const [modelId, modelRecords] of modelGroups) {
      const pricing = this.pricingMap.get(modelId);
      if (!pricing) {
        // Skip unknown models
        continue;
      }

      const inputTokens = modelRecords.reduce((sum, r) => sum + r.inputTokens, 0);
      const outputTokens = modelRecords.reduce((sum, r) => sum + r.outputTokens, 0);

      const inputCost = (inputTokens / 1_000_000) * pricing.inputTokenCost;
      const outputCost = (outputTokens / 1_000_000) * pricing.outputTokenCost;
      const convertedInputCost = this.convertCurrency(inputCost, pricing.currency, targetCurrency);
      const convertedOutputCost = this.convertCurrency(outputCost, pricing.currency, targetCurrency);
      const convertedTotal = convertedInputCost + convertedOutputCost;

      totalCost += convertedTotal;

      breakdown.push({
        modelId,
        provider: pricing.provider,
        inputTokens,
        outputTokens,
        inputCost: convertedInputCost,
        outputCost: convertedOutputCost,
        totalCost: convertedTotal,
        percentage: 0, // Will be calculated after total is known
      });
    }

    // Calculate percentages
    for (const item of breakdown) {
      item.percentage = totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0;
    }

    // Sort by cost descending
    breakdown.sort((a, b) => b.totalCost - a.totalCost);

    // Calculate projection if requested
    let projection: CostProjection | undefined;
    if (includeProjection && projectionPeriod && records.length > 0) {
      projection = this.calculateProjection(records, totalCost, projectionPeriod);
    }

    return {
      totalCost,
      currency: targetCurrency,
      breakdown,
      projection,
    };
  }

  /**
   * Calculate cost projection based on current usage rate
   */
  private calculateProjection(
    records: TokenUsageRecord[],
    currentCost: number,
    period: 'daily' | 'weekly' | 'monthly',
  ): CostProjection {
    if (records.length === 0) {
      return {
        projectionPeriod: period,
        projectedCost: 0,
        confidence: 0,
        basedOnDays: 0,
      };
    }

    // Find time range of records
    const timestamps = records.map(r => r.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const durationMs = maxTime - minTime;
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    if (durationDays === 0) {
      // All records from same time, can't project
      return {
        projectionPeriod: period,
        projectedCost: 0,
        confidence: 0,
        basedOnDays: 0,
      };
    }

    // Calculate daily rate
    const dailyRate = currentCost / durationDays;

    // Project based on period
    const periodMultiplier = {
      daily: 1,
      weekly: 7,
      monthly: 30,
    };

    const projectedCost = dailyRate * periodMultiplier[period];

    // Calculate confidence (higher with more data)
    const confidence = Math.min(0.95, Math.max(0.1, durationDays / 30));

    return {
      projectionPeriod: period,
      projectedCost,
      confidence,
      basedOnDays: Math.round(durationDays * 10) / 10,
    };
  }

  /**
   * Convert cost between currencies
   */
  public convertCurrency(
    amount: number,
    fromCurrency: 'USD' | 'EUR' | 'GBP',
    toCurrency: 'USD' | 'EUR' | 'GBP',
  ): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Convert to USD first, then to target currency
    const usdAmount = amount / EXCHANGE_RATES[fromCurrency];
    return usdAmount * EXCHANGE_RATES[toCurrency];
  }

  /**
   * Get all available model pricing
   */
  public getAllPricing(): ModelPricing[] {
    return Array.from(this.pricingMap.values());
  }

  /**
   * Calculate cost per 1K tokens for a model
   */
  public getCostPer1KTokens(
    modelId: string,
    type: 'input' | 'output',
  ): number | null {
    const pricing = this.pricingMap.get(modelId);
    if (!pricing) {
      return null;
    }

    const costPer1M = type === 'input'
      ? pricing.inputTokenCost
      : pricing.outputTokenCost;

    return costPer1M / 1000; // Convert from per 1M to per 1K
  }
}

/**
 * Singleton instance
 */
let calculatorInstance: CostCalculator | null = null;

/**
 * Get the singleton cost calculator instance
 */
export function getCostCalculator(customPricing?: ModelPricing[]): CostCalculator {
  if (!calculatorInstance || customPricing) {
    calculatorInstance = new CostCalculator(customPricing);
  }
  return calculatorInstance;
}
