/**
 * Integration tests for RAG Error Debugger
 *
 * Tests error debugging workflow including identifier extraction,
 * fix suggestion generation, and sample error message handling.
 *
 * @module tests/integration/rag/rag-error-debugger
 */

import * as fs from 'fs';

import {
  SAMPLE_TYPE_ERROR,
  SAMPLE_RUNTIME_ERROR,
  SAMPLE_VALIDATION_ERROR,
  EXPECTED_ERROR_IDENTIFIERS,
  MOCK_AUTH_SEARCH_RESULT,
  createMockRAGService,
  createMockFileSystem,
  SAMPLE_TS_FILE,
} from '../../fixtures/rag';

// Mock fs module
jest.mock('fs');
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

// ============================================================================
// Types
// ============================================================================

interface ErrorIdentifiers {
  functions: string[];
  files: string[];
  properties: string[];
  lineNumbers: number[];
  errorType: string;
  errorMessage: string;
}

interface DebugContext {
  error: ErrorIdentifiers;
  relevantCode: RelevantCodeSnippet[];
  suggestions: FixSuggestion[];
  analysis: ErrorAnalysis;
}

interface RelevantCodeSnippet {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  relevanceScore: number;
  isErrorLocation: boolean;
}

interface FixSuggestion {
  description: string;
  code: string;
  filePath: string;
  lineNumber: number;
  confidence: number;
  type: 'fix' | 'workaround' | 'investigation';
}

interface ErrorAnalysis {
  rootCause: string;
  affectedComponents: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

// ============================================================================
// Tests
// ============================================================================

describe('RAG Error Debugger Integration Tests', () => {
  let mockFileSystem: ReturnType<typeof createMockFileSystem>;
  let mockRAGService: ReturnType<typeof createMockRAGService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSystem = createMockFileSystem();
    mockRAGService = createMockRAGService();

    // Setup fs mocks
    mockFs.existsSync.mockImplementation(mockFileSystem.existsSync);
    mockFs.readFileSync.mockImplementation(mockFileSystem.readFileSync as typeof mockFs.readFileSync);
    mockFs.writeFileSync.mockImplementation(mockFileSystem.writeFileSync);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Debugging Workflow', () => {
    it('should complete full debugging workflow for TypeError', async () => {
      // Step 1: Parse error
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

      expect(identifiers.errorType).toBe('TypeError');
      expect(identifiers.functions.length).toBeGreaterThan(0);
      expect(identifiers.files.length).toBeGreaterThan(0);

      // Step 2: Search for relevant code
      const searchQueries = generateSearchQueries(identifiers);
      expect(searchQueries.length).toBeGreaterThan(0);

      // Step 3: Get context from RAG
      const searchResults = await mockRAGService.searchMultiple(
        searchQueries,
        '/app'
      );
      expect(searchResults.length).toBeGreaterThan(0);

      // Step 4: Generate suggestions
      const suggestions = generateFixSuggestions(identifiers, searchResults);
      expect(suggestions.length).toBeGreaterThan(0);

      // Step 5: Analyze error
      const analysis = analyzeError(identifiers);
      expect(analysis.rootCause).toBeDefined();
      expect(analysis.severity).toBeDefined();
    });

    it('should complete full debugging workflow for RuntimeError', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_RUNTIME_ERROR);

      expect(identifiers.errorType).toBe('Error');
      expect(identifiers.errorMessage).toContain('Connection refused');
      expect(identifiers.functions.length).toBeGreaterThan(0);

      const analysis = analyzeError(identifiers);
      expect(analysis.category).toBe('network');
    });

    it('should complete full debugging workflow for ValidationError', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_VALIDATION_ERROR);

      expect(identifiers.errorType).toBe('ValidationError');
      expect(identifiers.errorMessage).toContain('Invalid email');

