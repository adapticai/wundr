/**
 * RAG-Powered Error Debugging Tool
 *
 * Provides intelligent error debugging using Retrieval-Augmented Generation
 * to analyze errors, find relevant context, and suggest fixes.
 *
 * @module @wundr/mcp-server/tools/error-debugger-rag
 */

import type { RagToolResult } from './rag/types';
import { ragFileSearchHandler } from './rag/handlers';
import {
  extractIdentifiers,
  type IdentifierExtractionResult,
  type ExtractedIdentifier,
} from './error-debugger-rag/identifier-extractor';
import {
  generateFixSuggestion,
  type FixSuggestion,
  type FixSuggestionResult,
  type RagContextResult,
  type WorkingExample,
  type FixConfidence,
  type FixCategory,
} from './error-debugger-rag/fix-suggester';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported error types
 */
export type ErrorType = 'lint' | 'typecheck' | 'build';

/**
 * Debug result for a single error
 */
export interface ErrorDebugResult {
  /** Original error message */
  errorMessage: string;
  /** Error type */
  errorType: ErrorType;
  /** Extracted identifiers from the error */
  identifiers: ExtractedIdentifier[];
  /** File path if extracted */
  filePath?: string;
  /** Line number if extracted */
  lineNumber?: number;
  /** Column number if extracted */
  columnNumber?: number;
  /** Error code if extracted (e.g., TS2304) */
  errorCode?: string;
  /** RAG search results providing context */
  ragContext: RagContextResult[];
  /** Working examples found that don't have the error */
  workingExamples: WorkingExample[];
  /** Generated fix suggestions */
  suggestions: FixSuggestion[];
  /** Whether a confident fix was found */
  hasConfidentFix: boolean;
  /** Summary of the analysis */
  summary: string;
}

/**
 * Input for the error debugger
 */
export interface ErrorDebuggerRagInput {
  /** Type of errors being debugged */
  errorType: ErrorType;
  /** Array of error messages to debug */
  errorMessages: string[];
  /** Path to search for context */
  targetPath: string;
  /** Maximum suggestions per error */
  maxSuggestionsPerError?: number;
}

/**
 * Output from the error debugger
 */
export interface ErrorDebuggerRagOutput {
  /** Debug results for each error */
  results: ErrorDebugResult[];
  /** Total number of errors analyzed */
  totalErrors: number;
  /** Number of errors with confident fixes */
  errorsWithConfidentFixes: number;
  /** Overall summary */
  summary: string;
  /** Total execution time in milliseconds */
  executionTimeMs: number;
}

// ============================================================================
// Error-Type Specific Search Patterns
// ============================================================================

/**
 * Search patterns tailored to different error types
 */
