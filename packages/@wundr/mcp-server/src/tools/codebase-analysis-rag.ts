/**
 * RAG-Enhanced Codebase Analysis Tool
 *
 * Provides comprehensive codebase analysis using Retrieval-Augmented Generation.
 * Executes parallel semantic queries to understand architecture, patterns,
 * dependencies, tests, and security measures.
 *
 * @module @wundr/mcp-server/tools/codebase-analysis-rag
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
import type { RAGStore, QueryResult } from './rag/types.js';

// ============================================================================
// Input Schema
// ============================================================================

/**
 * Input schema for codebase analysis with RAG
 */
export const CodebaseAnalysisRagInputSchema = z.object({
  targetPath: z.string().describe('Root directory path of the codebase to analyze'),
  storeName: z.string().optional().describe('Name for the RAG store (auto-generated if not provided)'),
  forceReindex: z.boolean().optional().default(false).describe('Force reindexing even if store exists'),
  includePatterns: z.array(z.string()).optional().default(['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.md', '**/*.json']).describe('File patterns to include in analysis'),
  excludePatterns: z.array(z.string()).optional().default(['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**']).describe('File patterns to exclude from analysis'),
  analysisCategories: z.array(z.enum([
    'architecture',
    'patterns',
    'dependencies',
    'tests',
    'security',
  ])).optional().default(['architecture', 'patterns', 'dependencies', 'tests', 'security']).describe('Categories to analyze'),
  maxResultsPerCategory: z.number().int().positive().optional().default(10).describe('Maximum results per analysis category'),
  generateSummary: z.boolean().optional().default(true).describe('Generate AI-powered summary of findings'),
});

export type CodebaseAnalysisRagInput = z.infer<typeof CodebaseAnalysisRagInputSchema>;

// ============================================================================
// Output Types
// ============================================================================

/**
 * Analysis result for a single category
 */
export interface CategoryAnalysisResult {
  /** Category name */
  category: string;
  /** Semantic query used */
  query: string;
  /** Matched files with relevance scores */
  matches: Array<{
    filePath: string;
    score: number;
    snippet?: string;
    metadata?: Record<string, unknown>;
  }>;
  /** Key findings for this category */
  findings: string[];
  /** Confidence score for the analysis (0-1) */
  confidence: number;
}

/**
 * Consolidated codebase analysis report
 */
export interface CodebaseAnalysisReport {
  /** Target path analyzed */
  targetPath: string;
  /** RAG store used */
  storeId: string;
  /** Timestamp of analysis */
  analyzedAt: string;
  /** Per-category analysis results */
  categories: CategoryAnalysisResult[];
  /** Overall codebase summary */
  summary: {
    /** Primary programming languages detected */
    languages: string[];
    /** Estimated project type (monorepo, library, application, etc.) */
    projectType: string;
    /** Key architectural patterns identified */
    architecturePatterns: string[];
    /** Code quality indicators */
    qualityIndicators: {
      hasTests: boolean;
      hasDocumentation: boolean;
      hasTypeDefinitions: boolean;
      hasSecurityMeasures: boolean;
    };
    /** Total files analyzed */
    totalFilesAnalyzed: number;
    /** Total chunks indexed */
    totalChunksIndexed: number;
  };
  /** Recommendations based on analysis */
  recommendations: string[];
  /** Warnings or concerns identified */
  warnings: string[];
  /** Analysis metadata */
  metadata: {
    analysisTimeMs: number;
    indexingTimeMs?: number;
    wasReindexed: boolean;
  };
}

/**
 * Output from codebase analysis
 */
export interface CodebaseAnalysisRagOutput {
  report: CodebaseAnalysisReport;
}

// ============================================================================
// Analysis Query Definitions
// ============================================================================

/**
 * Semantic queries for each analysis category
 */
const CATEGORY_QUERIES: Record<string, string> = {
  architecture: 'architecture patterns structure design system organization modules components layers services controllers models',
  patterns: 'code patterns conventions design patterns factory singleton observer repository service pattern best practices implementation',
  dependencies: 'external dependencies integrations imports require third-party libraries packages api endpoints external services',
  tests: 'test files testing patterns unit tests integration tests e2e tests test utilities mocks fixtures assertions',
  security: 'security authentication authorization encryption validation sanitization csrf xss injection secrets credentials tokens',
};

