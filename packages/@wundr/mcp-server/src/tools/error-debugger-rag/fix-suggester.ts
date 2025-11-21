/**
 * Fix Suggester for Error Debugging
 *
 * Generates actionable fix suggestions by comparing error context
 * with working examples found via RAG search.
 *
 * @module @wundr/mcp-server/tools/error-debugger-rag/fix-suggester
 */

import type { ExtractedIdentifier, IdentifierExtractionResult } from './identifier-extractor';

// ============================================================================
// Types
// ============================================================================

/**
 * Confidence level for fix suggestions
 */
export type FixConfidence = 'high' | 'medium' | 'low';

/**
 * Category of fix suggestion
 */
export type FixCategory =
  | 'import'
  | 'type'
  | 'syntax'
  | 'missing-property'
  | 'missing-argument'
  | 'null-check'
  | 'declaration'
  | 'configuration'
  | 'dependency'
  | 'refactor'
  | 'lint'
  | 'other';

/**
 * A code snippet that can be used in a fix
 */
export interface CodeSnippet {
  /** The code content */
  code: string;
  /** Language of the code */
  language: string;
  /** Source file path */
  sourcePath?: string;
  /** Line numbers in source */
  lineRange?: { start: number; end: number };
  /** Description of what this snippet shows */
  description?: string;
}

/**
 * A working example found that doesn't have the error
 */
export interface WorkingExample {
  /** File path of the working example */
  filePath: string;
  /** Relevant code snippet */
  snippet: CodeSnippet;
  /** Relevance score to the error */
  relevanceScore: number;
  /** Why this example is relevant */
  explanation: string;
}

/**
 * A single fix suggestion
 */
export interface FixSuggestion {
  /** Short title for the fix */
  title: string;
  /** Detailed description of what to do */
  description: string;
  /** Category of the fix */
  category: FixCategory;
  /** Confidence level */
  confidence: FixConfidence;
  /** Priority (1 = highest) */
  priority: number;
  /** Code snippet to apply */
  codeSnippet?: CodeSnippet;
  /** Working examples that informed this suggestion */
  workingExamples: WorkingExample[];
  /** Steps to implement the fix */
  steps: string[];
  /** Additional context or notes */
  notes?: string;
}

/**
 * Result from fix suggestion generation
 */
export interface FixSuggestionResult {
  /** Error message that was analyzed */
  errorMessage: string;
  /** Generated fix suggestions */
  suggestions: FixSuggestion[];
  /** Identifiers extracted from the error */
  identifiers: ExtractedIdentifier[];
  /** Whether a fix could be confidently suggested */
  hasConfidentFix: boolean;
  /** Summary of the analysis */
  summary: string;
}

/**
 * RAG search result for context
 */
export interface RagContextResult {
  /** File path */
  filePath: string;
  /** Content snippet */
  content: string;
  /** Relevance score */
  score: number;
  /** Line numbers */
  lineNumbers?: number[];
}

// ============================================================================
// Error Pattern Matchers
// ============================================================================

/**
 * Error pattern with associated fix generator
 */
interface ErrorPattern {
  /** Pattern to match error messages */
  pattern: RegExp;
  /** Category of fix */
  category: FixCategory;
  /** Generator function for fix suggestions */
  generateFix: (
    match: RegExpMatchArray,
    errorMessage: string,
    identifiers: IdentifierExtractionResult,
    context: RagContextResult[],
  ) => Partial<FixSuggestion>;
}

