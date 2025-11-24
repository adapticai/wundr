/**
 * Retrieval Critique Module
 *
 * Provides self-critique functionality for assessing retrieval quality
 * and determining when additional retrieval iterations are needed.
 */

import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';

import type { SearchResult, DocumentChunk } from './types';

/**
 * Configuration for retrieval critique
 */
export interface RetrievalCritiqueConfig {
  /** Minimum acceptable relevance score */
  minRelevanceScore: number;
  /** Minimum acceptable coverage score */
  minCoverageScore: number;
  /** Minimum acceptable diversity score */
  minDiversityScore: number;
  /** Maximum allowed redundancy ratio */
  maxRedundancyRatio: number;
  /** Whether to perform deep content analysis */
  deepAnalysis: boolean;
}

/**
 * Default retrieval critique configuration
 */
export const DEFAULT_CRITIQUE_CONFIG: RetrievalCritiqueConfig = {
  minRelevanceScore: 0.7,
  minCoverageScore: 0.6,
  minDiversityScore: 0.5,
  maxRedundancyRatio: 0.3,
  deepAnalysis: true,
};

/**
 * Quality dimension assessed during critique
 */
export interface QualityDimension {
  /** Name of the dimension */
  name: string;
  /** Score for this dimension (0-1) */
  score: number;
  /** Weight of this dimension in overall score */
  weight: number;
  /** Issues identified in this dimension */
  issues: string[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Comprehensive critique result
 */
export interface CritiqueResult {
  /** Overall quality score (0-1) */
  overallScore: number;
  /** Whether retrieval quality is acceptable */
  isAcceptable: boolean;
  /** Whether another retrieval iteration is recommended */
  needsIteration: boolean;
  /** Individual quality dimensions */
  dimensions: QualityDimension[];
  /** Summary of critique */
  summary: string;
  /** Specific recommendations for improvement */
  recommendations: string[];
  /** Query suggestions for next iteration */
  querySuggestions: string[];
}

/**
 * Relevance analysis result
 */
export interface RelevanceAnalysis {
  /** Average relevance score */
  averageScore: number;
  /** Score distribution */
  distribution: { high: number; medium: number; low: number };
  /** Highly relevant chunk IDs */
  highlyRelevantIds: string[];
  /** Low relevance chunk IDs */
  lowRelevanceIds: string[];
}

/**
 * Coverage analysis result
 */
export interface CoverageAnalysis {
  /** Estimated coverage of query concepts */
  conceptCoverage: number;
  /** Covered concepts */
  coveredConcepts: string[];
  /** Missing concepts */
  missingConcepts: string[];
  /** File coverage diversity */
  fileCoverage: number;
}

/**
 * Redundancy analysis result
 */
export interface RedundancyAnalysis {
  /** Redundancy ratio (0-1) */
  redundancyRatio: number;
  /** Groups of redundant chunks */
  redundantGroups: string[][];
  /** Unique information ratio */
  uniqueRatio: number;
}

/**
 * Zod schema for critique config validation
 */
export const RetrievalCritiqueConfigSchema = z.object({
  minRelevanceScore: z.number().min(0).max(1).default(0.7),
  minCoverageScore: z.number().min(0).max(1).default(0.6),
  minDiversityScore: z.number().min(0).max(1).default(0.5),
  maxRedundancyRatio: z.number().min(0).max(1).default(0.3),
  deepAnalysis: z.boolean().default(true),
});

/**
 * Events emitted by the retrieval critic
 */
export interface RetrievalCriticEvents {
  'critique:start': (resultCount: number) => void;
  'critique:dimension': (dimension: QualityDimension) => void;
  'critique:complete': (result: CritiqueResult) => void;
  'critique:error': (error: Error) => void;
}

/**
 * Retrieval quality critic for self-assessment
 *
 * @example
 * ```typescript
 * const critic = new RetrievalCritic();
 * const critique = await critic.critique("auth flow", results);
 *
 * if (critique.needsIteration) {
 *   console.log("Recommendations:", critique.recommendations);
 *   console.log("Query suggestions:", critique.querySuggestions);
 * }
 * ```
 */
export class RetrievalCritic extends EventEmitter<RetrievalCriticEvents> {
  private config: RetrievalCritiqueConfig;

  constructor(config: Partial<RetrievalCritiqueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CRITIQUE_CONFIG, ...config };
  }

  /**
   * Perform comprehensive critique of retrieval results
   *
   * @param query - The search query
   * @param results - Retrieved search results
   * @returns Comprehensive critique result
   */
  async critique(
    query: string,
    results: SearchResult[],
  ): Promise<CritiqueResult> {
    this.emit('critique:start', results.length);

    try {
      const dimensions: QualityDimension[] = [];

      // Analyze relevance
      const relevanceDimension = this.analyzeRelevanceDimension(query, results);
      dimensions.push(relevanceDimension);
      this.emit('critique:dimension', relevanceDimension);

      // Analyze coverage
      const coverageDimension = this.analyzeCoverageDimension(query, results);
      dimensions.push(coverageDimension);
      this.emit('critique:dimension', coverageDimension);

      // Analyze diversity
      const diversityDimension = this.analyzeDiversityDimension(results);
      dimensions.push(diversityDimension);
      this.emit('critique:dimension', diversityDimension);

      // Analyze redundancy
      const redundancyDimension = this.analyzeRedundancyDimension(results);
      dimensions.push(redundancyDimension);
      this.emit('critique:dimension', redundancyDimension);

      // Calculate overall score
      const overallScore = this.calculateOverallScore(dimensions);

      // Determine if acceptable
      const isAcceptable = this.isQualityAcceptable(dimensions);

      // Determine if iteration needed
      const needsIteration = !isAcceptable && results.length > 0;

      // Generate recommendations
      const recommendations = this.generateRecommendations(dimensions);

      // Generate query suggestions
      const querySuggestions = this.generateQuerySuggestions(
        query,
        dimensions,
        results,
      );

      // Generate summary
      const summary = this.generateSummary(dimensions, overallScore);

      const result: CritiqueResult = {
        overallScore,
        isAcceptable,
        needsIteration,
        dimensions,
        summary,
        recommendations,
        querySuggestions,
      };

      this.emit('critique:complete', result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('critique:error', err);
      throw err;
    }
  }

  /**
   * Analyze relevance of retrieval results
   *
   * @param query - The search query
   * @param results - Retrieved results
   * @returns Relevance analysis
   */
  analyzeRelevance(_query: string, results: SearchResult[]): RelevanceAnalysis {
    if (results.length === 0) {
      return {
        averageScore: 0,
        distribution: { high: 0, medium: 0, low: 0 },
        highlyRelevantIds: [],
        lowRelevanceIds: [],
      };
    }

    const scores = results.map(r => r.score);
    const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const distribution = {
      high: results.filter(r => r.score >= 0.8).length,
      medium: results.filter(r => r.score >= 0.6 && r.score < 0.8).length,
      low: results.filter(r => r.score < 0.6).length,
    };

    const highlyRelevantIds = results
      .filter(r => r.score >= 0.8)
      .map(r => r.chunk.id);
    const lowRelevanceIds = results
      .filter(r => r.score < 0.6)
      .map(r => r.chunk.id);

    return {
      averageScore,
      distribution,
      highlyRelevantIds,
      lowRelevanceIds,
    };
  }

  /**
   * Analyze coverage of query concepts
   *
   * @param query - The search query
   * @param results - Retrieved results
   * @returns Coverage analysis
   */
  analyzeCoverage(query: string, results: SearchResult[]): CoverageAnalysis {
    const queryConcepts = this.extractConcepts(query);
    const resultContent = results
      .map(r => r.chunk.content.toLowerCase())
      .join(' ');

    const coveredConcepts: string[] = [];
    const missingConcepts: string[] = [];

    for (const concept of queryConcepts) {
      if (resultContent.includes(concept.toLowerCase())) {
        coveredConcepts.push(concept);
      } else {
        missingConcepts.push(concept);
      }
    }

    const conceptCoverage =
      queryConcepts.length > 0
        ? coveredConcepts.length / queryConcepts.length
        : 0;

    // Calculate file coverage
    const uniqueFiles = new Set(results.map(r => r.chunk.metadata.sourceFile));
    const fileCoverage = Math.min(uniqueFiles.size / 5, 1); // Normalize to max of 5 files

    return {
      conceptCoverage,
      coveredConcepts,
      missingConcepts,
      fileCoverage,
    };
  }

  /**
   * Analyze redundancy in retrieval results
   *
   * @param results - Retrieved results
   * @returns Redundancy analysis
   */
  analyzeRedundancy(results: SearchResult[]): RedundancyAnalysis {
    if (results.length <= 1) {
      return {
        redundancyRatio: 0,
        redundantGroups: [],
        uniqueRatio: 1,
      };
    }

    const redundantGroups: string[][] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < results.length; i++) {
      if (processedIds.has(results[i]!.chunk.id)) {
        continue;
      }

      const group: string[] = [results[i]!.chunk.id];

      for (let j = i + 1; j < results.length; j++) {
        if (processedIds.has(results[j]!.chunk.id)) {
          continue;
        }

        const similarity = this.calculateContentSimilarity(
          results[i]!.chunk,
          results[j]!.chunk,
        );

        if (similarity > 0.7) {
          group.push(results[j]!.chunk.id);
          processedIds.add(results[j]!.chunk.id);
        }
      }

      if (group.length > 1) {
        redundantGroups.push(group);
        processedIds.add(results[i]!.chunk.id);
      }
    }

    const redundantCount = redundantGroups.reduce(
      (sum, group) => sum + group.length - 1,
      0,
    );
    const redundancyRatio =
      results.length > 0 ? redundantCount / results.length : 0;
    const uniqueRatio = 1 - redundancyRatio;

    return {
      redundancyRatio,
      redundantGroups,
      uniqueRatio,
    };
  }

  /**
   * Score relevance of a single result
   *
   * @param query - The search query
   * @param result - Single search result
   * @returns Relevance score (0-1)
   */
  scoreRelevance(query: string, result: SearchResult): number {
    const queryConcepts = this.extractConcepts(query);
    const content = result.chunk.content.toLowerCase();

    // Base score from embedding similarity
    let score = result.score;

    // Bonus for concept presence
    const conceptMatches = queryConcepts.filter(c =>
      content.includes(c.toLowerCase()),
    ).length;
    const conceptBonus =
      queryConcepts.length > 0
        ? (conceptMatches / queryConcepts.length) * 0.2
        : 0;

    // Bonus for metadata relevance
    let metadataBonus = 0;
    const metadata = result.chunk.metadata;
    for (const concept of queryConcepts) {
      if (
        metadata.functionName?.toLowerCase().includes(concept.toLowerCase())
      ) {
        metadataBonus += 0.1;
      }
      if (metadata.className?.toLowerCase().includes(concept.toLowerCase())) {
        metadataBonus += 0.1;
      }
    }

    score = Math.min(1, score + conceptBonus + metadataBonus);
    return score;
  }

  /**
   * Get the current configuration
   */
  getConfig(): RetrievalCritiqueConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetrievalCritiqueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private helper methods

  private analyzeRelevanceDimension(
    query: string,
    results: SearchResult[],
  ): QualityDimension {
    const analysis = this.analyzeRelevance(query, results);
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (analysis.averageScore < this.config.minRelevanceScore) {
      issues.push(
        `Average relevance score (${analysis.averageScore.toFixed(2)}) below threshold`,
      );
      recommendations.push(
        'Consider reformulating query with more specific terms',
      );
    }

    if (analysis.distribution.low > analysis.distribution.high) {
      issues.push('More low-relevance results than high-relevance results');
      recommendations.push(
        'Filter out low-scoring results or adjust retrieval parameters',
      );
    }

    return {
      name: 'relevance',
      score: analysis.averageScore,
      weight: 0.4,
      issues,
      recommendations,
    };
  }

  private analyzeCoverageDimension(
    query: string,
    results: SearchResult[],
  ): QualityDimension {
    const analysis = this.analyzeCoverage(query, results);
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (analysis.conceptCoverage < this.config.minCoverageScore) {
      issues.push(
        `Concept coverage (${(analysis.conceptCoverage * 100).toFixed(0)}%) below threshold`,
      );
      if (analysis.missingConcepts.length > 0) {
        issues.push(`Missing concepts: ${analysis.missingConcepts.join(', ')}`);
        recommendations.push(
          `Add query terms for: ${analysis.missingConcepts.join(', ')}`,
        );
      }
    }

    if (analysis.fileCoverage < 0.3) {
      issues.push('Results concentrated in few files');
      recommendations.push('Expand search to include more source files');
    }

    return {
      name: 'coverage',
      score: analysis.conceptCoverage,
      weight: 0.3,
      issues,
      recommendations,
    };
  }

  private analyzeDiversityDimension(results: SearchResult[]): QualityDimension {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Calculate diversity based on unique files and content types
    const uniqueFiles = new Set(results.map(r => r.chunk.metadata.sourceFile));
    const uniqueTypes = new Set(
      results.map(r => r.chunk.metadata.type).filter(Boolean),
    );

    const fileDiversity = Math.min(
      uniqueFiles.size / Math.max(results.length * 0.5, 1),
      1,
    );
    const typeDiversity = uniqueTypes.size / 4; // 4 possible types

    const diversityScore = (fileDiversity + typeDiversity) / 2;

    if (diversityScore < this.config.minDiversityScore) {
      issues.push('Low diversity in retrieved results');
      if (fileDiversity < 0.5) {
        recommendations.push('Include results from more diverse file sources');
      }
      if (typeDiversity < 0.5) {
        recommendations.push(
          'Include different content types (code, comments, documentation)',
        );
      }
    }

    return {
      name: 'diversity',
      score: diversityScore,
      weight: 0.15,
      issues,
      recommendations,
    };
  }

  private analyzeRedundancyDimension(
    results: SearchResult[],
  ): QualityDimension {
    const analysis = this.analyzeRedundancy(results);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Score is inverse of redundancy (high uniqueness = high score)
    const score = analysis.uniqueRatio;

    if (analysis.redundancyRatio > this.config.maxRedundancyRatio) {
      issues.push(
        `High redundancy (${(analysis.redundancyRatio * 100).toFixed(0)}%) in results`,
      );
      recommendations.push('Remove duplicate or near-duplicate results');
      if (analysis.redundantGroups.length > 0) {
        recommendations.push(
          `${analysis.redundantGroups.length} groups of redundant content found`,
        );
      }
    }

    return {
      name: 'redundancy',
      score,
      weight: 0.15,
      issues,
      recommendations,
    };
  }

  private calculateOverallScore(dimensions: QualityDimension[]): number {
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const weightedSum = dimensions.reduce(
      (sum, d) => sum + d.score * d.weight,
      0,
    );

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private isQualityAcceptable(dimensions: QualityDimension[]): boolean {
    for (const dimension of dimensions) {
      switch (dimension.name) {
        case 'relevance':
          if (dimension.score < this.config.minRelevanceScore) {
            return false;
          }
          break;
        case 'coverage':
          if (dimension.score < this.config.minCoverageScore) {
            return false;
          }
          break;
        case 'diversity':
          if (dimension.score < this.config.minDiversityScore) {
            return false;
          }
          break;
        case 'redundancy':
          if (dimension.score < 1 - this.config.maxRedundancyRatio) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  private generateRecommendations(dimensions: QualityDimension[]): string[] {
    const recommendations: string[] = [];

    for (const dimension of dimensions) {
      recommendations.push(...dimension.recommendations);
    }

    return [...new Set(recommendations)];
  }

  private generateQuerySuggestions(
    query: string,
    dimensions: QualityDimension[],
    results: SearchResult[],
  ): string[] {
    const suggestions: string[] = [];
    const concepts = this.extractConcepts(query);

    // Find coverage dimension
    const coverageDim = dimensions.find(d => d.name === 'coverage');
    if (coverageDim && coverageDim.score < this.config.minCoverageScore) {
      // Suggest more specific query
      const topResult = results[0];
      if (topResult?.chunk.metadata.functionName) {
        suggestions.push(`${query} ${topResult.chunk.metadata.functionName}`);
      }
    }

    // If relevance is low, suggest synonyms
    const relevanceDim = dimensions.find(d => d.name === 'relevance');
    if (relevanceDim && relevanceDim.score < this.config.minRelevanceScore) {
      const synonyms = this.getSynonyms(concepts);
      if (synonyms.length > 0) {
        suggestions.push(
          [...concepts.slice(0, 2), ...synonyms.slice(0, 2)].join(' '),
        );
      }
    }

    // If diversity is low, suggest broader query
    const diversityDim = dimensions.find(d => d.name === 'diversity');
    if (diversityDim && diversityDim.score < this.config.minDiversityScore) {
      suggestions.push(`${query} implementation example`);
    }

    return [...new Set(suggestions)];
  }

  private generateSummary(
    dimensions: QualityDimension[],
    overallScore: number,
  ): string {
    const totalIssues = dimensions.reduce((sum, d) => sum + d.issues.length, 0);

    if (totalIssues === 0) {
      return `Retrieval quality is good (score: ${(overallScore * 100).toFixed(0)}%). No significant issues found.`;
    }

    const problemDimensions = dimensions
      .filter(d => d.issues.length > 0)
      .map(d => d.name);

    return `Retrieval quality needs improvement (score: ${(overallScore * 100).toFixed(0)}%). Issues found in: ${problemDimensions.join(', ')}.`;
  }

  private extractConcepts(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'how',
      'what',
      'when',
      'where',
      'why',
      'which',
      'this',
      'that',
      'these',
      'those',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term));
  }

  private calculateContentSimilarity(
    chunk1: DocumentChunk,
    chunk2: DocumentChunk,
  ): number {
    const terms1 = new Set(this.extractConcepts(chunk1.content));
    const terms2 = new Set(this.extractConcepts(chunk2.content));

    const intersection = new Set([...terms1].filter(t => terms2.has(t)));
    const union = new Set([...terms1, ...terms2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private getSynonyms(terms: string[]): string[] {
    const synonymMap: Record<string, string[]> = {
      function: ['method', 'handler', 'callback'],
      class: ['type', 'interface', 'struct'],
      error: ['exception', 'failure', 'issue'],
      auth: ['authentication', 'login', 'session'],
      data: ['information', 'payload', 'content'],
      api: ['endpoint', 'service', 'route'],
      test: ['spec', 'verify', 'check'],
    };

    const synonyms: string[] = [];
    for (const term of terms) {
      const termSynonyms = synonymMap[term];
      if (termSynonyms) {
        synonyms.push(...termSynonyms);
      }
    }

    return synonyms;
  }
}

/**
 * Factory function to create a retrieval critic
 *
 * @param config - Optional configuration
 * @returns Configured RetrievalCritic instance
 */
export function createRetrievalCritic(
  config?: Partial<RetrievalCritiqueConfig>,
): RetrievalCritic {
  return new RetrievalCritic(config);
}