      const analysis = analyzeError(identifiers);
      expect(analysis.category).toBe('validation');
    });
  });

  describe('Identifier Extraction', () => {
    describe('TypeError extraction', () => {
      it('should extract error type correctly', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

        expect(identifiers.errorType).toBe('TypeError');
      });

      it('should extract error message', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

        expect(identifiers.errorMessage).toContain("Cannot read properties of undefined");
        expect(identifiers.errorMessage).toContain('userId');
      });

      it('should extract function names from stack trace', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

        expect(identifiers.functions).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.typeError.functions
        );
      });

      it('should extract file paths from stack trace', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

        expect(identifiers.files).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.typeError.files
        );
      });

      it('should extract property names', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

        expect(identifiers.properties).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.typeError.properties
        );
      });

      it('should extract line numbers', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

        expect(identifiers.lineNumbers).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.typeError.lineNumbers
        );
      });
    });

    describe('RuntimeError extraction', () => {
      it('should extract function names from runtime error', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_RUNTIME_ERROR);

        expect(identifiers.functions).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.runtimeError.functions
        );
      });

      it('should extract file paths from runtime error', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_RUNTIME_ERROR);

        expect(identifiers.files).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.runtimeError.files
        );
      });

      it('should extract line numbers from runtime error', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_RUNTIME_ERROR);

        expect(identifiers.lineNumbers).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.runtimeError.lineNumbers
        );
      });
    });

    describe('ValidationError extraction', () => {
      it('should extract function names from validation error', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_VALIDATION_ERROR);

        expect(identifiers.functions).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.validationError.functions
        );
      });

      it('should extract file paths from validation error', () => {
        const identifiers = extractErrorIdentifiers(SAMPLE_VALIDATION_ERROR);

        expect(identifiers.files).toEqual(
          EXPECTED_ERROR_IDENTIFIERS.validationError.files
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle empty error message', () => {
        const identifiers = extractErrorIdentifiers('');

        expect(identifiers.errorType).toBe('Unknown');
        expect(identifiers.functions).toHaveLength(0);
        expect(identifiers.files).toHaveLength(0);
      });

      it('should handle error without stack trace', () => {
        const errorWithoutStack = 'Error: Something went wrong';
        const identifiers = extractErrorIdentifiers(errorWithoutStack);

        expect(identifiers.errorType).toBe('Error');
        expect(identifiers.errorMessage).toBe('Something went wrong');
        expect(identifiers.functions).toHaveLength(0);
      });

      it('should handle malformed stack trace', () => {
        const malformedError = `Error: Test
    at malformed line without proper format
    another bad line
    at ValidFunction (valid/path.ts:10:5)`;

        const identifiers = extractErrorIdentifiers(malformedError);

        expect(identifiers.functions.length).toBeGreaterThanOrEqual(1);
        expect(identifiers.functions).toContain('ValidFunction');
      });

      it('should handle async stack traces', () => {
        const asyncError = `Error: Async error
    at async AuthService.authenticate (/app/src/services/auth.ts:25:42)
    at async UserController.login (/app/src/controllers/user.ts:15:35)`;

        const identifiers = extractErrorIdentifiers(asyncError);

        expect(identifiers.functions).toContain('AuthService.authenticate');
        expect(identifiers.functions).toContain('UserController.login');
      });
    });
  });

  describe('Fix Suggestion Generation', () => {
    it('should generate suggestions for TypeError', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const searchResults = await mockRAGService.searchMultiple(
        generateSearchQueries(identifiers),
        '/app'
      );

      const suggestions = generateFixSuggestions(identifiers, searchResults);

      expect(suggestions.length).toBeGreaterThan(0);

      // Should suggest null check
      const nullCheckSuggestion = suggestions.find(s =>
        s.description.toLowerCase().includes('null') ||
        s.description.toLowerCase().includes('undefined')
      );
      expect(nullCheckSuggestion).toBeDefined();
    });

    it('should generate suggestions for RuntimeError', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_RUNTIME_ERROR);
      const searchResults = await mockRAGService.searchMultiple(
        generateSearchQueries(identifiers),
        '/app'
      );

      const suggestions = generateFixSuggestions(identifiers, searchResults);

      expect(suggestions.length).toBeGreaterThan(0);

      // Should suggest connection handling
      const connectionSuggestion = suggestions.find(s =>
        s.description.toLowerCase().includes('connection') ||
        s.description.toLowerCase().includes('retry')
      );
      expect(connectionSuggestion).toBeDefined();
    });

    it('should generate suggestions for ValidationError', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_VALIDATION_ERROR);
      const searchResults = await mockRAGService.searchMultiple(
        generateSearchQueries(identifiers),
        '/app'
      );

      const suggestions = generateFixSuggestions(identifiers, searchResults);

      expect(suggestions.length).toBeGreaterThan(0);

      // Should suggest validation fix
      const validationSuggestion = suggestions.find(s =>
        s.description.toLowerCase().includes('validation') ||
        s.description.toLowerCase().includes('email')
      );
      expect(validationSuggestion).toBeDefined();
    });

    it('should include confidence scores in suggestions', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const searchResults = await mockRAGService.searchMultiple(
        generateSearchQueries(identifiers),
        '/app'
      );

      const suggestions = generateFixSuggestions(identifiers, searchResults);

      for (const suggestion of suggestions) {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should categorize suggestions by type', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const searchResults = await mockRAGService.searchMultiple(
        generateSearchQueries(identifiers),
        '/app'
      );

      const suggestions = generateFixSuggestions(identifiers, searchResults);

      const types = suggestions.map(s => s.type);
      expect(types).toContain('fix');
    });

    it('should include file path and line number in suggestions', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const searchResults = await mockRAGService.searchMultiple(
        generateSearchQueries(identifiers),
        '/app'
      );

      const suggestions = generateFixSuggestions(identifiers, searchResults);

      const fixSuggestions = suggestions.filter(s => s.type === 'fix');
      for (const suggestion of fixSuggestions) {
        expect(suggestion.filePath).toBeDefined();
        expect(typeof suggestion.lineNumber).toBe('number');
      }
    });
  });

  describe('Sample Error Messages', () => {
    it('should handle real-world TypeError examples', () => {
      const realWorldError = `TypeError: Cannot read properties of undefined (reading 'map')
    at ProductList.render (/app/src/components/ProductList.tsx:45:18)
    at renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:14985:18)
    at Array.map (<anonymous>)`;

      const identifiers = extractErrorIdentifiers(realWorldError);

      expect(identifiers.errorType).toBe('TypeError');
      expect(identifiers.properties).toContain('map');
      expect(identifiers.functions).toContain('ProductList.render');
    });

    it('should handle real-world Promise rejection', () => {
      const promiseError = `UnhandledPromiseRejectionWarning: Error: Request failed with status code 401
    at createError (/app/node_modules/axios/lib/core/createError.js:16:15)
    at settle (/app/node_modules/axios/lib/core/settle.js:17:12)
    at IncomingMessage.handleStreamEnd (/app/node_modules/axios/lib/adapters/http.js:293:11)`;

      const identifiers = extractErrorIdentifiers(promiseError);

      expect(identifiers.errorMessage).toContain('401');
    });

    it('should handle database errors', () => {
      const dbError = `QueryFailedError: duplicate key value violates unique constraint "users_email_key"
    at PostgresQueryRunner.query (/app/node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:144:19)
    at UserRepository.save (/app/src/repositories/user.ts:28:22)`;

      const identifiers = extractErrorIdentifiers(dbError);

      expect(identifiers.errorType).toBe('QueryFailedError');
      expect(identifiers.errorMessage).toContain('duplicate key');
    });

    it('should handle syntax errors', () => {
      const syntaxError = `SyntaxError: Unexpected token '<'
    at Parser.parseModule (internal/modules/esm/parse.js:25:15)
    at async ESMLoader.load (internal/modules/esm/loader.js:128:22)`;

      const identifiers = extractErrorIdentifiers(syntaxError);

      expect(identifiers.errorType).toBe('SyntaxError');
    });

    it('should handle module not found errors', () => {
      const moduleError = `Error: Cannot find module '@/services/auth'
Require stack:
- /app/src/controllers/user.ts
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:933:15)`;

      const identifiers = extractErrorIdentifiers(moduleError);

      expect(identifiers.errorMessage).toContain('Cannot find module');
    });
  });

  describe('Error Analysis', () => {
    it('should categorize null/undefined errors', () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const analysis = analyzeError(identifiers);

      expect(analysis.category).toBe('null-reference');
    });

    it('should categorize network errors', () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_RUNTIME_ERROR);
      const analysis = analyzeError(identifiers);

      expect(analysis.category).toBe('network');
    });

    it('should categorize validation errors', () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_VALIDATION_ERROR);
      const analysis = analyzeError(identifiers);

      expect(analysis.category).toBe('validation');
    });

    it('should determine error severity', () => {
      const typeErrorIdentifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const typeErrorAnalysis = analyzeError(typeErrorIdentifiers);

      expect(['low', 'medium', 'high', 'critical']).toContain(typeErrorAnalysis.severity);
    });

    it('should identify affected components', () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const analysis = analyzeError(identifiers);

      expect(analysis.affectedComponents.length).toBeGreaterThan(0);
      expect(analysis.affectedComponents).toContain('AuthService');
    });

    it('should provide root cause analysis', () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const analysis = analyzeError(identifiers);

      expect(analysis.rootCause).toBeDefined();
      expect(analysis.rootCause.length).toBeGreaterThan(0);
    });
  });

  describe('RAG-Enhanced Debugging', () => {
    it('should find relevant code for error location', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);

      mockRAGService.search.mockResolvedValueOnce({
        query: 'AuthService authenticate userId',
        chunks: [{
          id: 'chunk-1',
          content: SAMPLE_TS_FILE.substring(0, 500),
          source: 'src/services/auth.ts',
          score: 0.95,
          lineRange: { start: 15, end: 35 },
        }],
        totalMatches: 1,
        searchTimeMs: 20,
      });

      const result = await mockRAGService.search(
        `${identifiers.functions[0]} ${identifiers.properties[0]}`,
        '/app'
      );

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0].source).toContain('auth.ts');
    });

    it('should use error context for better search', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const queries = generateSearchQueries(identifiers);

      // Should generate contextual queries
      expect(queries.some(q => q.includes('userId'))).toBe(true);
      expect(queries.some(q => q.includes('authenticate'))).toBe(true);
    });

    it('should correlate multiple search results', async () => {
      const identifiers = extractErrorIdentifiers(SAMPLE_TYPE_ERROR);
      const queries = generateSearchQueries(identifiers);

      mockRAGService.searchMultiple.mockResolvedValueOnce(
        queries.map((q, i) => ({
          query: q,
          chunks: [{
            id: `chunk-${i}`,
            content: 'relevant code',
            source: identifiers.files[i % identifiers.files.length],
            score: 0.9 - (i * 0.1),
            lineRange: { start: 1, end: 10 },
          }],
          totalMatches: 1,
          searchTimeMs: 10,
        }))
      );

      const results = await mockRAGService.searchMultiple(queries, '/app');

      expect(results.length).toBe(queries.length);
    });
  });
});

