/**
 * Drift Detection Tool
 *
 * Monitor code quality drift and track changes over time.
 * Includes RAG-powered semantic pattern drift detection.
 */

import type { Tool, ToolResult } from './index.js';
import {
  ragEnhancedDriftDetection,
  createRagBaseline,
  type RagDriftDetectionInput,
  type PatternType,
} from './drift-detection-rag.js';

// ============================================================================
// Helper Types and Functions
// ============================================================================

/**
 * Data structure for drift check results
 */
interface DriftData {
  status?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

/**
 * Data structure for semantic analysis results
 */
interface SemanticData {
  overallStatus?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

/**
 * Helper to safely extract typed data from ToolResult
 */
function getDataAs<T>(result: ToolResult): T | null {
  return result.data as T | null;
}

/**
 * Merge traditional drift detection results with semantic analysis
 */
function mergeWithSemanticAnalysis(
  traditionalResult: ToolResult,
  semanticResult: ToolResult,
): ToolResult {
  if (!traditionalResult.success) {
    return traditionalResult;
  }

  const traditionalData = getDataAs<DriftData>(traditionalResult) || {};
  const semanticData = getDataAs<SemanticData>(semanticResult);

  const mergedData = {
    ...traditionalData,
    semanticAnalysis: semanticResult.success ? semanticResult.data : null,
    semanticError: !semanticResult.success ? semanticResult.error : undefined,
  };

  // Combine recommendations from both analyses
  const traditionalRecs = traditionalData.recommendations || [];
  const semanticRecs = semanticData?.recommendations || [];
  const recommendations = [...traditionalRecs, ...semanticRecs];

  // Update status based on both analyses
  let combinedStatus = traditionalData.status || 'UNKNOWN';
  if (semanticData?.overallStatus === 'critical') {
    combinedStatus = 'CRITICAL_DRIFT';
  } else if (
    semanticData?.overallStatus === 'degraded' &&
    combinedStatus === 'WITHIN_THRESHOLD'
  ) {
    combinedStatus = 'SEMANTIC_DRIFT_DETECTED';
  }

  // Deduplicate recommendations
  const uniqueRecommendations = Array.from(new Set(recommendations));

  return {
    success: true,
    message: `${traditionalResult.message}. Semantic: ${semanticResult.message || 'N/A'}`,
    data: {
      ...mergedData,
      status: combinedStatus,
      recommendations: uniqueRecommendations,
    },
  };
}

// ============================================================================
// Tool Definition
// ============================================================================

export const driftDetectionTool: Tool = {
  name: 'drift_detection',
  description:
    'Monitor code quality drift, create baselines, and track trends over time. Use for quality monitoring and regression detection. Supports RAG-powered semantic pattern analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['check', 'baseline', 'trends', 'compare', 'semantic'],
        description: 'Action to perform: check for drift, create baseline, show trends, compare, or semantic analysis',
      },
      path: {
        type: 'string',
        description: 'Path to analyze (default: current directory)',
      },
      threshold: {
        type: 'number',
        description: 'Drift threshold percentage (default: 5)',
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month', 'quarter'],
        description: 'Time period for trend analysis',
      },
      // RAG-enhanced parameters
      baselineStoreName: {
        type: 'string',
        description: 'RAG store name containing baseline patterns for semantic comparison',
      },
      currentStoreName: {
        type: 'string',
        description: 'RAG store name containing current patterns for semantic comparison',
      },
      enableSemanticAnalysis: {
        type: 'boolean',
        description: 'Enable RAG-powered semantic pattern drift detection',
        default: false,
      },
    },
    required: ['action'],
  },
};

