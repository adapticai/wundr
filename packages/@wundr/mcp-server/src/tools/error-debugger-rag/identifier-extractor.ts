/**
 * Identifier Extractor for Error Debugging
 *
 * Parses common error message formats and extracts key identifiers
 * such as module names, function names, type names, and file paths.
 *
 * @module @wundr/mcp-server/tools/error-debugger-rag/identifier-extractor
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Types of identifiers that can be extracted from error messages
 */
export type IdentifierType =
  | 'module'
  | 'function'
  | 'type'
  | 'variable'
  | 'property'
  | 'file'
  | 'line'
  | 'column'
  | 'package'
  | 'class'
  | 'interface'
  | 'import'
  | 'export';

/**
 * A single extracted identifier with context
 */
export interface ExtractedIdentifier {
  /** The identifier value */
  value: string;
  /** Type of identifier */
  type: IdentifierType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Original context where identifier was found */
  context?: string;
  /** Start position in original message */
  position?: number;
}

/**
 * Result of identifier extraction
 */
export interface IdentifierExtractionResult {
  /** All extracted identifiers */
  identifiers: ExtractedIdentifier[];
  /** File path if found */
  filePath?: string;
  /** Line number if found */
  lineNumber?: number;
  /** Column number if found */
  columnNumber?: number;
  /** Error code if present */
  errorCode?: string;
  /** Suggested search queries based on identifiers */
  searchQueries: string[];
}

// ============================================================================
// Extraction Patterns
// ============================================================================

/**
 * Patterns for extracting identifiers from different error formats
 */
