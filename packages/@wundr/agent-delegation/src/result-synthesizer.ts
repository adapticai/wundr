/**
 * @wundr/agent-delegation - Result Synthesizer
 *
 * Provides multi-agent result synthesis strategies for combining,
 * voting, and resolving outputs from parallel delegations.
 */

import { v4 as uuidv4 } from 'uuid';

import { DelegationError, DelegationErrorCode } from './types';

import type {
  DelegationResult,
  SynthesisResult,
  SynthesisStrategy,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the result synthesizer
 */
export interface ResultSynthesizerOptions {
  /** Default synthesis strategy */
  readonly defaultStrategy?: SynthesisStrategy;
  /** Minimum confidence threshold for accepting results */
  readonly minConfidence?: number;
  /** Whether to include failed results in synthesis */
  readonly includeFailedResults?: boolean;
  /** Custom merge function for objects */
  readonly customMerge?: (a: unknown, b: unknown) => unknown;
  /** Voting threshold for consensus (0-1) */
  readonly consensusThreshold?: number;
  /** Weights for weighted average synthesis */
  readonly weights?: Map<string, number>;
}

/**
 * Conflict detected during synthesis
 */
export interface SynthesisConflict {
  field: string;
  values: unknown[];
  resolution: string;
}

/**
 * Vote result for voting-based synthesis
 */
interface VoteResult {
  value: unknown;
  votes: number;
  voters: string[];
}

// =============================================================================
// Result Synthesizer Class
// =============================================================================

/**
 * ResultSynthesizer - Synthesizes results from multiple agents
 *
 * @example
 * ```typescript
 * const synthesizer = new ResultSynthesizer({
 *   defaultStrategy: 'merge',
 * });
 *
 * const results: DelegationResult[] = [...];
 * const synthesis = await synthesizer.synthesize(results, 'consensus');
 * console.log('Synthesized output:', synthesis.synthesizedOutput);
 * ```
 */
export class ResultSynthesizer {
  private readonly options: Required<
    Omit<ResultSynthesizerOptions, 'customMerge' | 'weights'>
  > & {
    customMerge?: (a: unknown, b: unknown) => unknown;
    weights: Map<string, number>;
  };

  /**
   * Creates a new ResultSynthesizer instance
   *
   * @param options - Configuration options
   */
  constructor(options: ResultSynthesizerOptions = {}) {
    this.options = {
      defaultStrategy: options.defaultStrategy ?? 'merge',
      minConfidence: options.minConfidence ?? 0.5,
      includeFailedResults: options.includeFailedResults ?? false,
      customMerge: options.customMerge,
      consensusThreshold: options.consensusThreshold ?? 0.6,
      weights: options.weights ?? new Map(),
    };
  }

  /**
   * Synthesizes multiple delegation results
   *
   * @param results - Array of delegation results
   * @param strategy - Synthesis strategy to use
   * @param context - Additional context for synthesis
   * @returns The synthesis result
   * @throws {DelegationError} If synthesis fails
   */
  async synthesize(
    results: DelegationResult[],
    strategy?: SynthesisStrategy,
    context: Record<string, unknown> = {}
  ): Promise<SynthesisResult> {
    const startTime = Date.now();
    const synthesisStrategy = strategy ?? this.options.defaultStrategy;

    // Filter results based on options
    const validResults = this.filterResults(results);

    if (validResults.length === 0) {
      throw new DelegationError(
        DelegationErrorCode.SYNTHESIS_FAILED,
        'No valid results to synthesize',
        { totalResults: results.length }
      );
    }

    let synthesizedOutput: unknown;
    let confidence: number;
    const conflicts: SynthesisConflict[] = [];

    switch (synthesisStrategy) {
      case 'merge': {
        const mergeResult = this.mergeSynthesis(validResults);
        synthesizedOutput = mergeResult.output;
        confidence = mergeResult.confidence;
        conflicts.push(...mergeResult.conflicts);
        break;
      }
      case 'vote':
        ({ output: synthesizedOutput, confidence } =
          this.voteSynthesis(validResults));
        break;
      case 'consensus': {
        const consensusResult = this.consensusSynthesis(validResults);
        synthesizedOutput = consensusResult.output;
        confidence = consensusResult.confidence;
        conflicts.push(...consensusResult.conflicts);
        break;
      }
      case 'best_pick':
        ({ output: synthesizedOutput, confidence } = this.bestPickSynthesis(
          validResults,
          context
        ));
        break;
      case 'weighted_average':
        ({ output: synthesizedOutput, confidence } =
          this.weightedAverageSynthesis(validResults));
        break;
      case 'chain':
        ({ output: synthesizedOutput, confidence } =
          this.chainSynthesis(validResults));
        break;
      default:
        throw new DelegationError(
          DelegationErrorCode.SYNTHESIS_FAILED,
          `Unknown synthesis strategy: ${synthesisStrategy}`
        );
    }

    const duration = Date.now() - startTime;

    return {
      id: uuidv4(),
      strategy: synthesisStrategy,
      inputResults: validResults.map(r => r.taskId),
      synthesizedOutput,
      confidence,
      conflicts,
      duration,
      createdAt: new Date(),
    };
  }

  /**
   * Sets the weight for an agent's results
   *
   * @param agentId - The agent ID
   * @param weight - The weight (0-1)
   */
  setWeight(agentId: string, weight: number): void {
    this.options.weights.set(agentId, Math.max(0, Math.min(1, weight)));
  }

  /**
   * Gets the weight for an agent
   *
   * @param agentId - The agent ID
   * @returns The weight or 1 if not set
   */
  getWeight(agentId: string): number {
    return this.options.weights.get(agentId) ?? 1;
  }

  /**
   * Clears all agent weights
   */
  clearWeights(): void {
    this.options.weights.clear();
  }

  // ==========================================================================
  // Synthesis Strategies
  // ==========================================================================

  /**
   * Merge synthesis - combines all outputs into one
   */
  private mergeSynthesis(results: DelegationResult[]): {
    output: unknown;
    conflicts: SynthesisConflict[];
    confidence: number;
  } {
    const conflicts: SynthesisConflict[] = [];

    // If all results are objects, deep merge them
    if (results.every(r => this.isPlainObject(r.output))) {
      const merged = this.deepMerge(
        results.map(r => r.output as Record<string, unknown>),
        conflicts
      );
      const confidence = this.calculateMergeConfidence(results, conflicts);
      return { output: merged, conflicts, confidence };
    }

    // If all results are arrays, concatenate them
    if (results.every(r => Array.isArray(r.output))) {
      const merged = results.flatMap(r => r.output as unknown[]);
      return { output: merged, conflicts: [], confidence: 1 };
    }

    // If all results are the same primitive, return it
    const firstOutput = results[0].output;
    if (results.every(r => r.output === firstOutput)) {
      return { output: firstOutput, conflicts: [], confidence: 1 };
    }

    // Otherwise, return array of all outputs
    return {
      output: results.map(r => r.output),
      conflicts: [],
      confidence: 0.7,
    };
  }

  /**
   * Vote synthesis - returns the most common output
   */
  private voteSynthesis(results: DelegationResult[]): {
    output: unknown;
    confidence: number;
  } {
    const votes = new Map<string, VoteResult>();

    for (const result of results) {
      const key = JSON.stringify(result.output);
      const existing = votes.get(key);

      if (existing) {
        existing.votes++;
        existing.voters.push(result.agentId);
      } else {
        votes.set(key, {
          value: result.output,
          votes: 1,
          voters: [result.agentId],
        });
      }
    }

    // Find the winner
    let winner: VoteResult | null = null;
    for (const vote of votes.values()) {
      if (!winner || vote.votes > winner.votes) {
        winner = vote;
      }
    }

    if (!winner) {
      return { output: null, confidence: 0 };
    }

    const confidence = winner.votes / results.length;
    return { output: winner.value, confidence };
  }

  /**
   * Consensus synthesis - requires threshold agreement
   */
  private consensusSynthesis(results: DelegationResult[]): {
    output: unknown;
    conflicts: SynthesisConflict[];
    confidence: number;
  } {
    const threshold = this.options.consensusThreshold;
    const conflicts: SynthesisConflict[] = [];

    // If all results are objects, check field-by-field consensus
    if (results.every(r => this.isPlainObject(r.output))) {
      const consensusOutput: Record<string, unknown> = {};
      const allFields = new Set<string>();

      // Collect all fields
      for (const result of results) {
        const output = result.output as Record<string, unknown>;
        for (const key of Object.keys(output)) {
          allFields.add(key);
        }
      }

      // Check consensus for each field
      for (const field of allFields) {
        const values = results
          .map(r => (r.output as Record<string, unknown>)[field])
          .filter(v => v !== undefined);

        const { value, agreement } = this.getConsensusValue(values);

        if (agreement >= threshold) {
          consensusOutput[field] = value;
        } else {
          conflicts.push({
            field,
            values,
            resolution: `No consensus (${(agreement * 100).toFixed(0)}% agreement)`,
          });
        }
      }

      const confidence = 1 - conflicts.length / allFields.size;
      return { output: consensusOutput, conflicts, confidence };
    }

    // For non-objects, fall back to voting
    const voteResult = this.voteSynthesis(results);

    if (voteResult.confidence < threshold) {
      conflicts.push({
        field: 'root',
        values: results.map(r => r.output),
        resolution: 'No consensus reached',
      });
      return { output: null, conflicts, confidence: 0 };
    }

    return { ...voteResult, conflicts };
  }

  /**
   * Best pick synthesis - selects the best result based on criteria
   */
  private bestPickSynthesis(
    results: DelegationResult[],
    context: Record<string, unknown>
  ): {
    output: unknown;
    confidence: number;
  } {
    // Score each result
    const scored = results.map(result => ({
      result,
      score: this.scoreResult(result, context),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) {
      return { output: null, confidence: 0 };
    }

    // Confidence based on score difference from second best
    let confidence = best.score;
    if (scored.length > 1) {
      const second = scored[1];
      const diff = best.score - second.score;
      confidence = Math.min(1, best.score + diff * 0.5);
    }

    return { output: best.result.output, confidence };
  }

  /**
   * Weighted average synthesis - averages numeric outputs by agent weights
   */
  private weightedAverageSynthesis(results: DelegationResult[]): {
    output: unknown;
    confidence: number;
  } {
    // Check if all outputs are numbers
    if (results.every(r => typeof r.output === 'number')) {
      let totalWeight = 0;
      let weightedSum = 0;

      for (const result of results) {
        const weight = this.getWeight(result.agentId);
        weightedSum += (result.output as number) * weight;
        totalWeight += weight;
      }

      const average = totalWeight > 0 ? weightedSum / totalWeight : 0;
      return { output: average, confidence: 0.9 };
    }

    // Check if all outputs are objects with numeric fields
    if (results.every(r => this.isPlainObject(r.output))) {
      const weightedOutput: Record<string, number> = {};
      const fieldWeights: Record<string, number> = {};

      for (const result of results) {
        const weight = this.getWeight(result.agentId);
        const output = result.output as Record<string, unknown>;

        for (const [key, value] of Object.entries(output)) {
          if (typeof value === 'number') {
            weightedOutput[key] = (weightedOutput[key] ?? 0) + value * weight;
            fieldWeights[key] = (fieldWeights[key] ?? 0) + weight;
          }
        }
      }

      // Normalize by weights
      for (const key of Object.keys(weightedOutput)) {
        if (fieldWeights[key] > 0) {
          weightedOutput[key] = weightedOutput[key] / fieldWeights[key];
        }
      }

      return { output: weightedOutput, confidence: 0.85 };
    }

    // Fall back to merge for non-numeric outputs
    return {
      output: results.map(r => r.output),
      confidence: 0.5,
    };
  }

  /**
   * Chain synthesis - uses outputs sequentially as input to next
   */
  private chainSynthesis(results: DelegationResult[]): {
    output: unknown;
    confidence: number;
  } {
    // Sort by completion time
    const sorted = [...results].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
    );

    // Return the last result (final in chain)
    const last = sorted[sorted.length - 1];
    if (!last) {
      return { output: null, confidence: 0 };
    }

    // Confidence based on successful chain completion
    const successCount = results.filter(r => r.status === 'completed').length;
    const confidence = successCount / results.length;

    return { output: last.output, confidence };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Filters results based on options
   */
  private filterResults(results: DelegationResult[]): DelegationResult[] {
    if (this.options.includeFailedResults) {
      return results;
    }
    return results.filter(
      r => r.status === 'completed' && r.output !== undefined
    );
  }

  /**
   * Checks if a value is a plain object
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  /**
   * Deep merges multiple objects
   */
  private deepMerge(
    objects: Record<string, unknown>[],
    conflicts: SynthesisConflict[]
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    // Collect all keys
    const allKeys = new Set<string>();
    for (const obj of objects) {
      for (const key of Object.keys(obj)) {
        allKeys.add(key);
      }
    }

    for (const key of allKeys) {
      const values = objects.map(obj => obj[key]).filter(v => v !== undefined);

      if (values.length === 0) {
        continue;
      }

      // All values are the same
      if (values.every(v => JSON.stringify(v) === JSON.stringify(values[0]))) {
        merged[key] = values[0];
        continue;
      }

      // All values are objects - recurse
      if (values.every(v => this.isPlainObject(v))) {
        merged[key] = this.deepMerge(
          values as Record<string, unknown>[],
          conflicts
        );
        continue;
      }

      // All values are arrays - concatenate or union
      if (values.every(v => Array.isArray(v))) {
        merged[key] = this.mergeArrays(values as unknown[][]);
        continue;
      }

      // Custom merge function
      if (this.options.customMerge) {
        merged[key] = values.reduce((acc, val) =>
          this.options.customMerge!(acc, val)
        );
        continue;
      }

      // Conflict - take the first value and record conflict
      merged[key] = values[0];
      conflicts.push({
        field: key,
        values,
        resolution: 'Used first value',
      });
    }

    return merged;
  }

  /**
   * Merges arrays with deduplication
   */
  private mergeArrays(arrays: unknown[][]): unknown[] {
    const seen = new Set<string>();
    const result: unknown[] = [];

    for (const arr of arrays) {
      for (const item of arr) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
    }

    return result;
  }

  /**
   * Gets the consensus value and agreement level
   */
  private getConsensusValue(values: unknown[]): {
    value: unknown;
    agreement: number;
  } {
    const counts = new Map<string, { value: unknown; count: number }>();

    for (const value of values) {
      const key = JSON.stringify(value);
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { value, count: 1 });
      }
    }

    let maxEntry: { value: unknown; count: number } | null = null;
    for (const entry of counts.values()) {
      if (!maxEntry || entry.count > maxEntry.count) {
        maxEntry = entry;
      }
    }

    if (!maxEntry) {
      return { value: null, agreement: 0 };
    }

    return {
      value: maxEntry.value,
      agreement: maxEntry.count / values.length,
    };
  }

  /**
   * Calculates confidence for merge synthesis
   */
  private calculateMergeConfidence(
    results: DelegationResult[],
    conflicts: SynthesisConflict[]
  ): number {
    const baseConfidence = 1 - conflicts.length * 0.1;
    const successRate =
      results.filter(r => r.status === 'completed').length / results.length;
    return Math.max(0, Math.min(1, baseConfidence * successRate));
  }

  /**
   * Scores a result for best pick synthesis
   */
  private scoreResult(
    result: DelegationResult,
    context: Record<string, unknown>
  ): number {
    let score = 0;

    // Base score for completion
    if (result.status === 'completed') {
      score += 0.5;
    }

    // Score for having output
    if (result.output !== undefined && result.output !== null) {
      score += 0.2;
    }

    // Score based on agent weight
    score += this.getWeight(result.agentId) * 0.2;

    // Penalty for retries
    score -= result.retryCount * 0.05;

    // Score based on duration (faster is better, up to a point)
    const targetDuration = (context['targetDuration'] as number) ?? 5000;
    if (result.duration <= targetDuration) {
      score += 0.1;
    } else {
      score -= Math.min(
        0.1,
        ((result.duration - targetDuration) / targetDuration) * 0.1
      );
    }

    return Math.max(0, Math.min(1, score));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a result synthesizer with default configuration
 *
 * @returns Configured ResultSynthesizer instance
 */
export function createResultSynthesizer(): ResultSynthesizer {
  return new ResultSynthesizer();
}

/**
 * Creates a result synthesizer with merge strategy
 *
 * @returns Merge-strategy ResultSynthesizer instance
 */
export function createMergeSynthesizer(): ResultSynthesizer {
  return new ResultSynthesizer({
    defaultStrategy: 'merge',
  });
}

/**
 * Creates a result synthesizer with consensus strategy
 *
 * @param threshold - Consensus threshold (0-1)
 * @returns Consensus-strategy ResultSynthesizer instance
 */
export function createConsensusSynthesizer(
  threshold: number = 0.6
): ResultSynthesizer {
  return new ResultSynthesizer({
    defaultStrategy: 'consensus',
    consensusThreshold: threshold,
  });
}

/**
 * Creates a result synthesizer with voting strategy
 *
 * @returns Voting-strategy ResultSynthesizer instance
 */
export function createVotingSynthesizer(): ResultSynthesizer {
  return new ResultSynthesizer({
    defaultStrategy: 'vote',
  });
}