/**
 * Known error patterns and their fix generators
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // Cannot find module
  {
    pattern: /Cannot find module '([^']+)'/,
    category: 'import',
    generateFix: (match, _errorMessage, _identifiers, context) => {
      const moduleName = match[1] || 'unknown';
      const isLocalModule = moduleName.startsWith('.') || moduleName.startsWith('/');
      const isTypesPackage = moduleName.startsWith('@types/');

      if (isLocalModule) {
        return {
          title: `Create or fix import path for '${moduleName}'`,
          description: `The module '${moduleName}' cannot be found. This could be a missing file or incorrect path.`,
          steps: [
            'Verify the file exists at the specified path',
            'Check for typos in the import path',
            'Ensure the file extension is correct (.ts, .tsx, .js, etc.)',
            'If the file doesn\'t exist, create it',
          ],
          confidence: 'high',
        };
      } else if (isTypesPackage) {
        return {
          title: `Install type definitions for '${moduleName}'`,
          description: 'Type definitions are missing for the module.',
          codeSnippet: {
            code: `npm install --save-dev ${moduleName}`,
            language: 'bash',
            description: 'Install the missing type definitions',
          },
          steps: [
            `Run: npm install --save-dev ${moduleName}`,
            'If types are not available, create a declaration file',
          ],
          confidence: 'high',
        };
      } else {
        return {
          title: `Install missing package '${moduleName}'`,
          description: `The package '${moduleName}' is not installed.`,
          codeSnippet: {
            code: `npm install ${moduleName}`,
            language: 'bash',
            description: 'Install the missing package',
          },
          steps: [
            `Run: npm install ${moduleName}`,
            `If it's a dev dependency, use: npm install --save-dev ${moduleName}`,
            'Verify the package name is correct',
          ],
          confidence: 'high',
        };
      }
    },
  },

  // Type is not assignable
  {
    pattern: /Type '([^']+)' is not assignable to type '([^']+)'/,
    category: 'type',
    generateFix: (match, _errorMessage, _identifiers, context) => {
      const sourceType = match[1] || 'unknown';
      const targetType = match[2] || 'unknown';

      // Check if we have working examples
      const workingExamples = findWorkingExamplesForType(targetType, context);

      return {
        title: `Fix type mismatch: '${sourceType}' to '${targetType}'`,
        description: `The value of type '${sourceType}' cannot be assigned to a variable of type '${targetType}'.`,
        steps: [
          'Check if the types should actually be compatible',
          `Consider using type assertion if you're certain: value as ${targetType}`,
          'If types are incompatible, transform the data to match the expected type',
          'Consider updating the type definition if it\'s too restrictive',
        ],
        workingExamples,
        confidence: workingExamples.length > 0 ? 'high' : 'medium',
      };
    },
  },

  // Property does not exist
  {
    pattern: /Property '([^']+)' does not exist on type '([^']+)'/,
    category: 'missing-property',
    generateFix: (match, _errorMessage, _identifiers, context) => {
      const propertyName = match[1] || 'unknown';
      const typeName = match[2] || 'unknown';

      const workingExamples = findWorkingExamplesForProperty(propertyName, context);

      return {
        title: `Add property '${propertyName}' to type '${typeName}'`,
        description: `The property '${propertyName}' doesn't exist on type '${typeName}'.`,
        steps: [
          'Check if the property name is spelled correctly',
          'If using an interface, add the property to the interface definition',
          `If the property is optional, access it with optional chaining: obj?.${propertyName}`,
          'Consider if you need to extend the type',
        ],
        workingExamples,
        confidence: workingExamples.length > 0 ? 'high' : 'medium',
      };
    },
  },

  // Cannot find name
  {
    pattern: /Cannot find name '([^']+)'/,
    category: 'declaration',
    generateFix: (match, _errorMessage, _identifiers, context) => {
      const name = match[1] || 'unknown';
      const workingExamples = findWorkingExamplesForName(name, context);

      const isPascalCase = /^[A-Z]/.test(name);
      const suggestion = isPascalCase
        ? `Import or define the type/class '${name}'`
        : `Declare or import the variable/function '${name}'`;

      return {
        title: suggestion,
        description: `The identifier '${name}' is not defined in the current scope.`,
        steps: [
          `Check if '${name}' needs to be imported from another module`,
          'If it\'s a local variable, ensure it\'s declared before use',
          'Check for typos in the name',
          isPascalCase
            ? 'If it\'s a type, add the import or define the type'
            : 'If it\'s a function, ensure it\'s imported or defined',
        ],
        workingExamples,
        confidence: workingExamples.length > 0 ? 'high' : 'medium',
      };
    },
  },

  // Missing property on object literal
  {
    pattern: /Property '([^']+)' is missing in type/,
    category: 'missing-property',
    generateFix: (match, _errorMessage, _identifiers, context) => {
      const propertyName = match[1] || 'unknown';
      const workingExamples = findWorkingExamplesForProperty(propertyName, context);

      return {
        title: `Add required property '${propertyName}'`,
        description: `The object is missing the required property '${propertyName}'.`,
        steps: [
          `Add the '${propertyName}' property to the object literal`,
          'If the property should be optional, update the type definition',
          'Check working examples for the expected value type',
        ],
        workingExamples,
        confidence: 'high',
      };
    },
  },

  // Object is possibly undefined/null
  {
    pattern: /Object is possibly '(undefined|null)'/,
    category: 'null-check',
    generateFix: () => ({
      title: 'Add null/undefined check',
      description: 'The object might be null or undefined and needs a safety check.',
      steps: [
        'Add a null check: if (obj) { ... }',
        'Use optional chaining: obj?.property',
        'Use nullish coalescing for defaults: obj ?? defaultValue',
        'If you\'re certain the value exists, use non-null assertion: obj!',
      ],
      confidence: 'high',
    }),
  },

  // Argument count mismatch
  {
    pattern: /Expected (\d+) arguments?, but got (\d+)/,
    category: 'missing-argument',
    generateFix: (match, _errorMessage, _identifiers, _context) => {
      const expected = match[1] || '?';
      const got = match[2] || '?';

      return {
        title: `Fix argument count: expected ${expected}, got ${got}`,
        description: 'The function call has the wrong number of arguments.',
        steps: [
          'Check the function signature to see required parameters',
          'Add missing arguments or remove extra ones',
          'If some arguments should be optional, update the function signature',
        ],
        confidence: 'high',
      };
    },
  },

  // ESLint: unused variable
  {
    pattern: /'([^']+)' is (?:declared|assigned a value|defined) but (?:its value is )?never (?:read|used)/,
    category: 'lint',
    generateFix: (match) => {
      const varName = match[1] || 'variable';

      return {
        title: `Remove or use unused variable '${varName}'`,
        description: `The variable '${varName}' is declared but never used.`,
        steps: [
          'If the variable is needed, use it somewhere in your code',
          'If it\'s not needed, remove the declaration',
          `If it's intentionally unused, prefix with underscore: _${varName}`,
        ],
        confidence: 'high',
      };
    },
  },

  // ESLint: prefer const
  {
    pattern: /'([^']+)' is never reassigned\. Use 'const' instead/,
    category: 'lint',
    generateFix: (match) => {
      const varName = match[1] || 'variable';

      return {
        title: `Change '${varName}' to const`,
        description: `The variable '${varName}' is never reassigned and should be declared as const.`,
        codeSnippet: {
          code: `const ${varName} = /* value */;`,
          language: 'typescript',
          description: 'Change let to const',
        },
        steps: [`Change 'let ${varName}' to 'const ${varName}'`],
        confidence: 'high',
      };
    },
  },

  // Module has no exported member
  {
    pattern: /Module '"([^"]+)"' has no exported member '([^']+)'/,
    category: 'import',
    generateFix: (match, _errorMessage, _identifiers, _context) => {
      const modulePath = match[1] || 'unknown';
      const memberName = match[2] || 'unknown';

      return {
        title: `Fix import of '${memberName}' from '${modulePath}'`,
        description: `The member '${memberName}' is not exported from the module '${modulePath}'.`,
        steps: [
          'Check if the export name is correct (case-sensitive)',
          'Verify the module exports the member (check for default vs named exports)',
          `If it's a default export, use: import ${memberName} from '${modulePath}'`,
          'If the member doesn\'t exist, it may have been removed or renamed',
        ],
        confidence: 'medium',
      };
    },
  },

  // Implicit any type
  {
    pattern: /Parameter '([^']+)' implicitly has an 'any' type/,
    category: 'type',
    generateFix: (match, _errorMessage, _identifiers, context) => {
      const paramName = match[1] || 'param';
      const workingExamples = findWorkingExamplesForParameter(paramName, context);

      return {
        title: `Add type annotation for parameter '${paramName}'`,
        description: `The parameter '${paramName}' needs an explicit type annotation.`,
        steps: [
          `Add a type annotation: ${paramName}: SomeType`,
          'Check usage of the parameter to infer the correct type',
          'Consider if the type should be generic',
        ],
        workingExamples,
        confidence: workingExamples.length > 0 ? 'high' : 'medium',
      };
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find working examples for a type from RAG context
 */
function findWorkingExamplesForType(
  typeName: string,
  context: RagContextResult[],
): WorkingExample[] {
  const examples: WorkingExample[] = [];

  for (const result of context) {
    // Look for type definitions or usages
    const typePattern = new RegExp(
      `(type|interface)\\s+${escapeRegex(typeName)}\\s*[={<]|:\\s*${escapeRegex(typeName)}[\\s;,)<>\\[]`,
      'g',
    );

    if (typePattern.test(result.content)) {
      examples.push({
        filePath: result.filePath,
        snippet: {
          code: extractRelevantCode(result.content, typeName),
          language: getLanguageFromPath(result.filePath),
          sourcePath: result.filePath,
        },
        relevanceScore: result.score,
        explanation: `Shows usage or definition of type '${typeName}'`,
      });
    }
  }

  return examples.slice(0, 3); // Limit to 3 examples
}

/**
 * Find working examples for a property from RAG context
 */
function findWorkingExamplesForProperty(
  propertyName: string,
  context: RagContextResult[],
): WorkingExample[] {
  const examples: WorkingExample[] = [];

  for (const result of context) {
    // Look for property definitions or usages
    const propertyPattern = new RegExp(
      `\\.${escapeRegex(propertyName)}[\\s;,()\\[]|${escapeRegex(propertyName)}\\s*[?:]`,
      'g',
    );

    if (propertyPattern.test(result.content)) {
      examples.push({
        filePath: result.filePath,
        snippet: {
          code: extractRelevantCode(result.content, propertyName),
          language: getLanguageFromPath(result.filePath),
          sourcePath: result.filePath,
        },
        relevanceScore: result.score,
        explanation: `Shows usage of property '${propertyName}'`,
      });
    }
  }

  return examples.slice(0, 3);
}

/**
 * Find working examples for a name from RAG context
 */
function findWorkingExamplesForName(
  name: string,
  context: RagContextResult[],
): WorkingExample[] {
  const examples: WorkingExample[] = [];

  for (const result of context) {
    // Look for imports or definitions
    const namePattern = new RegExp(
      `import\\s*\\{[^}]*${escapeRegex(name)}[^}]*\\}|import\\s+${escapeRegex(name)}|const\\s+${escapeRegex(name)}|function\\s+${escapeRegex(name)}|class\\s+${escapeRegex(name)}`,
      'g',
    );

    if (namePattern.test(result.content)) {
      examples.push({
        filePath: result.filePath,
        snippet: {
          code: extractRelevantCode(result.content, name),
          language: getLanguageFromPath(result.filePath),
          sourcePath: result.filePath,
        },
        relevanceScore: result.score,
        explanation: `Shows import or definition of '${name}'`,
      });
    }
  }

  return examples.slice(0, 3);
}

/**
 * Find working examples for a parameter from RAG context
 */
function findWorkingExamplesForParameter(
  paramName: string,
  context: RagContextResult[],
): WorkingExample[] {
  const examples: WorkingExample[] = [];

  for (const result of context) {
    // Look for typed parameters
    const paramPattern = new RegExp(
      `${escapeRegex(paramName)}\\s*:\\s*\\w+`,
      'g',
    );

    if (paramPattern.test(result.content)) {
      examples.push({
        filePath: result.filePath,
        snippet: {
          code: extractRelevantCode(result.content, paramName),
          language: getLanguageFromPath(result.filePath),
          sourcePath: result.filePath,
        },
        relevanceScore: result.score,
        explanation: `Shows typed parameter '${paramName}'`,
      });
    }
  }

  return examples.slice(0, 3);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract relevant code around a search term
 */
function extractRelevantCode(content: string, searchTerm: string): string {
  const lines = content.split('\n');
  const relevantLines: string[] = [];
  let foundIndex = -1;

  // Find the line containing the search term
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.includes(searchTerm)) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) {
    return content.slice(0, 300);
  }

  // Get context around the found line
  const start = Math.max(0, foundIndex - 2);
  const end = Math.min(lines.length, foundIndex + 3);

  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (line !== undefined) {
      relevantLines.push(line);
    }
  }

  return relevantLines.join('\n');
}

