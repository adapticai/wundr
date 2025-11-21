/**
 * RAG-Enhanced Drift Detection
 *
 * Provides semantic pattern comparison using RAG (Retrieval-Augmented Generation)
 * to detect code pattern drift between baseline and current states.
 *
 * @module @wundr/mcp-server/tools/drift-detection-rag
 */

import type { ToolResult } from './index.js';
import { ragFileSearchHandler, ragStoreManageHandler } from './rag/handlers.js';
import type { RagFileSearchInput, RagStoreManageInput, FileSearchResult } from './rag/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Pattern types for semantic drift detection
 */
export type PatternType =
  | 'error-handling'
  | 'logging'
  | 'api-patterns'
  | 'authentication'
  | 'validation'
  | 'data-access'
  | 'state-management';

/**
 * Pattern match result from RAG search
 */
export interface PatternMatch {
  filePath: string;
  snippet: string;
  score: number;
  lineNumbers: number[];
  patternType: PatternType;
}

/**
 * Semantic drift analysis for a specific pattern type
 */
export interface PatternDriftAnalysis {
  patternType: PatternType;
  baselineCount: number;
  currentCount: number;
  addedPatterns: PatternMatch[];
  removedPatterns: PatternMatch[];
  modifiedPatterns: PatternMatch[];
  similarityScore: number;
  driftPercentage: number;
  status: 'stable' | 'minor-drift' | 'significant-drift' | 'critical-drift';
  recommendations: string[];
}

/**
 * Overall semantic drift report
 */
export interface SemanticDriftReport {
  timestamp: string;
  baselineStoreName: string;
  currentStoreName: string;
  analysisPath: string;
  overallDriftScore: number;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  patternAnalysis: PatternDriftAnalysis[];
  summary: {
    totalPatternsAnalyzed: number;
    stablePatterns: number;
    driftedPatterns: number;
    criticalDrifts: number;
  };
  recommendations: string[];
  executionTimeMs: number;
}

/**
 * Input parameters for RAG-enhanced drift detection
 */
export interface RagDriftDetectionInput {
  baselineStoreName?: string;
  currentStoreName?: string;
  path: string;
  enableSemanticAnalysis: boolean;
  patterns?: PatternType[];
}

// ============================================================================
// Pattern Query Templates
// ============================================================================

/**
 * Search queries for different pattern types
 */