// ============================================================================
// Helper Functions for Tests
// ============================================================================

function extractErrorIdentifiers(errorMessage: string): ErrorIdentifiers {
  const identifiers: ErrorIdentifiers = {
    functions: [],
    files: [],
    properties: [],
    lineNumbers: [],
    errorType: 'Unknown',
    errorMessage: '',
  };

  if (!errorMessage.trim()) {
    return identifiers;
  }

  // Extract error type
  const errorTypeMatch = errorMessage.match(/^(\w+Error|\w+Warning|Error):/m);
  if (errorTypeMatch) {
    identifiers.errorType = errorTypeMatch[1];
  }

  // Extract error message (first line after error type)
  const messageMatch = errorMessage.match(/^(?:\w+Error|\w+Warning|Error):\s*(.+?)$/m);
  if (messageMatch) {
    identifiers.errorMessage = messageMatch[1].trim();
  }

  // Extract property names from "reading 'property'" pattern
  const propertyMatches = errorMessage.matchAll(/reading\s+'([^']+)'/g);
  for (const match of propertyMatches) {
    identifiers.properties.push(match[1]);
  }

  // Extract stack trace entries
  const stackLineRegex = /at\s+(?:async\s+)?(\S+)\s+\(([^:]+):(\d+):\d+\)/g;
  let match;

  while ((match = stackLineRegex.exec(errorMessage)) !== null) {
    const functionName = match[1];
    const filePath = match[2];
    const lineNumber = parseInt(match[3], 10);

    // Filter out node_modules and internal paths
    if (!filePath.includes('node_modules') && !filePath.includes('internal/')) {
      identifiers.functions.push(functionName);

      // Normalize file path (remove /app prefix)
      const normalizedPath = filePath.replace(/^\/app\//, '');
      identifiers.files.push(normalizedPath);
      identifiers.lineNumbers.push(lineNumber);
    }
  }

  return identifiers;
}