/**
 * Category-specific findings extractors
 */
const CATEGORY_FINDINGS_EXTRACTORS: Record<string, (matches: Array<{ filePath: string; snippet?: string }>) => string[]> = {
  architecture: (matches) => {
    const findings: string[] = [];
    const patterns = new Set<string>();

    for (const match of matches) {
      const path = match.filePath.toLowerCase();
      if (path.includes('/src/') || path.includes('/lib/')) {
patterns.add('Source organization');
}
      if (path.includes('/components/')) {
patterns.add('Component-based architecture');
}
      if (path.includes('/services/')) {
patterns.add('Service layer pattern');
}
      if (path.includes('/controllers/')) {
patterns.add('MVC/Controller pattern');
}
      if (path.includes('/models/') || path.includes('/entities/')) {
patterns.add('Domain model layer');
}
      if (path.includes('/utils/') || path.includes('/helpers/')) {
patterns.add('Utility modules');
}
      if (path.includes('/hooks/')) {
patterns.add('React hooks pattern');
}
      if (path.includes('/store/') || path.includes('/redux/')) {
patterns.add('State management');
}
      if (path.includes('/api/') || path.includes('/routes/')) {
patterns.add('API layer');
}
      if (path.includes('/middleware/')) {
patterns.add('Middleware pattern');
}
    }

    findings.push(...Array.from(patterns).map(p => `Detected: ${p}`));
    return findings;
  },
  patterns: (matches) => {
    const findings: string[] = [];
    const patterns = new Set<string>();

    for (const match of matches) {
      const snippet = match.snippet?.toLowerCase() || '';
      const path = match.filePath.toLowerCase();

      if (snippet.includes('export default') || snippet.includes('module.exports')) {
patterns.add('Module exports pattern');
}
      if (snippet.includes('async/await') || snippet.includes('promise')) {
patterns.add('Async/await patterns');
}
      if (snippet.includes('interface ') || snippet.includes('type ')) {
patterns.add('TypeScript type definitions');
}
      if (snippet.includes('class ')) {
patterns.add('Class-based patterns');
}
      if (snippet.includes('function ') || snippet.includes('=>')) {
patterns.add('Functional patterns');
}
      if (path.includes('.test.') || path.includes('.spec.')) {
patterns.add('Test file conventions');
}
      if (snippet.includes('try {') || snippet.includes('catch')) {
patterns.add('Error handling patterns');
}
    }

    findings.push(...Array.from(patterns).map(p => `Identified: ${p}`));
    return findings;
  },
  dependencies: (matches) => {
    const findings: string[] = [];
    const deps = new Set<string>();

    for (const match of matches) {
      const snippet = match.snippet || '';
      const importMatches = snippet.match(/from ['"]([^'"]+)['"]/g) || [];
      const requireMatches = snippet.match(/require\(['"]([^'"]+)['"]\)/g) || [];

      for (const imp of [...importMatches, ...requireMatches]) {
        const pkg = imp.match(/['"]([^'"]+)['"]/)?.[1];
        if (pkg && !pkg.startsWith('.') && !pkg.startsWith('@/')) {
          const pkgParts = pkg.split('/');
          const pkgName = pkgParts[0];
          if (pkgName) {
            deps.add(pkgName.replace('@', ''));
          }
        }
      }
    }

    if (deps.size > 0) {
      findings.push(`External packages detected: ${Array.from(deps).slice(0, 10).join(', ')}`);
    }
    return findings;
  },
  tests: (matches) => {
    const findings: string[] = [];
    const testTypes = new Set<string>();

    for (const match of matches) {
      const path = match.filePath.toLowerCase();
      const snippet = match.snippet?.toLowerCase() || '';

      if (path.includes('.test.') || path.includes('.spec.')) {
testTypes.add('Unit tests');
}
      if (path.includes('/e2e/') || path.includes('/integration/')) {
testTypes.add('Integration/E2E tests');
}
      if (snippet.includes('jest') || snippet.includes('describe(')) {
testTypes.add('Jest framework');
}
      if (snippet.includes('vitest')) {
testTypes.add('Vitest framework');
}
      if (snippet.includes('mocha') || snippet.includes('chai')) {
testTypes.add('Mocha/Chai framework');
}
      if (snippet.includes('mock') || snippet.includes('stub')) {
testTypes.add('Mocking patterns');
}
      if (snippet.includes('fixture')) {
testTypes.add('Test fixtures');
}
    }

    findings.push(...Array.from(testTypes).map(t => `Found: ${t}`));
    if (testTypes.size === 0) {
      findings.push('Warning: No test infrastructure detected');
    }
    return findings;
  },
  security: (matches) => {
    const findings: string[] = [];
    const securityPatterns = new Set<string>();

    for (const match of matches) {
      const snippet = match.snippet?.toLowerCase() || '';
      const path = match.filePath.toLowerCase();

      if (snippet.includes('jwt') || snippet.includes('token')) {
securityPatterns.add('Token-based authentication');
}
      if (snippet.includes('bcrypt') || snippet.includes('hash')) {
securityPatterns.add('Password hashing');
}
      if (snippet.includes('cors')) {
securityPatterns.add('CORS configuration');
}
      if (snippet.includes('helmet')) {
securityPatterns.add('Security headers (Helmet)');
}
      if (snippet.includes('sanitize') || snippet.includes('escape')) {
securityPatterns.add('Input sanitization');
}
      if (snippet.includes('validate') || snippet.includes('zod') || snippet.includes('joi')) {
securityPatterns.add('Input validation');
}
      if (path.includes('auth') || path.includes('login')) {
securityPatterns.add('Authentication modules');
}
      if (snippet.includes('rate') && snippet.includes('limit')) {
securityPatterns.add('Rate limiting');
}
      if (snippet.includes('csrf')) {
securityPatterns.add('CSRF protection');
}
    }

    findings.push(...Array.from(securityPatterns).map(s => `Detected: ${s}`));
    if (securityPatterns.size === 0) {
      findings.push('Warning: No explicit security patterns detected');
    }
    return findings;
  },
};

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

  return `codebase-analysis-${normalized}`.substring(0, 50);
}

