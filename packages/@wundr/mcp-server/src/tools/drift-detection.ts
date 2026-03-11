/**
 * Drift Detection Tool
 *
 * Monitor code quality drift and track changes over time.
 * Includes RAG-powered semantic pattern drift detection.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as nodePath from 'path';

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
  semanticResult: ToolResult
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
        description:
          'Action to perform: check for drift, create baseline, show trends, compare, or semantic analysis',
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
        description:
          'RAG store name containing baseline patterns for semantic comparison',
      },
      currentStoreName: {
        type: 'string',
        description:
          'RAG store name containing current patterns for semantic comparison',
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
  args: Record<string, unknown>
): Promise<ToolResult> {
  const action = args['action'] as string;
  const path = (args['path'] as string) || process.cwd();
  const threshold = (args['threshold'] as number) || 5;
  const period = (args['period'] as string) || 'week';

  // RAG-enhanced parameters
  const baselineStoreName = args['baselineStoreName'] as string | undefined;
  const currentStoreName = args['currentStoreName'] as string | undefined;
  const enableSemanticAnalysis =
    (args['enableSemanticAnalysis'] as boolean) || false;

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

          const baselineData =
            getDataAs<Record<string, unknown>>(traditionalResult) || {};

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

/**
 * Stored baseline file format
 */
interface BaselineFile {
  createdAt: string;
  path: string;
  filesAnalyzed: number;
  files: Record<string, string>; // relative path -> SHA-256 checksum
}

/**
 * Patterns of paths to skip when walking the directory tree.
 * Keeps the baseline focused on source files rather than generated or dependency content.
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.wundr',
]);

/**
 * Compute a SHA-256 checksum for the contents of a single file.
 */
function checksumFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Recursively collect all file paths under a directory, skipping ignored directories.
 * Returns paths relative to `rootDir`.
 */
function collectFiles(rootDir: string, currentDir: string = rootDir): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        const subDir = nodePath.join(currentDir, entry.name);
        results.push(...collectFiles(rootDir, subDir));
      }
    } else if (entry.isFile()) {
      const abs = nodePath.join(currentDir, entry.name);
      results.push(nodePath.relative(rootDir, abs));
    }
  }

  return results;
}

/**
 * Build a checksum map for all tracked files under `targetPath`.
 */
function buildChecksumMap(targetPath: string): Record<string, string> {
  const checksums: Record<string, string> = {};
  const files = collectFiles(targetPath);

  for (const relFile of files) {
    try {
      checksums[relFile] = checksumFile(nodePath.join(targetPath, relFile));
    } catch {
      // Skip files that cannot be read (e.g. permission errors)
    }
  }

  return checksums;
}

/**
 * Resolve the `.wundr/baselines` directory for a given target path and ensure it exists.
 */
function baselineDir(targetPath: string): string {
  const dir = nodePath.join(targetPath, '.wundr', 'baselines');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Return the path to the latest baseline JSON file, or null when none exists.
 */
function latestBaselinePath(targetPath: string): string | null {
  const latestPath = nodePath.join(
    targetPath,
    '.wundr',
    'baselines',
    'latest.json'
  );
  return fs.existsSync(latestPath) ? latestPath : null;
}

/**
 * Load and parse the latest baseline for `targetPath`.
 * Returns null when no baseline file is found.
 */
function loadLatestBaseline(targetPath: string): BaselineFile | null {
  const p = latestBaselinePath(targetPath);
  if (!p) return null;

  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw) as BaselineFile;
  } catch {
    return null;
  }
}

/**
 * Diff two checksum maps and return categorised changes.
 */