function generateSearchQueries(identifiers: ErrorIdentifiers): string[] {
  const queries: string[] = [];

  // Query based on error location
  if (identifiers.functions.length > 0) {
    queries.push(identifiers.functions[0]);
  }

  // Query based on property causing error
  if (identifiers.properties.length > 0) {
    queries.push(identifiers.properties.join(' '));
  }

  // Combined query
  if (identifiers.functions.length > 0 && identifiers.properties.length > 0) {
    queries.push(`${identifiers.functions[0]} ${identifiers.properties[0]}`);
  }

  // Error type specific queries
  if (identifiers.errorType === 'TypeError') {
    queries.push('null check undefined handling');
  } else if (identifiers.errorMessage.includes('Connection')) {
    queries.push('database connection error handling');
  } else if (identifiers.errorType === 'ValidationError') {
    queries.push('input validation error handling');
  }

  return queries;
}

function generateFixSuggestions(
  identifiers: ErrorIdentifiers,
  _searchResults: Array<{ query: string; chunks: Array<{ source: string; score: number }> }>
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  // Generate suggestions based on error type
  if (identifiers.errorType === 'TypeError' && identifiers.properties.length > 0) {
    const prop = identifiers.properties[0];
    suggestions.push({
      description: `Add null/undefined check before accessing '${prop}'`,
      code: `if (obj?.${prop}) { /* use ${prop} */ }`,
      filePath: identifiers.files[0] ?? 'unknown',
      lineNumber: identifiers.lineNumbers[0] ?? 0,
      confidence: 0.9,
      type: 'fix',
    });

    suggestions.push({
      description: 'Use optional chaining operator',
      code: `const value = obj?.${prop} ?? defaultValue;`,
      filePath: identifiers.files[0] ?? 'unknown',
      lineNumber: identifiers.lineNumbers[0] ?? 0,
      confidence: 0.85,
      type: 'fix',
    });
  }

  if (identifiers.errorMessage.includes('Connection')) {
    suggestions.push({
      description: 'Add connection retry logic with exponential backoff',
      code: `async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); }
    catch (e) { await sleep(Math.pow(2, i) * 1000); }
  }
  throw new Error('Max retries exceeded');
}`,
      filePath: identifiers.files[0] ?? 'unknown',
      lineNumber: identifiers.lineNumbers[0] ?? 0,
      confidence: 0.8,
      type: 'fix',
    });

    suggestions.push({
      description: 'Check database connection configuration',
      code: '// Verify DATABASE_URL and connection pool settings',
      filePath: identifiers.files[0] ?? 'unknown',
      lineNumber: identifiers.lineNumbers[0] ?? 0,
      confidence: 0.7,
      type: 'investigation',
    });
  }

  if (identifiers.errorType === 'ValidationError') {
    suggestions.push({
      description: 'Add input validation before processing',
      code: `function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}`,
      filePath: identifiers.files[0] ?? 'unknown',
      lineNumber: identifiers.lineNumbers[0] ?? 0,
      confidence: 0.85,
      type: 'fix',
    });
  }

  return suggestions;
}

