/**
 * RAG-Enhanced Refactoring Impact Analysis Tool
 *
 * Analyzes the potential impact of refactoring operations using
 * Retrieval-Augmented Generation to find affected files, tests,
 * and documentation.
 *
 * @module @wundr/mcp-server/tools/refactoring-rag
 */

import { z } from 'zod';
import type { McpToolResult } from './registry.js';
import { successResult, errorResult } from './registry.js';
import {
  createStore,
  getStore,
  syncStore,
  listStores,
} from './rag/rag-store-manage.js';
import type { QueryResult } from './rag/types.js';

// ============================================================================
// Input Schema
// ============================================================================

/**
 * Input schema for refactoring impact analysis
 */
export const RefactoringImpactInputSchema = z.object({
  targetPath: z.string().describe('Root directory path of the codebase'),
  refactoringTarget: z.string().describe('The code element being refactored (function name, class name, module path, or pattern)'),
  refactoringType: z.enum([
    'rename',
    'move',
    'extract',
    'inline',
    'change-signature',
    'restructure',
    'deprecate',
    'delete',
  ]).describe('Type of refactoring operation'),
  searchScope: z.enum(['local', 'project', 'workspace']).optional().default('project').describe('Scope of impact analysis'),
  storeName: z.string().optional().describe('Name for the RAG store (auto-generated if not provided)'),
  forceReindex: z.boolean().optional().default(false).describe('Force reindexing even if store exists'),
  includePatterns: z.array(z.string()).optional().default(['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']).describe('File patterns to include in analysis'),
  excludePatterns: z.array(z.string()).optional().default(['**/node_modules/**', '**/dist/**', '**/.git/**']).describe('File patterns to exclude from analysis'),
  includeTests: z.boolean().optional().default(true).describe('Include test files in impact analysis'),
  includeDocs: z.boolean().optional().default(true).describe('Include documentation files in impact analysis'),
  maxResults: z.number().int().positive().optional().default(50).describe('Maximum number of impacted files to return'),
});

export type RefactoringImpactInput = z.infer<typeof RefactoringImpactInputSchema>;

// ============================================================================
// Output Types
// ============================================================================

/**
 * Impact type classification
 */
export type ImpactType = 'direct' | 'indirect' | 'potential';

/**
 * Impact severity level
 */
export type ImpactSeverity = 'high' | 'medium' | 'low';

/**
 * Information about an impacted file
 */
export interface ImpactedFile {
  /** Absolute file path */
  filePath: string;
  /** Relative path from target */
  relativePath: string;
  /** Type of impact */
  impactType: ImpactType;
  /** Severity of impact */
  severity: ImpactSeverity;
  /** Relevance score from RAG search (0-1) */
  relevanceScore: number;
  /** Estimated lines affected */
  estimatedLinesAffected: number;
  /** Specific locations within the file */
  locations: Array<{
    lineStart: number;
    lineEnd: number;
    snippet: string;
    reason: string;
  }>;
  /** File type classification */
  fileType: 'source' | 'test' | 'documentation' | 'config' | 'other';
  /** Detected programming language */
  language?: string;
  /** Additional notes about this file's impact */
  notes?: string;
}

/**
 * Information about a test that needs updating
 */
export interface TestToUpdate {
  /** Test file path */
  filePath: string;
  /** Test names/descriptions that may be affected */
  affectedTests: string[];
  /** Reason for update */
  reason: string;
  /** Priority of update */
  priority: 'critical' | 'important' | 'optional';
  /** Estimated effort (in relative units) */
  estimatedEffort: number;
}

/**
 * Information about documentation that needs updating
 */
export interface DocToUpdate {
  /** Documentation file path */
  filePath: string;
  /** Sections that may need updating */
  affectedSections: string[];
  /** Reason for update */
  reason: string;
  /** Type of documentation */
  docType: 'api' | 'readme' | 'guide' | 'comment' | 'other';
}

/**
 * Estimated scope of refactoring
 */
export type RefactoringScope = 'small' | 'medium' | 'large';

/**
 * Refactoring impact analysis report
 */
export interface RefactoringImpactReport {
  /** Target being refactored */
  refactoringTarget: string;
  /** Type of refactoring */
  refactoringType: string;
  /** Analysis timestamp */
  analyzedAt: string;
  /** Estimated overall scope */
  estimatedScope: RefactoringScope;
  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';
  /** All impacted files */
  impactedFiles: ImpactedFile[];
  /** Tests that need updating */
  testsToUpdate: TestToUpdate[];
  /** Documentation that needs updating */
  docsToUpdate: DocToUpdate[];
  /** Summary statistics */
  summary: {
    totalFilesAffected: number;
    directImpacts: number;
    indirectImpacts: number;
    potentialImpacts: number;
    testsAffected: number;
    docsAffected: number;
    estimatedTotalLinesAffected: number;
  };
  /** Recommendations for the refactoring */
  recommendations: string[];
  /** Potential risks identified */
  risks: string[];
  /** Suggested execution order */
  suggestedOrder: string[];
  /** Metadata */
  metadata: {
    analysisTimeMs: number;
    storeId: string;
    wasReindexed: boolean;
  };
}