function diffChecksums(
  baseline: Record<string, string>,
  current: Record<string, string>
): {
  changed: string[];
  added: string[];
  removed: string[];
  unchanged: number;
} {
  const baselineKeys = new Set(Object.keys(baseline));
  const currentKeys = new Set(Object.keys(current));

  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  let unchanged = 0;

  for (const file of currentKeys) {
    if (!baselineKeys.has(file)) {
      added.push(file);
    } else if (current[file] !== baseline[file]) {
      changed.push(file);
    } else {
      unchanged++;
    }
  }

  for (const file of baselineKeys) {
    if (!currentKeys.has(file)) {
      removed.push(file);
    }
  }

  return { changed, added, removed, unchanged };
}

/**
 * Calculate a drift percentage relative to the size of the baseline.
 * The percentage represents the fraction of baseline files that have been
 * modified or removed, plus any newly added files, expressed as a proportion
 * of the total unique file set.
 */
function calculateDriftPercentage(
  baseline: Record<string, string>,
  diff: { changed: string[]; added: string[]; removed: string[] }
): number {
  const totalFiles = Object.keys(baseline).length;
  if (totalFiles === 0) return 0;

  const affectedFiles =
    diff.changed.length + diff.added.length + diff.removed.length;
  const denominator = Math.max(totalFiles, affectedFiles);
  return parseFloat(((affectedFiles / denominator) * 100).toFixed(2));
}