/**
 * Get programming language from file path
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
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return langMap[ext] || 'text';
}

/**
 * Calculate confidence based on context availability
 */
function calculateConfidence(
  hasWorkingExamples: boolean,
  patternConfidence: FixConfidence,
): FixConfidence {
  if (hasWorkingExamples && patternConfidence === 'high') {
    return 'high';
  }
  if (hasWorkingExamples || patternConfidence === 'high') {
    return 'medium';
  }
  return 'low';
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generate fix suggestions for an error message
 *
 * Analyzes the error message, compares with working examples from RAG context,
 * and generates actionable fix suggestions with code snippets.
 *
 * @param errorMessage - The error message to analyze
 * @param identifiers - Extracted identifiers from the error
 * @param ragContext - Working examples found via RAG search
 * @returns Fix suggestion result
 *
 * @example
 * ```typescript
 * const result = generateFixSuggestion(
 *   "Cannot find module './utils/helpers'",
 *   extractIdentifiers("Cannot find module './utils/helpers'"),
 *   ragSearchResults
 * );
 * ```
 */
export function generateFixSuggestion(
  errorMessage: string,
  identifiers: IdentifierExtractionResult,
  ragContext: RagContextResult[] = [],
): FixSuggestionResult {
  const suggestions: FixSuggestion[] = [];

  // Try to match against known error patterns
  for (const errorPattern of ERROR_PATTERNS) {
    const match = errorMessage.match(errorPattern.pattern);

    if (match) {
      const partialFix = errorPattern.generateFix(
        match,
        errorMessage,
        identifiers,
        ragContext,
      );

      const workingExamples = partialFix.workingExamples || [];
      const confidence = calculateConfidence(
        workingExamples.length > 0,
        partialFix.confidence || 'medium',
      );

      suggestions.push({
        title: partialFix.title || 'Fix error',
        description: partialFix.description || 'Review and fix the error',
        category: errorPattern.category,
        confidence,
        priority: suggestions.length + 1,
        codeSnippet: partialFix.codeSnippet,
        workingExamples,
        steps: partialFix.steps || ['Review the error and fix accordingly'],
        notes: partialFix.notes,
      });
    }
  }

  // If no patterns matched, generate a generic suggestion
  if (suggestions.length === 0) {
    suggestions.push(generateGenericSuggestion(errorMessage, identifiers, ragContext));
  }

  // Sort by priority and confidence
  suggestions.sort((a, b) => {
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) {
return confDiff;
}
    return a.priority - b.priority;
  });

  const hasConfidentFix = suggestions.some((s) => s.confidence === 'high');

  return {
    errorMessage,
    suggestions,
    identifiers: identifiers.identifiers,
    hasConfidentFix,
    summary: generateSummary(suggestions, hasConfidentFix),
  };
}