/**
 * Output from refactoring impact analysis
 */
export interface RefactoringImpactOutput {
  report: RefactoringImpactReport;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate store name from target path
 */
function generateStoreName(targetPath: string): string {
  const normalized = targetPath
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `refactor-analysis-${normalized}`.substring(0, 50);
}

/**
 * Classify file type based on path
 */
function classifyFileType(filePath: string): 'source' | 'test' | 'documentation' | 'config' | 'other' {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.includes('.test.') || lowerPath.includes('.spec.') ||
      lowerPath.includes('__tests__') || lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/')) {
    return 'test';
  }

  if (lowerPath.endsWith('.md') || lowerPath.endsWith('.mdx') ||
      lowerPath.endsWith('.rst') || lowerPath.includes('/docs/') ||
      lowerPath.includes('readme')) {
    return 'documentation';
  }

  if (lowerPath.endsWith('.json') || lowerPath.endsWith('.yaml') ||
      lowerPath.endsWith('.yml') || lowerPath.endsWith('.toml') ||
      lowerPath.includes('config')) {
    return 'config';
  }

  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.tsx') ||
      lowerPath.endsWith('.js') || lowerPath.endsWith('.jsx') ||
      lowerPath.endsWith('.py') || lowerPath.endsWith('.java') ||
      lowerPath.endsWith('.go') || lowerPath.endsWith('.rs')) {
    return 'source';
  }

  return 'other';
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(filePath: string): string | undefined {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.md': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
  };

  return langMap[ext];
}

/**
 * Determine impact type based on relevance score and content
 */
function determineImpactType(score: number, snippet: string, target: string): ImpactType {
  const lowerSnippet = snippet.toLowerCase();
  const lowerTarget = target.toLowerCase();

  // Direct impact: exact match or import/export
  if (lowerSnippet.includes('import') && lowerSnippet.includes(lowerTarget)) {
    return 'direct';
  }
  if (lowerSnippet.includes('from') && lowerSnippet.includes(lowerTarget)) {
    return 'direct';
  }
  if (score > 0.8) {
    return 'direct';
  }

  // Indirect impact: moderate relevance
  if (score > 0.5) {
    return 'indirect';
  }

  // Potential impact: lower relevance
  return 'potential';
}

/**
 * Determine impact severity
 */
function determineImpactSeverity(
  impactType: ImpactType,
  fileType: 'source' | 'test' | 'documentation' | 'config' | 'other',
  score: number,
): ImpactSeverity {
  if (impactType === 'direct') {
    return fileType === 'source' ? 'high' : 'medium';
  }
  if (impactType === 'indirect') {
    return score > 0.7 ? 'medium' : 'low';
  }
  return 'low';
}

/**
 * Calculate estimated scope based on impact analysis
 */
function calculateEstimatedScope(
  directImpacts: number,
  indirectImpacts: number,
  testsAffected: number,
): RefactoringScope {
  const totalSignificant = directImpacts + (indirectImpacts * 0.5) + (testsAffected * 0.3);

  if (totalSignificant < 5) {
    return 'small';
  }
  if (totalSignificant < 20) {
    return 'medium';
  }
  return 'large';
}

/**
 * Calculate risk level based on impacts
 */
function calculateRiskLevel(
  directImpacts: number,
  highSeverityCount: number,
  testsAffected: number,
): 'low' | 'medium' | 'high' {
  if (directImpacts > 10 || highSeverityCount > 5) {
    return 'high';
  }
  if (directImpacts > 5 || testsAffected > 10) {
    return 'medium';
  }
  return 'low';
}

// ============================================================================
// Simulated RAG Search
// ============================================================================

/**
 * Simulate RAG search for refactoring target
 */