async function checkDrift(
  targetPath: string,
  threshold: number
): Promise<ToolResult> {
  const baseline = loadLatestBaseline(targetPath);

  if (!baseline) {
    return {
      success: false,
      error: `No baseline found for ${targetPath}. Run the 'baseline' action first to create one.`,
    };
  }

  const currentChecksums = buildChecksumMap(targetPath);
  const diff = diffChecksums(baseline.files, currentChecksums);
  const driftPercentage = calculateDriftPercentage(baseline.files, diff);
  const status =
    driftPercentage <= threshold ? 'WITHIN_THRESHOLD' : 'DRIFT_EXCEEDED';

  const recommendations: string[] = [];
  if (diff.changed.length > 0) {
    recommendations.push(
      `${diff.changed.length} file(s) have been modified since the baseline was created.`
    );
  }
  if (diff.added.length > 0) {
    recommendations.push(
      `${diff.added.length} new file(s) detected that were not present in the baseline.`
    );
  }
  if (diff.removed.length > 0) {
    recommendations.push(
      `${diff.removed.length} file(s) have been removed since the baseline was created.`
    );
  }
  if (status === 'DRIFT_EXCEEDED') {
    recommendations.push(
      `Drift of ${driftPercentage}% exceeds the configured threshold of ${threshold}%. Consider reviewing changes or updating the baseline.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      'No drift detected. Codebase matches the baseline exactly.'
    );
  }

  return {
    success: true,
    message: `Drift check completed for ${targetPath}`,
    data: {
      path: targetPath,
      threshold,
      baselineCreatedAt: baseline.createdAt,
      currentDate: new Date().toISOString(),
      filesAnalyzed: Object.keys(currentChecksums).length,
      driftPercentage,
      status,
      changes: {
        changed: diff.changed,
        added: diff.added,
        removed: diff.removed,
        unchangedCount: diff.unchanged,
      },
      recommendations,
    },
  };
}

async function createBaseline(targetPath: string): Promise<ToolResult> {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0];

  const checksums = buildChecksumMap(targetPath);
  const filesAnalyzed = Object.keys(checksums).length;

  const baseline: BaselineFile = {
    createdAt: timestamp,
    path: targetPath,
    filesAnalyzed,
    files: checksums,
  };

  const dir = baselineDir(targetPath);
  const datedFile = nodePath.join(dir, `${dateStr}.json`);
  const latestFile = nodePath.join(dir, 'latest.json');

  fs.writeFileSync(datedFile, JSON.stringify(baseline, null, 2), 'utf-8');
  fs.writeFileSync(latestFile, JSON.stringify(baseline, null, 2), 'utf-8');

  return {
    success: true,
    message: `Baseline created for ${targetPath}`,
    data: {
      path: targetPath,
      timestamp,
      filesAnalyzed,
      storedAt: nodePath.relative(process.cwd(), latestFile),
      datedSnapshotAt: nodePath.relative(process.cwd(), datedFile),
    },
  };
}

async function showTrends(
  targetPath: string,
  period: string
): Promise<ToolResult> {
  const dir = nodePath.join(targetPath, '.wundr', 'baselines');

  if (!fs.existsSync(dir)) {
    return {
      success: false,
      error: `No baselines directory found for ${targetPath}. Run the 'baseline' action first.`,
    };
  }

  // Collect all dated snapshots (named YYYY-MM-DD.json), sorted oldest-first
  const periodDays: Record<string, number> = {
    day: 1,
    week: 7,
    month: 30,
    quarter: 90,
  };
  const days = periodDays[period] ?? 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let snapshotFiles: string[];
  try {
    snapshotFiles = fs
      .readdirSync(dir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .filter(f => new Date(f.replace('.json', '')) >= cutoff)
      .sort();
  } catch {
    snapshotFiles = [];
  }

  if (snapshotFiles.length === 0) {
    return {
      success: true,
      message: `No baseline snapshots found within the last ${period} for ${targetPath}`,
      data: {
        path: targetPath,
        period,
        snapshots: [],
        summary: `No snapshots available for the selected period (${period}). Create baselines regularly to enable trend analysis.`,
      },
    };
  }

  // Parse each snapshot and record file counts
  const snapshots = snapshotFiles.map(filename => {
    const filePath = nodePath.join(dir, filename);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as BaselineFile;
      return {
        date: filename.replace('.json', ''),
        filesTracked: Object.keys(data.files).length,
        createdAt: data.createdAt,
      };
    } catch {
      return {
        date: filename.replace('.json', ''),
        filesTracked: 0,
        createdAt: '',
      };
    }
  });

  // Compute change between consecutive snapshots when we have more than one
  const fileCounts = snapshots.map(s => s.filesTracked);
  const first = fileCounts[0] ?? 0;
  const last = fileCounts[fileCounts.length - 1] ?? 0;
  const absoluteChange = last - first;
  const changeSign = absoluteChange >= 0 ? '+' : '';
  const changePct =
    first === 0
      ? 'N/A'
      : `${changeSign}${(((last - first) / first) * 100).toFixed(1)}%`;

  const direction =
    absoluteChange > 0
      ? 'growing'
      : absoluteChange < 0
        ? 'shrinking'
        : 'stable';

  return {
    success: true,
    message: `Trends for ${targetPath} over last ${period}`,
    data: {
      path: targetPath,
      period,
      snapshots,
      trends: {
        filesTracked: {
          direction,
          values: fileCounts,
          change: changePct,
        },
      },
      summary: `${snapshots.length} snapshot(s) analysed over the last ${period}. File count is ${direction} (${changeSign}${absoluteChange} files).`,
    },
  };
}

async function compareDrift(targetPath: string): Promise<ToolResult> {
  const baseline = loadLatestBaseline(targetPath);

  if (!baseline) {
    return {
      success: false,
      error: `No baseline found for ${targetPath}. Run the 'baseline' action first to create one.`,
    };
  }

  const currentChecksums = buildChecksumMap(targetPath);
  const diff = diffChecksums(baseline.files, currentChecksums);
  const driftPercentage = calculateDriftPercentage(baseline.files, diff);

  return {
    success: true,
    message: `Drift comparison for ${targetPath}`,
    data: {
      path: targetPath,
      comparison: {
        baselineCreatedAt: baseline.createdAt,
        currentDate: new Date().toISOString(),
        baselineFilesCount: Object.keys(baseline.files).length,
        currentFilesCount: Object.keys(currentChecksums).length,
        driftPercentage,
        changes: {
          changed: diff.changed,
          added: diff.added,
          removed: diff.removed,
          unchangedCount: diff.unchanged,
        },
      },
    },
  };
}