/**
 * Generate a generic suggestion when no specific pattern matches
 */
function generateGenericSuggestion(
  errorMessage: string,
  identifiers: IdentifierExtractionResult,
  ragContext: RagContextResult[],
): FixSuggestion {
  const mainIdentifier = identifiers.identifiers[0];
  const hasContext = ragContext.length > 0;

  const steps = [
    'Review the error message carefully',
    'Check the file and line number mentioned',
  ];

  if (mainIdentifier) {
    steps.push(`Look up usage of '${mainIdentifier.value}' in working code`);
  }

  steps.push(
    'Search for similar errors and their solutions',
    'Consult documentation for the relevant types/functions',
  );

  const workingExamples: WorkingExample[] = ragContext.slice(0, 2).map((ctx) => ({
    filePath: ctx.filePath,
    snippet: {
      code: ctx.content.slice(0, 300),
      language: getLanguageFromPath(ctx.filePath),
      sourcePath: ctx.filePath,
    },
    relevanceScore: ctx.score,
    explanation: 'Related code that may help understand the correct pattern',
  }));

  return {
    title: mainIdentifier
      ? `Investigate '${mainIdentifier.value}'`
      : 'Review and fix error',
    description: 'Unable to automatically determine a specific fix. Manual investigation required.',
    category: 'other',
    confidence: hasContext ? 'low' : 'low',
    priority: 10,
    workingExamples,
    steps,
    notes: identifiers.errorCode
      ? `Error code: ${identifiers.errorCode}. Search for this code for more specific solutions.`
      : undefined,
  };
}