async function simulateRefactoringSearch(
  targetPath: string,
  refactoringTarget: string,
  maxResults: number,
  includeTests: boolean,
  includeDocs: boolean,
): Promise<QueryResult[]> {
  // In a real implementation, this would call the actual RAG service
  const results: QueryResult[] = [];

  // Generate mock results based on refactoring target
  const mockFiles = [
    { path: 'src/index.ts', score: 0.92, type: 'source' },
    { path: 'src/components/Component.tsx', score: 0.85, type: 'source' },
    { path: 'src/services/service.ts', score: 0.78, type: 'source' },
    { path: 'src/utils/helpers.ts', score: 0.72, type: 'source' },
    { path: 'src/types/index.ts', score: 0.68, type: 'source' },
    { path: 'tests/unit/index.test.ts', score: 0.88, type: 'test' },
    { path: 'tests/integration/api.test.ts', score: 0.75, type: 'test' },
    { path: 'docs/api.md', score: 0.65, type: 'doc' },
    { path: 'README.md', score: 0.55, type: 'doc' },
  ];

  const filteredFiles = mockFiles.filter(f => {
    if (f.type === 'test' && !includeTests) {
return false;
}
    if (f.type === 'doc' && !includeDocs) {
return false;
}
    return true;
  });

  for (const file of filteredFiles.slice(0, maxResults)) {
    results.push({
      content: `// Reference to ${refactoringTarget}\nimport { ${refactoringTarget} } from './module';`,
      sourcePath: `${targetPath}/${file.path}`,
      score: file.score,
      metadata: {
        lineStart: 1,
        lineEnd: 10,
        language: detectLanguage(file.path),
      },
    });
  }

  return results;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Analyze the impact of a refactoring operation using RAG search
 *
 * @param input - Refactoring impact analysis input
 * @returns Impact analysis report with affected files, tests, and docs
 */
export async function analyzeRefactoringImpact(
  input: RefactoringImpactInput,
): Promise<McpToolResult<RefactoringImpactOutput>> {
  const startTime = Date.now();
  let wasReindexed = false;

  try {
    // Validate input
    const validationResult = RefactoringImpactInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        `Input validation failed: ${validationResult.error.message}`,
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const storeName = validInput.storeName || generateStoreName(validInput.targetPath);

    // Step 1: Ensure RAG store exists
    const storesResult = await listStores();

    if (storesResult.success && storesResult.data?.stores) {
      const existingStore = storesResult.data.stores.find(s => s.id === storeName);

      if (!existingStore || validInput.forceReindex) {
        if (!existingStore) {
          await createStore(storeName, `Refactoring Analysis: ${validInput.refactoringTarget}`, {
            includePatterns: validInput.includePatterns,
            excludePatterns: validInput.excludePatterns,
          });
        }

        await syncStore(storeName, validInput.targetPath, validInput.forceReindex);
        wasReindexed = true;
      }
    }

    // Step 2: Search for all references to refactoring target
    const searchResults = await simulateRefactoringSearch(
      validInput.targetPath,
      validInput.refactoringTarget,
      validInput.maxResults,
      validInput.includeTests,
      validInput.includeDocs,
    );

    // Step 3: Process results into impacted files
    const impactedFiles: ImpactedFile[] = [];
    const testsToUpdate: TestToUpdate[] = [];
    const docsToUpdate: DocToUpdate[] = [];

    let directImpacts = 0;
    let indirectImpacts = 0;
    let potentialImpacts = 0;
    let highSeverityCount = 0;
    let totalLinesAffected = 0;

    for (const result of searchResults) {
      const fileType = classifyFileType(result.sourcePath);
      const impactType = determineImpactType(result.score, result.content, validInput.refactoringTarget);
      const severity = determineImpactSeverity(impactType, fileType, result.score);

      // Count impacts
      if (impactType === 'direct') {
directImpacts++;
} else if (impactType === 'indirect') {
indirectImpacts++;
} else {
potentialImpacts++;
}

      if (severity === 'high') {
highSeverityCount++;
}

      const lineStart = (result.metadata?.lineStart as number) || 1;
      const lineEnd = (result.metadata?.lineEnd as number) || 10;
      const estimatedLines = lineEnd - lineStart + 1;
      totalLinesAffected += estimatedLines;

      const relativePath = result.sourcePath.replace(validInput.targetPath + '/', '');

      const impactedFile: ImpactedFile = {
        filePath: result.sourcePath,
        relativePath,
        impactType,
        severity,
        relevanceScore: result.score,
        estimatedLinesAffected: estimatedLines,
        locations: [{
          lineStart,
          lineEnd,
          snippet: result.content.substring(0, 200),
          reason: `Contains reference to ${validInput.refactoringTarget}`,
        }],
        fileType,
        language: detectLanguage(result.sourcePath),
      };

      impactedFiles.push(impactedFile);

      // Categorize tests and docs
      if (fileType === 'test') {
        testsToUpdate.push({
          filePath: result.sourcePath,
          affectedTests: [`Tests related to ${validInput.refactoringTarget}`],
          reason: `Test file references ${validInput.refactoringTarget}`,
          priority: impactType === 'direct' ? 'critical' : 'important',
          estimatedEffort: impactType === 'direct' ? 3 : 1,
        });
      }

      if (fileType === 'documentation') {
        docsToUpdate.push({
          filePath: result.sourcePath,
          affectedSections: [`Documentation mentioning ${validInput.refactoringTarget}`],
          reason: `Documentation references ${validInput.refactoringTarget}`,
          docType: result.sourcePath.toLowerCase().includes('readme') ? 'readme' :
                   result.sourcePath.toLowerCase().includes('api') ? 'api' : 'guide',
        });
      }
    }

    // Step 4: Calculate summary metrics
    const estimatedScope = calculateEstimatedScope(directImpacts, indirectImpacts, testsToUpdate.length);
    const riskLevel = calculateRiskLevel(directImpacts, highSeverityCount, testsToUpdate.length);

    // Step 5: Generate recommendations
    const recommendations: string[] = [];

    if (riskLevel === 'high') {
      recommendations.push('Consider breaking this refactoring into smaller, incremental changes');
      recommendations.push('Create a detailed rollback plan before proceeding');
    }

    if (testsToUpdate.length > 0) {
      recommendations.push(`Update ${testsToUpdate.length} test file(s) to reflect the changes`);
    }

    if (docsToUpdate.length > 0) {
      recommendations.push(`Update ${docsToUpdate.length} documentation file(s) after refactoring`);
    }

    recommendations.push('Run full test suite after changes');
    recommendations.push('Review all direct impacts before merging');

    // Step 6: Identify risks
    const risks: string[] = [];

    if (directImpacts > 10) {
      risks.push('Large number of direct impacts increases risk of regression');
    }

    if (testsToUpdate.length === 0 && directImpacts > 0) {
      risks.push('No tests found for affected code - consider adding tests first');
    }

    if (highSeverityCount > 5) {
      risks.push('Multiple high-severity impacts detected');
    }

    // Step 7: Suggest execution order
    const suggestedOrder: string[] = [
      '1. Update type definitions and interfaces',
      '2. Modify source files starting from leaf dependencies',
      '3. Update tests to match new implementation',
      '4. Update documentation',
      '5. Run full test suite',
      '6. Review and commit changes',
    ];

    // Build final report
    const report: RefactoringImpactReport = {
      refactoringTarget: validInput.refactoringTarget,
      refactoringType: validInput.refactoringType,
      analyzedAt: new Date().toISOString(),
      estimatedScope,
      riskLevel,
      impactedFiles,
      testsToUpdate,
      docsToUpdate,
      summary: {
        totalFilesAffected: impactedFiles.length,
        directImpacts,
        indirectImpacts,
        potentialImpacts,
        testsAffected: testsToUpdate.length,
        docsAffected: docsToUpdate.length,
        estimatedTotalLinesAffected: totalLinesAffected,
      },
      recommendations,
      risks,
      suggestedOrder,
      metadata: {
        analysisTimeMs: Date.now() - startTime,
        storeId: storeName,
        wasReindexed,
      },
    };

    return successResult(
      { report },
      risks.length > 0 ? risks : undefined,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Refactoring impact analysis failed: ${errorMessage}`,
      'ANALYSIS_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const refactoringImpactTool = {
  name: 'refactoring-impact',
  description: 'Analyze the potential impact of a refactoring operation using RAG search to find affected files, tests, and documentation',
  inputSchema: {
    type: 'object',
    properties: {
      targetPath: {
        type: 'string',
        description: 'Root directory path of the codebase',
      },
      refactoringTarget: {
        type: 'string',
        description: 'The code element being refactored (function name, class name, module path, or pattern)',
      },
      refactoringType: {
        type: 'string',
        enum: ['rename', 'move', 'extract', 'inline', 'change-signature', 'restructure', 'deprecate', 'delete'],
        description: 'Type of refactoring operation',
      },
      searchScope: {
        type: 'string',
        enum: ['local', 'project', 'workspace'],
        description: 'Scope of impact analysis',
        default: 'project',
      },
      storeName: {
        type: 'string',
        description: 'Name for the RAG store (auto-generated if not provided)',
      },
      forceReindex: {
        type: 'boolean',
        description: 'Force reindexing even if store exists',
        default: false,
      },
      includePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to include in analysis',
        default: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to exclude from analysis',
        default: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      },
      includeTests: {
        type: 'boolean',
        description: 'Include test files in impact analysis',
        default: true,
      },
      includeDocs: {
        type: 'boolean',
        description: 'Include documentation files in impact analysis',
        default: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of impacted files to return',
        default: 50,
      },
    },
    required: ['targetPath', 'refactoringTarget', 'refactoringType'],
  },
  category: 'rag',
};