const EXTRACTION_PATTERNS = {
  // File paths with line/column numbers
  filePath: [
    // TypeScript/ESLint style: /path/to/file.ts(10,5)
    /([/\\][\w\-./\\]+\.[a-zA-Z]{2,4})\((\d+),(\d+)\)/g,
    // Standard style: /path/to/file.ts:10:5
    /([/\\][\w\-./\\]+\.[a-zA-Z]{2,4}):(\d+):(\d+)/g,
    // Just file path: /path/to/file.ts
    /(?:^|[\s'"(])([/\\][\w\-./\\]+\.[a-zA-Z]{2,4})(?:[\s'")\n]|$)/g,
    // Relative path: ./src/file.ts or ../lib/file.ts
    /(?:^|[\s'"(])(\.\.[/\\][\w\-./\\]+\.[a-zA-Z]{2,4}|\.[/\\][\w\-./\\]+\.[a-zA-Z]{2,4})(?:[\s'")\n]|$)/g,
  ],

  // TypeScript type errors
  typeNames: [
    // Type 'X' is not assignable to type 'Y'
    /Type '([^']+)' is not assignable to type '([^']+)'/g,
    // Property 'X' does not exist on type 'Y'
    /Property '([^']+)' does not exist on type '([^']+)'/g,
    // Cannot find name 'X'
    /Cannot find name '([^']+)'/g,
    // Missing properties: x, y, z
    /missing the following properties[^:]*:\s*([^)]+)/gi,
    // Type 'X' is missing
    /Type '([^']+)' is missing/g,
    // Expected X arguments, but got Y
    /Expected (\d+) arguments?, but got (\d+)/g,
  ],

  // Module/Import errors
  moduleNames: [
    // Cannot find module 'X'
    /Cannot find module '([^']+)'/g,
    // Module '"X"' has no exported member 'Y'
    /Module '"([^"]+)"' has no exported member '([^']+)'/g,
    // Could not find a declaration file for module 'X'
    /Could not find a declaration file for module '([^']+)'/g,
    // Import X from 'Y'
    /import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // require('X')
    /require\(['"]([^'"]+)['"]\)/g,
  ],

  // Function/Method errors
  functionNames: [
    // 'X' is not a function
    /'([^']+)' is not a function/g,
    // function X() {}
    /function\s+(\w+)\s*\(/g,
    // X is not defined
    /(\w+) is not defined/g,
    // X.Y is not a function
    /(\w+)\.(\w+) is not a function/g,
    // Cannot read property 'X' of undefined
    /Cannot read propert(?:y|ies) '([^']+)' of (?:undefined|null)/g,
  ],

  // Variable/Property errors
  variableNames: [
    // 'X' is declared but never used
    /'([^']+)' is declared but (?:its value is )?never (?:read|used)/g,
    // Variable 'X' is used before being assigned
    /Variable '([^']+)' is used before being assigned/g,
    // Property 'X' has no initializer
    /Property '([^']+)' has no initializer/g,
    // Object literal may only specify known properties
    /Object literal may only specify known properties[^']*'([^']+)'/g,
  ],

  // ESLint rule errors
  eslintRules: [
    // @typescript-eslint/X or eslint/X
    /@typescript-eslint\/([a-z\-]+)/g,
    /eslint\/([a-z\-]+)/g,
    // Rule ID in parentheses
    /\(([a-z\-]+\/[a-z\-]+)\)/g,
  ],

  // Error codes
  errorCodes: [
    // TS2304, TS7006, etc.
    /TS(\d+)/g,
    // error TS2304
    /error\s+TS(\d+)/g,
    // E0001, E123, etc.
    /\bE(\d+)\b/g,
  ],

  // Class/Interface names (PascalCase identifiers)
  classNames: [
    // class X
    /class\s+(\w+)/g,
    // interface X
    /interface\s+(\w+)/g,
    // type X =
    /type\s+(\w+)\s*=/g,
    // extends X
    /extends\s+(\w+)/g,
    // implements X
    /implements\s+(\w+)/g,
  ],

  // Package names
  packageNames: [
    // @scope/package-name
    /@[\w-]+\/[\w\-.]+/g,
    // Package 'X' not found
    /Package '([^']+)' not found/g,
    // in node_modules/X
    /node_modules\/(@?[\w\-./]+)/g,
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract matches from a pattern and add them to results
 */
function extractFromPattern(
  message: string,
  patterns: RegExp[],
  type: IdentifierType,
  confidence: number,
): ExtractedIdentifier[] {
  const results: ExtractedIdentifier[] = [];

  for (const pattern of patterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(message)) !== null) {
      // Get all captured groups (skip the full match)
      for (let i = 1; i < match.length; i++) {
        const captured = match[i];
        if (captured && captured.trim()) {
          const value = captured.trim();

          // Skip common false positives
          if (isCommonWord(value)) {
            continue;
          }

          results.push({
            value,
            type,
            confidence,
            context: match[0],
            position: match.index,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Check if a string is a common word that should be ignored
 */
function isCommonWord(value: string): boolean {
  const commonWords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'or',
    'and',
    'not',
    'but',
    'if',
    'then',
    'else',
    'when',
    'up',
    'out',
    'no',
    'yes',
    'true',
    'false',
    'null',
    'undefined',
    'void',
    'never',
    'any',
    'unknown',
    'object',
    'string',
    'number',
    'boolean',
    'symbol',
  ]);

  return commonWords.has(value.toLowerCase());
}

/**
 * Generate search queries from extracted identifiers
 */
function generateSearchQueries(identifiers: ExtractedIdentifier[]): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();

  // Group identifiers by type
  const byType = new Map<IdentifierType, ExtractedIdentifier[]>();
  for (const id of identifiers) {
    const list = byType.get(id.type) || [];
    list.push(id);
    byType.set(id.type, list);
  }

  // Generate queries for types
  const types = byType.get('type') || [];
  for (const t of types) {
    const query = `type ${t.value} definition usage`;
    if (!seen.has(query)) {
      queries.push(query);
      seen.add(query);
    }
  }

  // Generate queries for functions
  const functions = byType.get('function') || [];
  for (const f of functions) {
    const query = `function ${f.value} implementation`;
    if (!seen.has(query)) {
      queries.push(query);
      seen.add(query);
    }
  }

  // Generate queries for modules
  const modules = byType.get('module') || [];
  for (const m of modules) {
    const query = `import ${m.value} module`;
    if (!seen.has(query)) {
      queries.push(query);
      seen.add(query);
    }
  }

  // Generate queries for properties
  const properties = byType.get('property') || [];
  for (const p of properties) {
    const query = `property ${p.value} interface type`;
    if (!seen.has(query)) {
      queries.push(query);
      seen.add(query);
    }
  }

  // Generate queries for classes
  const classes = byType.get('class') || [];
  for (const c of classes) {
    const query = `class ${c.value} extends implements`;
    if (!seen.has(query)) {
      queries.push(query);
      seen.add(query);
    }
  }

  // Generate queries for interfaces
  const interfaces = byType.get('interface') || [];
  for (const i of interfaces) {
    const query = `interface ${i.value} properties`;
    if (!seen.has(query)) {
      queries.push(query);
      seen.add(query);
    }
  }

  // Generate queries for packages
  const packages = byType.get('package') || [];
  for (const p of packages) {
    const query = `package ${p.value} import usage`;
    if (!seen.has(query)) {
      queries.push(query);
      seen.add(query);
    }
  }

  return queries.slice(0, 10); // Limit to 10 queries
}

/**
 * Deduplicate identifiers by value and type
 */
function deduplicateIdentifiers(
  identifiers: ExtractedIdentifier[],
): ExtractedIdentifier[] {
  const seen = new Map<string, ExtractedIdentifier>();

  for (const id of identifiers) {
    const key = `${id.type}:${id.value}`;
    const existing = seen.get(key);

    // Keep the one with higher confidence
    if (!existing || id.confidence > existing.confidence) {
      seen.set(key, id);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Extract identifiers from an error message
 *
 * Parses common error message formats from TypeScript, ESLint, and build tools
 * to extract key identifiers such as module names, function names, type names,
 * and file paths.
 *
 * @param errorMessage - The error message to parse
 * @returns Extracted identifiers and metadata
 *
 * @example
 * ```typescript
 * const result = extractIdentifiers(
 *   "error TS2304: Cannot find name 'UserProfile' at src/components/User.tsx:15:10"
 * );
 * // Returns:
 * // {
 * //   identifiers: [
 * //     { value: 'UserProfile', type: 'type', confidence: 0.9 },
 * //     { value: 'src/components/User.tsx', type: 'file', confidence: 1.0 }
 * //   ],
 * //   filePath: 'src/components/User.tsx',
 * //   lineNumber: 15,
 * //   columnNumber: 10,
 * //   errorCode: 'TS2304',
 * //   searchQueries: ['type UserProfile definition usage']
 * // }
 * ```
 */
export function extractIdentifiers(
  errorMessage: string,
): IdentifierExtractionResult {
  const allIdentifiers: ExtractedIdentifier[] = [];

  // Extract file paths (highest priority)
  let filePath: string | undefined;
  let lineNumber: number | undefined;
  let columnNumber: number | undefined;

  for (const pattern of EXTRACTION_PATTERNS.filePath) {
    pattern.lastIndex = 0;
    const match = pattern.exec(errorMessage);
    if (match && match[1]) {
      filePath = match[1];
      if (match[2]) {
lineNumber = parseInt(match[2], 10);
}
      if (match[3]) {
columnNumber = parseInt(match[3], 10);
}

      allIdentifiers.push({
        value: filePath,
        type: 'file',
        confidence: 1.0,
        context: match[0],
        position: match.index,
      });
      break;
    }
  }

  // Extract error codes
  let errorCode: string | undefined;
  for (const pattern of EXTRACTION_PATTERNS.errorCodes) {
    pattern.lastIndex = 0;
    const match = pattern.exec(errorMessage);
    if (match) {
      errorCode = `TS${match[1]}`;
      break;
    }
  }

  // Extract type names (high confidence)
  allIdentifiers.push(
    ...extractFromPattern(errorMessage, EXTRACTION_PATTERNS.typeNames, 'type', 0.9),
  );

  // Extract module names
  allIdentifiers.push(
    ...extractFromPattern(errorMessage, EXTRACTION_PATTERNS.moduleNames, 'module', 0.85),
  );

  // Extract function names
  allIdentifiers.push(
    ...extractFromPattern(errorMessage, EXTRACTION_PATTERNS.functionNames, 'function', 0.8),
  );

  // Extract variable/property names
  allIdentifiers.push(
    ...extractFromPattern(errorMessage, EXTRACTION_PATTERNS.variableNames, 'variable', 0.75),
  );

  // Extract class/interface names
  allIdentifiers.push(
    ...extractFromPattern(errorMessage, EXTRACTION_PATTERNS.classNames, 'class', 0.85),
  );

  // Extract package names
  allIdentifiers.push(
    ...extractFromPattern(errorMessage, EXTRACTION_PATTERNS.packageNames, 'package', 0.8),
  );

  // Deduplicate and sort by confidence
  const uniqueIdentifiers = deduplicateIdentifiers(allIdentifiers);
  uniqueIdentifiers.sort((a, b) => b.confidence - a.confidence);

  // Generate search queries
  const searchQueries = generateSearchQueries(uniqueIdentifiers);

  return {
    identifiers: uniqueIdentifiers,
    filePath,
    lineNumber,
    columnNumber,
    errorCode,
    searchQueries,
  };
}

/**
 * Extract identifiers from multiple error messages
 *
 * @param errorMessages - Array of error messages to parse
 * @returns Array of extraction results
 */
export function extractIdentifiersFromMultiple(
  errorMessages: string[],
): IdentifierExtractionResult[] {
  return errorMessages.map(extractIdentifiers);
}

/**
 * Get the most important identifiers from an extraction result
 *
 * @param result - Extraction result
 * @param limit - Maximum number of identifiers to return
 * @returns Top identifiers sorted by confidence
 */
export function getTopIdentifiers(
  result: IdentifierExtractionResult,
  limit = 5,
): ExtractedIdentifier[] {
  return result.identifiers.slice(0, limit);
}

export default {
  extractIdentifiers,
  extractIdentifiersFromMultiple,
  getTopIdentifiers,
};