const ERROR_TYPE_PATTERNS: Record<ErrorType, string[]> = {
  lint: [
    'eslint configuration rules',
    'typescript-eslint rules',
    'prettier formatting',
    'unused variable declaration',
    'import order pattern',
  ],
  typecheck: [
    'type definition interface',
    'generic type constraint',
    'type assertion',
    'type guard function',
    'type inference',
  ],
  build: [
    'webpack configuration',
    'module resolution',
    'tsconfig paths',
    'build output',
    'dependency resolution',
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate search queries based on error type and identifiers
 */
function generateSearchQueries(
  errorType: ErrorType,
  identifiers: IdentifierExtractionResult,
): string[] {
  const queries: string[] = [];

  // Add queries from identifier extraction
  queries.push(...identifiers.searchQueries);

  // Add error-type specific queries
  const typePatterns = ERROR_TYPE_PATTERNS[errorType];
  for (const pattern of typePatterns) {
    queries.push(pattern);
  }

  // Generate queries based on extracted identifiers
  for (const id of identifiers.identifiers.slice(0, 3)) {
    switch (id.type) {
      case 'type':
      case 'interface':
      case 'class':
        queries.push(`${id.value} type definition`);
        queries.push(`${id.value} interface implementation`);
        break;
      case 'function':
        queries.push(`${id.value} function implementation`);
        queries.push(`${id.value} function signature`);
        break;
      case 'module':
      case 'package':
        queries.push(`import ${id.value}`);
        queries.push(`${id.value} module export`);
        break;
      case 'property':
      case 'variable':
        queries.push(`${id.value} property usage`);
        break;
      default:
        queries.push(`${id.value} example usage`);
    }
  }

  // Deduplicate and limit
  const unique = Array.from(new Set(queries));
  return unique.slice(0, 10);
}

/**
 * Search for context using RAG
 */
async function searchForContext(
  queries: string[],
  targetPath: string,
  maxResults: number,
): Promise<RagContextResult[]> {
  const allResults: RagContextResult[] = [];

  for (const query of queries.slice(0, 5)) {
    try {
      const searchResult = await ragFileSearchHandler({
        targetPath,
        query,
        maxResults: Math.ceil(maxResults / queries.length),
        includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      if (searchResult.success && searchResult.data?.results) {
        for (const result of searchResult.data.results) {
          for (const chunk of result.matchedChunks) {
            allResults.push({
              filePath: result.filePath,
              content: chunk.content,
              score: chunk.score,
              lineNumbers: [chunk.citation.startLine, chunk.citation.endLine],
            });
          }
        }
      }
    } catch {
      // Continue with other queries on error
    }
  }

  // Sort by score and deduplicate
  const uniqueResults = deduplicateResults(allResults);
  uniqueResults.sort((a, b) => b.score - a.score);

  return uniqueResults.slice(0, maxResults);
}

/**
 * Deduplicate context results by file path
 */
function deduplicateResults(results: RagContextResult[]): RagContextResult[] {
  const seen = new Map<string, RagContextResult>();

  for (const result of results) {
    const key = `${result.filePath}:${result.lineNumbers?.join('-') || '0'}`;
    const existing = seen.get(key);

    if (!existing || result.score > existing.score) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * Search for working examples that don't have the error pattern
 */
async function findWorkingExamples(
  identifiers: IdentifierExtractionResult,
  errorType: ErrorType,
  targetPath: string,
): Promise<WorkingExample[]> {
  const examples: WorkingExample[] = [];

  // Generate queries for working examples
  const queries: string[] = [];

  for (const id of identifiers.identifiers.slice(0, 3)) {
    switch (id.type) {
      case 'type':
      case 'interface':
        queries.push(`${id.value} correctly typed`);
        break;
      case 'module':
        queries.push(`import from ${id.value} working`);
        break;
      case 'function':
        queries.push(`${id.value} function call`);
        break;
      default:
        queries.push(`${id.value} usage example`);
    }
  }

  // Search for examples
  for (const query of queries.slice(0, 3)) {
    try {
      const searchResult = await ragFileSearchHandler({
        targetPath,
        query,
        maxResults: 3,
        includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/*.test.*', '**/*.spec.*'],
      });

      if (searchResult.success && searchResult.data?.results) {
        for (const result of searchResult.data.results) {
          const chunk = result.matchedChunks[0];
          if (chunk) {
            examples.push({
              filePath: result.filePath,
              snippet: {
                code: chunk.content,
                language: getLanguageFromPath(result.filePath),
                sourcePath: result.filePath,
                lineRange: {
                  start: chunk.citation.startLine,
                  end: chunk.citation.endLine,
                },
              },
              relevanceScore: chunk.score,
              explanation: `Working example found for query: "${query}"`,
            });
          }
        }
      }
    } catch {
      // Continue on error
    }
  }

  return examples.slice(0, 5);
}

/**
 * Get language from file path
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return langMap[ext] || 'text';
}

/**
 * Debug a single error message
 */
async function debugSingleError(
  errorMessage: string,
  errorType: ErrorType,
  targetPath: string,
  maxSuggestions: number,
): Promise<ErrorDebugResult> {
  // Step 1: Extract identifiers from the error message
  const identifiers = extractIdentifiers(errorMessage);

  // Step 2: Generate search queries
  const searchQueries = generateSearchQueries(errorType, identifiers);

  // Step 3: Search for related context
  const ragContext = await searchForContext(searchQueries, targetPath, 10);

  // Step 4: Find working examples
  const workingExamples = await findWorkingExamples(identifiers, errorType, targetPath);

  // Step 5: Generate fix suggestions
  const fixResult = generateFixSuggestion(errorMessage, identifiers, ragContext);

  // Step 6: Limit suggestions
  const limitedSuggestions = fixResult.suggestions.slice(0, maxSuggestions);

  return {
    errorMessage,
    errorType,
    identifiers: identifiers.identifiers,
    filePath: identifiers.filePath,
    lineNumber: identifiers.lineNumber,
    columnNumber: identifiers.columnNumber,
    errorCode: identifiers.errorCode,
    ragContext,
    workingExamples,
    suggestions: limitedSuggestions,
    hasConfidentFix: fixResult.hasConfidentFix,
    summary: fixResult.summary,
  };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Debug errors using RAG-powered analysis
 *
 * Analyzes error messages, extracts key identifiers, searches for relevant
 * context and working examples using RAG, and generates actionable fix suggestions.
 *
 * @param input - Debug parameters including error type, messages, and target path
 * @returns Debug results with fix suggestions for each error
 *
 * @example
 * ```typescript
 * const result = await debugErrorsWithRag({
 *   errorType: 'typecheck',
 *   errorMessages: [
 *     "error TS2304: Cannot find name 'UserProfile'",
 *     "error TS2339: Property 'email' does not exist on type 'User'"
 *   ],
 *   targetPath: '/path/to/project/src',
 *   maxSuggestionsPerError: 3
 * });
 *
 * console.log(result.results[0].suggestions[0].title);
 * // => "Import or define the type 'UserProfile'"
 * ```
 */
export async function debugErrorsWithRag(
  input: ErrorDebuggerRagInput,
): Promise<RagToolResult<ErrorDebuggerRagOutput>> {
  const startTime = Date.now();

  const {
    errorType,
    errorMessages,
    targetPath,
    maxSuggestionsPerError = 3,
  } = input;

  try {
    // Validate input
    if (!errorMessages || errorMessages.length === 0) {
      return {
        success: false,
        error: 'No error messages provided',
      };
    }

    if (!targetPath) {
      return {
        success: false,
        error: 'Target path is required',
      };
    }

    // Debug each error
    const results: ErrorDebugResult[] = [];

    for (const errorMessage of errorMessages) {
      if (errorMessage.trim()) {
        const debugResult = await debugSingleError(
          errorMessage,
          errorType,
          targetPath,
          maxSuggestionsPerError,
        );
        results.push(debugResult);
      }
    }

    // Calculate summary stats
    const totalErrors = results.length;
    const errorsWithConfidentFixes = results.filter((r) => r.hasConfidentFix).length;
    const executionTimeMs = Date.now() - startTime;

    // Generate overall summary
    const summary = generateOverallSummary(results, errorsWithConfidentFixes, totalErrors);

    return {
      success: true,
      data: {
        results,
        totalErrors,
        errorsWithConfidentFixes,
        summary,
        executionTimeMs,
      },
      message: `Analyzed ${totalErrors} errors, found confident fixes for ${errorsWithConfidentFixes}`,
      metadata: {
        duration: executionTimeMs,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Generate an overall summary of the debugging results
 */
function generateOverallSummary(
  results: ErrorDebugResult[],
  confidentFixes: number,
  totalErrors: number,
): string {
  if (totalErrors === 0) {
    return 'No errors to analyze.';
  }

  const parts: string[] = [];

  parts.push(`Analyzed ${totalErrors} error(s).`);

  if (confidentFixes === totalErrors) {
    parts.push('Found high-confidence fixes for all errors.');
  } else if (confidentFixes > 0) {
    parts.push(`Found high-confidence fixes for ${confidentFixes} of ${totalErrors} errors.`);
  } else {
    parts.push('No high-confidence fixes found. Manual review recommended.');
  }

  // Identify common patterns
  const errorCodes = results
    .map((r) => r.errorCode)
    .filter((c): c is string => !!c);
  if (errorCodes.length > 0) {
    const uniqueCodes = Array.from(new Set(errorCodes));
    parts.push(`Error codes encountered: ${uniqueCodes.join(', ')}`);
  }

  // Suggest next steps
  if (confidentFixes < totalErrors) {
    parts.push('Consider reviewing the generated suggestions and working examples.');
  }

  return parts.join(' ');
}

// ============================================================================
// Re-exports
// ============================================================================

// Re-export types for convenience
export type {
  IdentifierExtractionResult,
  ExtractedIdentifier,
  FixSuggestion,
  FixSuggestionResult,
  RagContextResult,
  WorkingExample,
  FixConfidence,
  FixCategory,
};

// Re-export functions for direct use
export { extractIdentifiers } from './error-debugger-rag/identifier-extractor';
export { generateFixSuggestion } from './error-debugger-rag/fix-suggester';

export default {
  debugErrorsWithRag,
  extractIdentifiers,
  generateFixSuggestion,
};
