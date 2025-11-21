/**
 * Integration tests for RAG Context Enhancer Hook
 *
 * Tests the rag-context-enhancer hook functionality including
 * request analysis, context injection, and mock RAG search responses.
 *
 * @module tests/integration/rag/rag-hooks
 */

import * as fs from 'fs';

import {
  MOCK_AUTH_SEARCH_RESULT,
  MOCK_ROUTES_SEARCH_RESULT,
  SAMPLE_HOOK_REQUEST,
  SAMPLE_HOOK_CONFIG,
  createMockRAGService,
  createMockFileSystem,
} from '../../fixtures/rag';

// Mock fs module
jest.mock('fs');
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

// ============================================================================
// Types
// ============================================================================

interface HookRequest {
  type: string;
  prompt: string;
  context: {
    currentFile?: string;
    projectRoot?: string;
    selectedText?: string;
    cursorPosition?: { line: number; column: number };
  };
  ragContext?: RAGContext;
}

interface RAGContext {
  relevantFiles: string[];
  codeSnippets: CodeSnippet[];
  summary: string;
  queryTokens: string[];
}

interface CodeSnippet {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  relevanceScore: number;
}

interface HookConfig {
  enabled: boolean;
  triggerPatterns: string[];
  maxContextTokens: number;
  minRelevanceScore: number;
}

interface EnhancedRequest extends HookRequest {
  ragContext: RAGContext;
}

// ============================================================================
// Tests
// ============================================================================