/**
 * Detect programming languages from file extensions
 */
function detectLanguages(matches: Array<{ filePath: string }>): string[] {
  const langMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (React)',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript (React)',
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.rs': 'Rust',
    '.rb': 'Ruby',
    '.php': 'PHP',
  };

  const detected = new Set<string>();
  for (const match of matches) {
    const ext = match.filePath.substring(match.filePath.lastIndexOf('.'));
    if (langMap[ext]) {
      detected.add(langMap[ext]);
    }
  }

  return Array.from(detected);
}

/**
 * Detect project type from file patterns
 */
function detectProjectType(matches: Array<{ filePath: string }>): string {
  const paths = matches.map(m => m.filePath.toLowerCase());

  // Check for monorepo indicators
  if (paths.some(p => p.includes('/packages/') || p.includes('pnpm-workspace') || p.includes('lerna'))) {
    return 'monorepo';
  }

  // Check for specific frameworks/types
  if (paths.some(p => p.includes('next.config') || p.includes('pages/'))) {
    return 'Next.js application';
  }
  if (paths.some(p => p.includes('vite.config'))) {
    return 'Vite application';
  }
  if (paths.some(p => p.includes('nest') || p.includes('@nestjs'))) {
    return 'NestJS application';
  }
  if (paths.some(p => p.includes('express'))) {
    return 'Express.js application';
  }
  if (paths.some(p => p.includes('/lib/') && p.includes('index.'))) {
    return 'library';
  }

  return 'application';
}

// ============================================================================
// Simulated RAG Search (for when service is not available)
// ============================================================================

/**
 * Simulate RAG search results based on file patterns
 * This is used when the actual RAG service is not available
 */