/**
 * Generate a summary of the fix suggestions
 */
function generateSummary(suggestions: FixSuggestion[], hasConfidentFix: boolean): string {
  if (suggestions.length === 0) {
    return 'No fix suggestions could be generated for this error.';
  }

  const highConfidence = suggestions.filter((s) => s.confidence === 'high').length;
  const mediumConfidence = suggestions.filter((s) => s.confidence === 'medium').length;
  const firstSuggestion = suggestions[0];

  if (hasConfidentFix && firstSuggestion) {
    return `Found ${highConfidence} high-confidence fix suggestion(s). The most likely solution is: "${firstSuggestion.title}"`;
  }

  if (mediumConfidence > 0 && firstSuggestion) {
    return `Found ${mediumConfidence} possible fix suggestion(s). Review "${firstSuggestion.title}" as a starting point.`;
  }

  return `Generated ${suggestions.length} suggestion(s) but confidence is low. Manual investigation recommended.`;
}

/**
 * Generate fix suggestions for multiple errors
 *
 * @param errors - Array of objects with error messages and identifiers
 * @param ragContext - RAG context results
 * @returns Array of fix suggestion results
 */
export function generateFixSuggestionsForMultiple(
  errors: Array<{
    errorMessage: string;
    identifiers: IdentifierExtractionResult;
  }>,
  ragContext: RagContextResult[] = [],
): FixSuggestionResult[] {
  return errors.map(({ errorMessage, identifiers }) =>
    generateFixSuggestion(errorMessage, identifiers, ragContext),
  );
}

export default {
  generateFixSuggestion,
  generateFixSuggestionsForMultiple,
};