const PATTERN_QUERIES: Record<PatternType, string[]> = {
  'error-handling': [
    'try catch error handling exception',
    'throw new Error custom error class',
    'error boundary fallback component',
    'catch block error logging recovery',
  ],
  logging: [
    'console.log console.error console.warn',
    'logger.info logger.error logger.debug',
    'winston pino bunyan logger configuration',
    'log level debug info warn error',
  ],
  'api-patterns': [
    'fetch axios http request response',
    'REST API endpoint route handler',
    'async await promise HTTP status',
    'request validation middleware',
  ],
  authentication: [
    'auth token JWT bearer authentication',
    'login logout session user credentials',
    'OAuth2 passport middleware auth',
    'password hash bcrypt authentication',
  ],
  validation: [
    'validate schema zod yup joi',
    'input validation sanitize escape',
    'form validation error message',
    'type guard assertion runtime check',
  ],
  'data-access': [
    'database query SQL ORM prisma',
    'repository pattern data layer',
    'CRUD create read update delete',
    'transaction commit rollback connection',
  ],
  'state-management': [
    'useState useReducer state management',
    'Redux Zustand MobX store action',
    'context provider consumer state',
    'reactive state observable computed',
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate similarity score between two pattern sets
 */
function calculateSimilarityScore(
  baselinePatterns: PatternMatch[],
  currentPatterns: PatternMatch[],
): number {
  if (baselinePatterns.length === 0 && currentPatterns.length === 0) {
    return 1.0; // Both empty = identical
  }
  if (baselinePatterns.length === 0 || currentPatterns.length === 0) {
    return 0.0; // One empty = completely different
  }

  // Create sets of file paths for comparison
  const baselineFiles = new Set(baselinePatterns.map((p) => p.filePath));
  const currentFiles = new Set(currentPatterns.map((p) => p.filePath));

  // Calculate Jaccard similarity using Array.from for compatibility
  const baselineArr = Array.from(baselineFiles);
  const intersection = baselineArr.filter((f) => currentFiles.has(f));
  const unionSet = new Set([...baselineArr, ...Array.from(currentFiles)]);

  const jaccardSimilarity = intersection.length / unionSet.size;

  // Weight by average score
  const baselineAvgScore =
    baselinePatterns.reduce((sum, p) => sum + p.score, 0) / baselinePatterns.length;
  const currentAvgScore =
    currentPatterns.reduce((sum, p) => sum + p.score, 0) / currentPatterns.length;
  const scoreDifference = Math.abs(baselineAvgScore - currentAvgScore);

  // Combine metrics
  return Math.max(0, jaccardSimilarity - scoreDifference * 0.5);
}

/**
 * Determine drift status based on similarity score
 */
function getDriftStatus(
  similarityScore: number,
): 'stable' | 'minor-drift' | 'significant-drift' | 'critical-drift' {
  if (similarityScore >= 0.9) {
return 'stable';
}
  if (similarityScore >= 0.7) {
return 'minor-drift';
}
  if (similarityScore >= 0.5) {
return 'significant-drift';
}
  return 'critical-drift';
}

/**
 * Generate recommendations based on drift analysis
 */
function generatePatternRecommendations(
  patternType: PatternType,
  analysis: PatternDriftAnalysis,
): string[] {
  const recommendations: string[] = [];

  if (analysis.addedPatterns.length > 0) {
    recommendations.push(
      `Review ${analysis.addedPatterns.length} newly added ${patternType} patterns for consistency`,
    );
  }

  if (analysis.removedPatterns.length > 0) {
    recommendations.push(
      `Verify removal of ${analysis.removedPatterns.length} ${patternType} patterns was intentional`,
    );
  }

  if (analysis.status === 'critical-drift') {
    recommendations.push(
      `Critical: ${patternType} patterns have significantly diverged. Consider creating new baseline.`,
    );
  }

  // Pattern-specific recommendations
  switch (patternType) {
    case 'error-handling':
      if (analysis.currentCount < analysis.baselineCount * 0.8) {
        recommendations.push(
          'Error handling coverage has decreased. Ensure all error cases are handled.',
        );
      }
      break;
    case 'logging':
      if (analysis.driftPercentage > 20) {
        recommendations.push(
          'Logging patterns have changed significantly. Review log levels and formats.',
        );
      }
      break;
    case 'api-patterns':
      if (analysis.addedPatterns.length > 5) {
        recommendations.push(
          'Multiple new API patterns detected. Ensure consistent API design.',
        );
      }
      break;
    case 'validation':
      if (analysis.removedPatterns.length > 0) {
        recommendations.push(
          'Validation patterns removed. Verify input validation is still adequate.',
        );
      }
      break;
    default:
      break;
  }

  return recommendations;
}

/**
 * Find patterns that exist in baseline but not in current (removed patterns)
 */
function findRemovedPatterns(
  baselinePatterns: PatternMatch[],
  currentPatterns: PatternMatch[],
): PatternMatch[] {
  const currentFiles = new Set(currentPatterns.map((p) => p.filePath));
  return baselinePatterns.filter((p) => !currentFiles.has(p.filePath));
}

/**
 * Find patterns that exist in current but not in baseline (added patterns)
 */
function findAddedPatterns(
  baselinePatterns: PatternMatch[],
  currentPatterns: PatternMatch[],
): PatternMatch[] {
  const baselineFiles = new Set(baselinePatterns.map((p) => p.filePath));
  return currentPatterns.filter((p) => !baselineFiles.has(p.filePath));
}

/**
 * Find patterns that exist in both but with different content
 */
function findModifiedPatterns(
  baselinePatterns: PatternMatch[],
  currentPatterns: PatternMatch[],
): PatternMatch[] {
  const baselineMap = new Map(baselinePatterns.map((p) => [p.filePath, p]));
  const currentMap = new Map(currentPatterns.map((p) => [p.filePath, p]));

  const modified: PatternMatch[] = [];

  currentMap.forEach((currentPattern, filePath) => {
    const baselinePattern = baselineMap.get(filePath);
    if (baselinePattern) {
      // Check if the pattern has changed (by comparing score or snippet)
      const scoreDiff = Math.abs(currentPattern.score - baselinePattern.score);
      if (scoreDiff > 0.2 || currentPattern.snippet !== baselinePattern.snippet) {
        modified.push(currentPattern);
      }
    }
  });

  return modified;
}

/**
 * Convert FileSearchResult to PatternMatch
 */
function convertToPatternMatch(
  result: FileSearchResult,
  patternType: PatternType,
): PatternMatch {
  // Extract snippet from matched chunks
  const snippet = result.matchedChunks?.[0]?.content || '';
  const lineNumbers = result.matchedChunks?.map((chunk) => chunk.citation?.startLine || 0) || [];

  return {
    filePath: result.filePath,
    snippet,
    score: result.relevanceScore,
    lineNumbers,
    patternType,
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extract patterns from a RAG store for a specific pattern type
 */
async function extractPatternsFromStore(
  storeName: string | undefined,
  targetPath: string,
  patternType: PatternType,
): Promise<PatternMatch[]> {
  const patterns: PatternMatch[] = [];
  const queries = PATTERN_QUERIES[patternType];

  for (const query of queries) {
    try {
      const searchInput: RagFileSearchInput = {
        targetPath,
        query,
        maxResults: 20,
        storeName,
      };

      const searchResult = await ragFileSearchHandler(searchInput);

      if (searchResult.success && searchResult.data?.results) {
        for (const result of searchResult.data.results) {
          patterns.push(convertToPatternMatch(result, patternType));
        }
      }
    } catch {
      // Continue with next query on error
    }
  }

  // Deduplicate patterns by file path
  const uniquePatterns = new Map<string, PatternMatch>();
  for (const pattern of patterns) {
    const existing = uniquePatterns.get(pattern.filePath);
    if (!existing || pattern.score > existing.score) {
      uniquePatterns.set(pattern.filePath, pattern);
    }
  }

  return Array.from(uniquePatterns.values());
}

/**
 * Analyze drift for a specific pattern type
 */
async function analyzePatternDrift(
  baselineStoreName: string | undefined,
  currentStoreName: string | undefined,
  targetPath: string,
  patternType: PatternType,
): Promise<PatternDriftAnalysis> {
  // Extract patterns from baseline and current
  const baselinePatterns = await extractPatternsFromStore(baselineStoreName, targetPath, patternType);
  const currentPatterns = await extractPatternsFromStore(currentStoreName, targetPath, patternType);

  // Calculate metrics
  const similarityScore = calculateSimilarityScore(baselinePatterns, currentPatterns);
  const driftPercentage = (1 - similarityScore) * 100;
  const status = getDriftStatus(similarityScore);

  // Find specific changes
  const addedPatterns = findAddedPatterns(baselinePatterns, currentPatterns);
  const removedPatterns = findRemovedPatterns(baselinePatterns, currentPatterns);
  const modifiedPatterns = findModifiedPatterns(baselinePatterns, currentPatterns);

  const analysis: PatternDriftAnalysis = {
    patternType,
    baselineCount: baselinePatterns.length,
    currentCount: currentPatterns.length,
    addedPatterns,
    removedPatterns,
    modifiedPatterns,
    similarityScore,
    driftPercentage,
    status,
    recommendations: [],
  };

  // Generate recommendations
  analysis.recommendations = generatePatternRecommendations(patternType, analysis);

  return analysis;
}

/**
 * Main entry point for RAG-enhanced drift detection
 */
export async function ragEnhancedDriftDetection(
  input: RagDriftDetectionInput,
): Promise<ToolResult> {
  const startTime = Date.now();

  const {
    baselineStoreName,
    currentStoreName,
    path: targetPath,
    enableSemanticAnalysis,
    patterns = [
      'error-handling',
      'logging',
      'api-patterns',
      'validation',
    ] as PatternType[],
  } = input;

  if (!enableSemanticAnalysis) {
    return {
      success: false,
      error: 'Semantic analysis is not enabled. Set enableSemanticAnalysis to true.',
    };
  }

  try {
    // Verify stores exist or create them
    if (baselineStoreName) {
      const storeInput: RagStoreManageInput = {
        action: 'status',
        storeId: baselineStoreName,
      };
      const storeStatus = await ragStoreManageHandler(storeInput);

      if (!storeStatus.success) {
        // Create the store if it does not exist
        const createInput: RagStoreManageInput = {
          action: 'create',
          storeId: baselineStoreName,
          displayName: baselineStoreName,
          sourcePath: targetPath,
        };
        await ragStoreManageHandler(createInput);
      }
    }

    if (currentStoreName && currentStoreName !== baselineStoreName) {
      const storeInput: RagStoreManageInput = {
        action: 'status',
        storeId: currentStoreName,
      };
      const storeStatus = await ragStoreManageHandler(storeInput);

      if (!storeStatus.success) {
        // Create the store if it does not exist
        const createInput: RagStoreManageInput = {
          action: 'create',
          storeId: currentStoreName,
          displayName: currentStoreName,
          sourcePath: targetPath,
        };
        await ragStoreManageHandler(createInput);
      }
    }

    // Analyze each pattern type
    const patternAnalysis: PatternDriftAnalysis[] = [];

    for (const patternType of patterns) {
      const analysis = await analyzePatternDrift(
        baselineStoreName,
        currentStoreName,
        targetPath,
        patternType,
      );
      patternAnalysis.push(analysis);
    }

    // Calculate overall metrics
    const totalPatterns = patternAnalysis.length;
    const stablePatterns = patternAnalysis.filter((p) => p.status === 'stable').length;
    const criticalDrifts = patternAnalysis.filter((p) => p.status === 'critical-drift').length;
    const driftedPatterns = totalPatterns - stablePatterns;

    // Calculate overall drift score
    const overallDriftScore =
      patternAnalysis.reduce((sum, p) => sum + p.similarityScore, 0) / totalPatterns;

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalDrifts > 0) {
      overallStatus = 'critical';
    } else if (driftedPatterns > totalPatterns * 0.3) {
      overallStatus = 'degraded';
    }

    // Collect all recommendations
    const recommendations: string[] = [];
    for (const analysis of patternAnalysis) {
      recommendations.push(...analysis.recommendations);
    }

    // Add overall recommendations
    if (overallStatus === 'critical') {
      recommendations.unshift(
        'Critical drift detected. Immediate review recommended.',
      );
    }
    if (driftedPatterns > 0) {
      recommendations.push(
        `Consider updating baseline after reviewing ${driftedPatterns} drifted patterns.`,
      );
    }

    const executionTimeMs = Date.now() - startTime;

    // Deduplicate recommendations
    const uniqueRecommendations = Array.from(new Set(recommendations));

    const report: SemanticDriftReport = {
      timestamp: new Date().toISOString(),
      baselineStoreName: baselineStoreName || 'default',
      currentStoreName: currentStoreName || 'current',
      analysisPath: targetPath,
      overallDriftScore,
      overallStatus,
      patternAnalysis,
      summary: {
        totalPatternsAnalyzed: totalPatterns,
        stablePatterns,
        driftedPatterns,
        criticalDrifts,
      },
      recommendations: uniqueRecommendations,
      executionTimeMs,
    };

    return {
      success: true,
      message: `Semantic drift analysis completed. Status: ${overallStatus}`,
      data: report,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create baseline store with current patterns indexed
 */
export async function createRagBaseline(
  storeName: string,
  targetPath: string,
): Promise<ToolResult> {
  try {
    // Create the store
    const createInput: RagStoreManageInput = {
      action: 'create',
      storeId: storeName,
      displayName: storeName,
      sourcePath: targetPath,
    };
    const createResult = await ragStoreManageHandler(createInput);

    if (!createResult.success && !createResult.data?.message?.includes('already exists')) {
      return {
        success: false,
        error: `Failed to create baseline store: ${createResult.error || 'Unknown error'}`,
      };
    }

    // Sync to index the files
    const syncInput: RagStoreManageInput = {
      action: 'sync',
      storeId: storeName,
      sourcePath: targetPath,
    };
    const syncResult = await ragStoreManageHandler(syncInput);

    if (!syncResult.success) {
      return {
        success: false,
        error: `Failed to sync baseline: ${syncResult.error || 'Unknown error'}`,
      };
    }

    return {
      success: true,
      message: `Baseline store '${storeName}' created and indexed`,
      data: {
        storeName,
        path: targetPath,
        syncResult: syncResult.data,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  ragEnhancedDriftDetection,
  createRagBaseline,
  PATTERN_QUERIES,
};