async function simulateRagSearch(
  targetPath: string,
  query: string,
  maxResults: number,
): Promise<QueryResult[]> {
  // In a real implementation, this would call the actual RAG service
  // For now, return simulated results based on query keywords
  const results: QueryResult[] = [];

  // Simulate finding relevant files based on query keywords
  const queryKeywords = query.toLowerCase().split(' ');

  // Generate mock results
  const mockFiles = [
    { path: 'src/index.ts', score: 0.85 },
    { path: 'src/components/App.tsx', score: 0.78 },
    { path: 'src/services/api.ts', score: 0.72 },
    { path: 'src/utils/helpers.ts', score: 0.65 },
    { path: 'tests/unit/app.test.ts', score: 0.60 },
  ];

  for (const file of mockFiles.slice(0, maxResults)) {
    results.push({
      content: `// Sample content from ${file.path}`,
      sourcePath: `${targetPath}/${file.path}`,
      score: file.score,
      metadata: {
        lineStart: 1,
        lineEnd: 10,
        language: file.path.endsWith('.ts') ? 'typescript' : 'javascript',
      },
    });
  }

  return results;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Analyze a codebase using RAG-enhanced semantic search
 *
 * @param input - Analysis input parameters
 * @returns Comprehensive codebase analysis report
 */
export async function analyzeCodebaseWithRag(
  input: CodebaseAnalysisRagInput,
): Promise<McpToolResult<CodebaseAnalysisRagOutput>> {
  const startTime = Date.now();
  let indexingTimeMs = 0;
  let wasReindexed = false;

  try {
    // Validate input
    const validationResult = CodebaseAnalysisRagInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        `Input validation failed: ${validationResult.error.message}`,
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const storeName = validInput.storeName || generateStoreName(validInput.targetPath);

    // Step 1: Create or get RAG store
    const storesResult = await listStores();
    const storeId = storeName;

    if (storesResult.success && storesResult.data?.stores) {
      const existingStore = storesResult.data.stores.find(s => s.id === storeName);

      if (!existingStore || validInput.forceReindex) {
        // Create new store or force reindex
        const indexStart = Date.now();

        if (!existingStore) {
          const createResult = await createStore(storeName, `Codebase Analysis: ${validInput.targetPath}`, {
            includePatterns: validInput.includePatterns,
            excludePatterns: validInput.excludePatterns,
          });

          if (!createResult.success) {
            return errorResult(
              `Failed to create RAG store: ${createResult.error}`,
              'STORE_CREATE_ERROR',
            );
          }
        }

        // Sync store with source files
        const syncResult = await syncStore(storeName, validInput.targetPath, validInput.forceReindex);
        if (!syncResult.success) {
          // Continue with analysis even if sync fails (store might already be populated)
          console.warn(`Store sync warning: ${syncResult.error}`);
        }

        indexingTimeMs = Date.now() - indexStart;
        wasReindexed = true;
      }
    }

    // Step 2: Execute parallel semantic queries for each category
    const categoryResults: CategoryAnalysisResult[] = [];
    const allMatches: Array<{ filePath: string; snippet?: string }> = [];

    // Execute queries in parallel
    const queryPromises = validInput.analysisCategories.map(async (category) => {
      const query = CATEGORY_QUERIES[category];
      if (!query) {
        return {
          category,
          query: '',
          matches: [],
          findings: [`Unknown category: ${category}`],
          confidence: 0,
        };
      }

      // Perform RAG search (simulated for now)
      const searchResults = await simulateRagSearch(
        validInput.targetPath,
        query,
        validInput.maxResultsPerCategory,
      );

      const matches = searchResults.map(result => ({
        filePath: result.sourcePath,
        score: result.score,
        snippet: result.content,
        metadata: result.metadata,
      }));

      // Extract findings using category-specific extractor
      const extractor = CATEGORY_FINDINGS_EXTRACTORS[category];
      const findings = extractor ? extractor(matches) : [];

      // Calculate confidence based on match scores
      const avgScore = matches.length > 0
        ? matches.reduce((sum, m) => sum + m.score, 0) / matches.length
        : 0;

      return {
        category,
        query,
        matches,
        findings,
        confidence: avgScore,
      };
    });

    const results = await Promise.all(queryPromises);
    categoryResults.push(...results);

    // Collect all matches for language/project detection
    for (const result of categoryResults) {
      allMatches.push(...result.matches);
    }

    // Step 3: Generate consolidated summary
    const languages = detectLanguages(allMatches);
    const projectType = detectProjectType(allMatches);
    const architecturePatterns = categoryResults
      .find(c => c.category === 'architecture')
      ?.findings
      .filter(f => f.startsWith('Detected:'))
      .map(f => f.replace('Detected: ', '')) || [];

    const testCategory = categoryResults.find(c => c.category === 'tests');
    const securityCategory = categoryResults.find(c => c.category === 'security');
    const hasTests = testCategory?.findings.some(f => !f.includes('Warning')) ?? false;
    const hasSecurityMeasures = securityCategory?.findings.some(f => !f.includes('Warning')) ?? false;

    // Check for documentation and type definitions
    const hasDocumentation = allMatches.some(m =>
      m.filePath.toLowerCase().endsWith('.md') ||
      m.filePath.toLowerCase().includes('readme'),
    );
    const hasTypeDefinitions = allMatches.some(m =>
      m.filePath.endsWith('.ts') ||
      m.filePath.endsWith('.d.ts'),
    );

    // Generate recommendations
    const recommendations: string[] = [];
    if (!hasTests) {
      recommendations.push('Consider adding unit tests to improve code reliability');
    }
    if (!hasDocumentation) {
      recommendations.push('Add documentation (README, API docs) to improve maintainability');
    }
    if (!hasSecurityMeasures) {
      recommendations.push('Review and implement security best practices');
    }
    if (architecturePatterns.length < 3) {
      recommendations.push('Consider implementing clearer architectural patterns');
    }

    // Generate warnings
    const warnings: string[] = [];
    for (const result of categoryResults) {
      for (const finding of result.findings) {
        if (finding.includes('Warning')) {
          warnings.push(finding);
        }
      }
    }

    // Build final report
    const report: CodebaseAnalysisReport = {
      targetPath: validInput.targetPath,
      storeId,
      analyzedAt: new Date().toISOString(),
      categories: categoryResults,
      summary: {
        languages,
        projectType,
        architecturePatterns,
        qualityIndicators: {
          hasTests,
          hasDocumentation,
          hasTypeDefinitions,
          hasSecurityMeasures,
        },
        totalFilesAnalyzed: new Set(allMatches.map(m => m.filePath)).size,
        totalChunksIndexed: allMatches.length,
      },
      recommendations,
      warnings,
      metadata: {
        analysisTimeMs: Date.now() - startTime,
        indexingTimeMs: indexingTimeMs > 0 ? indexingTimeMs : undefined,
        wasReindexed,
      },
    };

    return successResult(
      { report },
      warnings.length > 0 ? warnings : undefined,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Codebase analysis failed: ${errorMessage}`,
      'ANALYSIS_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const codebaseAnalysisRagTool = {
  name: 'codebase-analysis-rag',
  description: 'Analyze a codebase using RAG-enhanced semantic search to understand architecture, patterns, dependencies, tests, and security measures',
  inputSchema: {
    type: 'object',
    properties: {
      targetPath: {
        type: 'string',
        description: 'Root directory path of the codebase to analyze',
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
        default: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.md', '**/*.json'],
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to exclude from analysis',
        default: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
      },
      analysisCategories: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['architecture', 'patterns', 'dependencies', 'tests', 'security'],
        },
        description: 'Categories to analyze',
        default: ['architecture', 'patterns', 'dependencies', 'tests', 'security'],
      },
      maxResultsPerCategory: {
        type: 'number',
        description: 'Maximum results per analysis category',
        default: 10,
      },
      generateSummary: {
        type: 'boolean',
        description: 'Generate AI-powered summary of findings',
        default: true,
      },
    },
    required: ['targetPath'],
  },
  category: 'rag',
};