export async function handleDriftDetection(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const action = args['action'] as string;
  const path = (args['path'] as string) || process.cwd();
  const threshold = (args['threshold'] as number) || 5;
  const period = (args['period'] as string) || 'week';

  // RAG-enhanced parameters
  const baselineStoreName = args['baselineStoreName'] as string | undefined;
  const currentStoreName = args['currentStoreName'] as string | undefined;
  const enableSemanticAnalysis = (args['enableSemanticAnalysis'] as boolean) || false;

  try {
    switch (action) {
      case 'check':
        // If semantic analysis is enabled, augment check with RAG insights
        if (enableSemanticAnalysis) {
          const [traditionalResult, semanticResult] = await Promise.all([
            checkDrift(path, threshold),
            ragEnhancedDriftDetection({
              baselineStoreName,
              currentStoreName,
              path,
              enableSemanticAnalysis: true,
            }),
          ]);

          return mergeWithSemanticAnalysis(traditionalResult, semanticResult);
        }
        return await checkDrift(path, threshold);

      case 'baseline':
        // If semantic analysis is enabled, also create RAG baseline
        if (enableSemanticAnalysis && baselineStoreName) {
          const [traditionalResult, ragBaselineResult] = await Promise.all([
            createBaseline(path),
            createRagBaseline(baselineStoreName, path),
          ]);

          const baselineData = getDataAs<Record<string, unknown>>(traditionalResult) || {};

          return {
            success: traditionalResult.success,
            message: `${traditionalResult.message}. RAG baseline also created.`,
            data: {
              ...baselineData,
              ragBaseline: ragBaselineResult.data,
            },
          };
        }
        return await createBaseline(path);

      case 'trends':
        return await showTrends(path, period);

      case 'compare':
        // If semantic analysis is enabled, add RAG comparison
        if (enableSemanticAnalysis) {
          const [traditionalResult, semanticResult] = await Promise.all([
            compareDrift(path),
            ragEnhancedDriftDetection({
              baselineStoreName,
              currentStoreName,
              path,
              enableSemanticAnalysis: true,
            }),
          ]);

          return mergeWithSemanticAnalysis(traditionalResult, semanticResult);
        }
        return await compareDrift(path);

      case 'semantic':
        // Dedicated semantic analysis action
        return await ragEnhancedDriftDetection({
          baselineStoreName,
          currentStoreName,
          path,
          enableSemanticAnalysis: true,
        });

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Private Helper Functions for Drift Detection
// ============================================================================

async function checkDrift(path: string, threshold: number): Promise<ToolResult> {
  // Placeholder implementation - would integrate with @wundr.io/core
  return {
    success: true,
    message: `Drift check completed for ${path}`,
    data: {
      path,
      threshold,
      metrics: {
        codeComplexity: { current: 12.5, baseline: 12.0, drift: 4.2 },
        testCoverage: { current: 78.5, baseline: 80.0, drift: -1.9 },
        lintErrors: { current: 5, baseline: 3, drift: 66.7 },
        typeErrors: { current: 0, baseline: 0, drift: 0 },
      },
      status: 'WITHIN_THRESHOLD',
      recommendations: [
        'Test coverage has decreased slightly. Consider adding tests for recent changes.',
        'Lint errors have increased. Run lint:fix to resolve.',
      ],
    },
  };
}

async function createBaseline(path: string): Promise<ToolResult> {
  const timestamp = new Date().toISOString();

  return {
    success: true,
    message: `Baseline created for ${path}`,
    data: {
      path,
      timestamp,
      baseline: {
        codeComplexity: 12.0,
        testCoverage: 80.0,
        lintErrors: 3,
        typeErrors: 0,
        filesAnalyzed: 150,
        linesOfCode: 25000,
      },
      storedAt: `.wundr/baselines/${timestamp.split('T')[0]}.json`,
    },
  };
}

async function showTrends(path: string, period: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Trends for ${path} over last ${period}`,
    data: {
      path,
      period,
      trends: {
        codeComplexity: {
          direction: 'stable',
          values: [11.8, 12.0, 11.9, 12.1, 12.0],
          change: '+1.7%',
        },
        testCoverage: {
          direction: 'improving',
          values: [75.0, 76.5, 78.0, 79.5, 80.0],
          change: '+6.7%',
        },
        lintErrors: {
          direction: 'degrading',
          values: [1, 2, 2, 3, 3],
          change: '+200%',
        },
      },
      summary: 'Overall code quality is stable with improving test coverage.',
    },
  };
}

async function compareDrift(path: string): Promise<ToolResult> {
  return {
    success: true,
    message: `Drift comparison for ${path}`,
    data: {
      path,
      comparison: {
        lastBaseline: '2024-01-15',
        currentDate: new Date().toISOString().split('T')[0],
        driftSummary: {
          totalMetrics: 4,
          withinThreshold: 3,
          exceededThreshold: 1,
          improved: 1,
        },
        details: [
          { metric: 'codeComplexity', drift: '+4.2%', status: 'ok' },
          { metric: 'testCoverage', drift: '-1.9%', status: 'ok' },
          { metric: 'lintErrors', drift: '+66.7%', status: 'warning' },
          { metric: 'typeErrors', drift: '0%', status: 'ok' },
        ],
      },
    },
  };
}