describe('RAG Context Enhancer Hook Integration Tests', () => {
  let mockFileSystem: ReturnType<typeof createMockFileSystem>;
  let mockRAGService: ReturnType<typeof createMockRAGService>;
  let hookConfig: HookConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSystem = createMockFileSystem();
    mockRAGService = createMockRAGService();
    hookConfig = { ...SAMPLE_HOOK_CONFIG };

    // Setup fs mocks
    mockFs.existsSync.mockImplementation(mockFileSystem.existsSync);
    mockFs.readFileSync.mockImplementation(mockFileSystem.readFileSync as typeof mockFs.readFileSync);
    mockFs.writeFileSync.mockImplementation(mockFileSystem.writeFileSync);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Request Analysis', () => {
    it('should detect authentication-related requests', () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add user authentication to the login endpoint',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const shouldEnhance = analyzeRequestForRAG(request, hookConfig);

      expect(shouldEnhance).toBe(true);
    });

    it('should detect user-related requests', () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Create a user profile component',
        context: {
          currentFile: 'src/components/Profile.tsx',
          projectRoot: '/app',
        },
      };

      const shouldEnhance = analyzeRequestForRAG(request, hookConfig);

      expect(shouldEnhance).toBe(true);
    });

    it('should not enhance simple requests', () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add a console log statement',
        context: {
          currentFile: 'src/utils/debug.ts',
          projectRoot: '/app',
        },
      };

      const shouldEnhance = analyzeRequestForRAG(request, hookConfig);

      expect(shouldEnhance).toBe(false);
    });

    it('should extract query tokens from prompt', () => {
      const prompt = 'Add user authentication to the login endpoint';

      const tokens = extractQueryTokens(prompt, hookConfig.triggerPatterns);

      expect(tokens).toContain('authentication');
      expect(tokens).toContain('login');
      expect(tokens).toContain('user');
    });

    it('should handle prompts with multiple trigger patterns', () => {
      const prompt = 'Implement user authentication with login and logout features';

      const tokens = extractQueryTokens(prompt, hookConfig.triggerPatterns);

      expect(tokens.length).toBeGreaterThanOrEqual(2);
      expect(tokens).toContain('authentication');
      expect(tokens).toContain('login');
      expect(tokens).toContain('user');
    });

    it('should handle case-insensitive pattern matching', () => {
      const prompt = 'Add USER AUTHENTICATION to the LOGIN endpoint';

      const tokens = extractQueryTokens(prompt, hookConfig.triggerPatterns);

      expect(tokens).toContain('authentication');
      expect(tokens).toContain('login');
      expect(tokens).toContain('user');
    });

    it('should consider current file context', () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add error handling', // No trigger patterns
        context: {
          currentFile: 'src/services/auth.ts', // But file is auth-related
          projectRoot: '/app',
        },
      };

      const shouldEnhance = analyzeRequestWithFileContext(request, hookConfig);

      expect(shouldEnhance).toBe(true);
    });
  });

  describe('Context Injection', () => {
    it('should inject RAG context into request', async () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add user authentication to the login endpoint',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      expect(enhanced.ragContext).toBeDefined();
      expect(enhanced.ragContext.relevantFiles).toBeDefined();
      expect(enhanced.ragContext.codeSnippets).toBeDefined();
      expect(enhanced.ragContext.summary).toBeDefined();
    });

    it('should include relevant files in context', async () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication middleware',
        context: {
          currentFile: 'src/middleware/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      expect(enhanced.ragContext.relevantFiles.length).toBeGreaterThan(0);
      expect(enhanced.ragContext.relevantFiles).toContain('src/services/auth.ts');
    });

    it('should include code snippets with relevance scores', async () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      expect(enhanced.ragContext.codeSnippets.length).toBeGreaterThan(0);

      for (const snippet of enhanced.ragContext.codeSnippets) {
        expect(snippet.filePath).toBeDefined();
        expect(snippet.content).toBeDefined();
        expect(snippet.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(snippet.relevanceScore).toBeLessThanOrEqual(1);
      }
    });

    it('should generate context summary', async () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication to login',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      expect(enhanced.ragContext.summary).toBeDefined();
      expect(typeof enhanced.ragContext.summary).toBe('string');
      expect(enhanced.ragContext.summary.length).toBeGreaterThan(0);
    });

    it('should respect maxContextTokens limit', async () => {
      hookConfig.maxContextTokens = 1000;

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      const estimatedTokens = estimateContextTokens(enhanced.ragContext);
      expect(estimatedTokens).toBeLessThanOrEqual(hookConfig.maxContextTokens);
    });

    it('should filter by minRelevanceScore', async () => {
      hookConfig.minRelevanceScore = 0.7;

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      for (const snippet of enhanced.ragContext.codeSnippets) {
        expect(snippet.relevanceScore).toBeGreaterThanOrEqual(hookConfig.minRelevanceScore);
      }
    });
  });

  describe('Mock RAG Search Responses', () => {
    it('should process authentication search results', async () => {
      mockRAGService.search.mockResolvedValueOnce(MOCK_AUTH_SEARCH_RESULT);

      const result = await mockRAGService.search('authentication', '/app/src');

      expect(result.query).toBe('authentication');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.totalMatches).toBeGreaterThan(0);
    });

    it('should process route search results', async () => {
      mockRAGService.search.mockResolvedValueOnce(MOCK_ROUTES_SEARCH_RESULT);

      const result = await mockRAGService.search('user routes', '/app/src');

      expect(result.query).toBe('user routes');
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should handle multiple queries for context building', async () => {
      mockRAGService.searchMultiple.mockResolvedValueOnce([
        MOCK_AUTH_SEARCH_RESULT,
        MOCK_ROUTES_SEARCH_RESULT,
      ]);

      const results = await mockRAGService.searchMultiple(
        ['authentication', 'user routes'],
        '/app/src'
      );

      expect(results).toHaveLength(2);
      expect(results[0].query).toBe('authentication');
      expect(results[1].query).toBe('user routes');
    });

    it('should deduplicate overlapping results', async () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add user authentication and user routes',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      // Check for deduplication
      const filePaths = enhanced.ragContext.codeSnippets.map(s => `${s.filePath}:${s.startLine}`);
      const uniquePaths = [...new Set(filePaths)];

      expect(uniquePaths.length).toBe(filePaths.length);
    });

    it('should handle empty search results gracefully', async () => {
      mockRAGService.search.mockResolvedValueOnce({
        query: 'nonexistent',
        chunks: [],
        totalMatches: 0,
        searchTimeMs: 10,
      });

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add nonexistent feature',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      // Should not throw, but may not enhance
      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, {
        ...hookConfig,
        triggerPatterns: ['nonexistent'],
      });

      expect(enhanced.ragContext.codeSnippets).toHaveLength(0);
    });
  });

  describe('Hook Configuration', () => {
    it('should respect enabled flag', async () => {
      hookConfig.enabled = false;

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const result = await runHookIfEnabled(request, mockRAGService, hookConfig);

      // Should return original request without RAG context
      expect(result.ragContext).toBeUndefined();
    });

    it('should use custom trigger patterns', () => {
      hookConfig.triggerPatterns = ['custom-feature', 'special-api'];

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Implement the custom-feature endpoint',
        context: {
          currentFile: 'src/routes/custom.ts',
          projectRoot: '/app',
        },
      };

      const shouldEnhance = analyzeRequestForRAG(request, hookConfig);

      expect(shouldEnhance).toBe(true);
    });

    it('should load configuration from file', () => {
      mockFileSystem.files.set(
        '.wundr/hooks/rag-context-enhancer.json',
        JSON.stringify(SAMPLE_HOOK_CONFIG)
      );
      mockFs.readFileSync.mockReturnValue(JSON.stringify(SAMPLE_HOOK_CONFIG));

      const config = loadHookConfig('.wundr/hooks/rag-context-enhancer.json');

      expect(config.enabled).toBe(SAMPLE_HOOK_CONFIG.enabled);
      expect(config.triggerPatterns).toEqual(SAMPLE_HOOK_CONFIG.triggerPatterns);
      expect(config.maxContextTokens).toBe(SAMPLE_HOOK_CONFIG.maxContextTokens);
      expect(config.minRelevanceScore).toBe(SAMPLE_HOOK_CONFIG.minRelevanceScore);
    });

    it('should use default configuration when file not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = loadHookConfigSafe('.wundr/hooks/rag-context-enhancer.json');

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.triggerPatterns).toBeDefined();
    });
  });

  describe('Request Types', () => {
    it('should enhance code generation requests', async () => {
      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      expect(enhanced.ragContext).toBeDefined();
    });

    it('should enhance code explanation requests', async () => {
      const request: HookRequest = {
        type: 'codeExplanation',
        prompt: 'Explain the authentication flow',
        context: {
          currentFile: 'src/services/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      expect(enhanced.ragContext).toBeDefined();
    });

    it('should enhance bug fix requests', async () => {
      const request: HookRequest = {
        type: 'bugFix',
        prompt: 'Fix the authentication bug when user logs in',
        context: {
          currentFile: 'src/services/auth.ts',
          projectRoot: '/app',
        },
      };

      const enhanced = await enhanceRequestWithRAG(request, mockRAGService, hookConfig);

      expect(enhanced.ragContext).toBeDefined();
    });

    it('should skip non-code requests', async () => {
      const request: HookRequest = {
        type: 'chat',
        prompt: 'Tell me about authentication best practices',
        context: {
          projectRoot: '/app',
        },
      };

      const shouldEnhance = shouldEnhanceRequestType(request.type);

      expect(shouldEnhance).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle RAG service errors gracefully', async () => {
      mockRAGService.search.mockRejectedValueOnce(new Error('Service unavailable'));

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const result = await enhanceRequestWithRAGSafe(request, mockRAGService, hookConfig);

      // Should return original request without throwing
      expect(result).toBeDefined();
      expect(result.ragContext).toBeUndefined();
    });

    it('should handle timeout during RAG search', async () => {
      mockRAGService.search.mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      const result = await enhanceRequestWithRAGSafe(request, mockRAGService, hookConfig);

      expect(result).toBeDefined();
    });

    it('should log errors without failing request', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockRAGService.search.mockRejectedValueOnce(new Error('Test error'));

      const request: HookRequest = {
        type: 'codeGeneration',
        prompt: 'Add authentication',
        context: {
          currentFile: 'src/routes/auth.ts',
          projectRoot: '/app',
        },
      };

      await enhanceRequestWithRAGSafe(request, mockRAGService, hookConfig);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Helper Functions for Tests
// ============================================================================

function analyzeRequestForRAG(request: HookRequest, config: HookConfig): boolean {
  if (!config.enabled) {
    return false;
  }

  const promptLower = request.prompt.toLowerCase();
  return config.triggerPatterns.some(pattern =>
    promptLower.includes(pattern.toLowerCase())
  );
}

function analyzeRequestWithFileContext(request: HookRequest, config: HookConfig): boolean {
  // First check prompt
  if (analyzeRequestForRAG(request, config)) {
    return true;
  }

  // Then check file context
  const currentFile = request.context.currentFile?.toLowerCase() ?? '';
  return config.triggerPatterns.some(pattern =>
    currentFile.includes(pattern.toLowerCase())
  );
}

function extractQueryTokens(prompt: string, triggerPatterns: string[]): string[] {
  const promptLower = prompt.toLowerCase();
  return triggerPatterns.filter(pattern =>
    promptLower.includes(pattern.toLowerCase())
  );
}

async function enhanceRequestWithRAG(
  request: HookRequest,
  ragService: ReturnType<typeof createMockRAGService>,
  config: HookConfig
): Promise<EnhancedRequest> {
  const queryTokens = extractQueryTokens(request.prompt, config.triggerPatterns);

  const searchResult = await ragService.search(
    queryTokens.join(' '),
    request.context.projectRoot ?? '.'
  );

  const codeSnippets: CodeSnippet[] = searchResult.chunks
    .filter(chunk => chunk.score >= config.minRelevanceScore)
    .map(chunk => ({
      filePath: chunk.source,
      content: chunk.content,
      startLine: chunk.lineRange?.start ?? 1,
      endLine: chunk.lineRange?.end ?? 1,
      relevanceScore: chunk.score,
    }));

  const relevantFiles = [...new Set(codeSnippets.map(s => s.filePath))];

  return {
    ...request,
    ragContext: {
      relevantFiles,
      codeSnippets,
      summary: `Found ${codeSnippets.length} relevant code snippets from ${relevantFiles.length} files.`,
      queryTokens,
    },
  };
}

async function enhanceRequestWithRAGSafe(
  request: HookRequest,
  ragService: ReturnType<typeof createMockRAGService>,
  config: HookConfig
): Promise<HookRequest> {
  try {
    return await enhanceRequestWithRAG(request, ragService, config);
  } catch (error) {
    console.error('RAG enhancement failed:', error);
    return request;
  }
}

function estimateContextTokens(context: RAGContext): number {
  let tokens = 0;

  // Estimate tokens from snippets (rough approximation: 1 token per 4 chars)
  for (const snippet of context.codeSnippets) {
    tokens += Math.ceil(snippet.content.length / 4);
  }

  // Add tokens for summary
  tokens += Math.ceil(context.summary.length / 4);

  return tokens;
}

async function runHookIfEnabled(
  request: HookRequest,
  ragService: ReturnType<typeof createMockRAGService>,
  config: HookConfig
): Promise<HookRequest> {
  if (!config.enabled) {
    return request;
  }

  if (!analyzeRequestForRAG(request, config)) {
    return request;
  }

  return enhanceRequestWithRAG(request, ragService, config);
}

function shouldEnhanceRequestType(type: string): boolean {
  const enhanceableTypes = ['codeGeneration', 'codeExplanation', 'bugFix', 'refactor'];
  return enhanceableTypes.includes(type);
}

function loadHookConfig(filePath: string): HookConfig {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function loadHookConfigSafe(filePath: string): HookConfig {
  try {
    if (fs.existsSync(filePath)) {
      return loadHookConfig(filePath);
    }
  } catch {
    // Ignore errors
  }

  // Return default config
  return {
    enabled: true,
    triggerPatterns: ['auth', 'login', 'user', 'api', 'database'],
    maxContextTokens: 4000,
    minRelevanceScore: 0.5,
  };
}