function analyzeError(identifiers: ErrorIdentifiers): ErrorAnalysis {
  let category = 'unknown';
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let rootCause = '';

  // Determine category
  if (identifiers.errorType === 'TypeError' ||
      identifiers.errorMessage.includes('undefined') ||
      identifiers.errorMessage.includes('null')) {
    category = 'null-reference';
    rootCause = 'Attempting to access a property on a null or undefined value';
    severity = 'high';
  } else if (identifiers.errorMessage.includes('Connection') ||
             identifiers.errorMessage.includes('network') ||
             identifiers.errorMessage.includes('ECONNREFUSED')) {
    category = 'network';
    rootCause = 'Network connectivity issue or service unavailable';
    severity = 'critical';
  } else if (identifiers.errorType === 'ValidationError' ||
             identifiers.errorMessage.includes('validation') ||
             identifiers.errorMessage.includes('Invalid')) {
    category = 'validation';
    rootCause = 'Input data failed validation constraints';
    severity = 'low';
  } else if (identifiers.errorType === 'SyntaxError') {
    category = 'syntax';
    rootCause = 'Code syntax error preventing execution';
    severity = 'high';
  }

  // Extract affected components from function names
  const affectedComponents = identifiers.functions
    .map(fn => fn.split('.')[0])
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  return {
    category,
    severity,
    rootCause,
    affectedComponents,
  };
}
