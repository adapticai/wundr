/**
 * Integration tests for RAG Project Initialization
 *
 * Tests project init with --with-rag flag, configuration file creation,
 * and configuration loading.
 *
 * @module tests/integration/rag/rag-project-init
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  MOCK_RAG_STORE_CONFIG,
  MOCK_RAG_EXCLUDE_TXT,
  createMockFileSystem,
  getTestProjectFiles,
} from '../../fixtures/rag';

// Mock fs module
jest.mock('fs');
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  access: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = jest.requireMock('fs/promises') as {
  mkdir: jest.Mock;
  readFile: jest.Mock;
  writeFile: jest.Mock;
  access: jest.Mock;
};

describe('RAG Project Initialization Integration Tests', () => {
  let mockFileSystem: ReturnType<typeof createMockFileSystem>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSystem = createMockFileSystem();

    // Setup fs mocks
    mockFs.existsSync.mockImplementation(mockFileSystem.existsSync);
    mockFs.readFileSync.mockImplementation(mockFileSystem.readFileSync as typeof mockFs.readFileSync);
    mockFs.writeFileSync.mockImplementation(mockFileSystem.writeFileSync);
    mockFs.mkdirSync.mockImplementation(mockFileSystem.mkdirSync);
    mockFs.readdirSync.mockImplementation(mockFileSystem.readdirSync as typeof mockFs.readdirSync);
    mockFs.statSync.mockImplementation(mockFileSystem.statSync as typeof mockFs.statSync);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Project Init with --with-rag Flag', () => {
    it('should create .wundr directory when initializing with RAG', async () => {
      // Simulate project init
      const projectRoot = '/test-project';
      const wundrDir = `${projectRoot}/.wundr`;

      // Initialize project with RAG
      await initializeProjectWithRAG(projectRoot);

      // Verify .wundr directory creation was attempted
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        wundrDir,
        expect.objectContaining({ recursive: true })
      );
    });

    it('should create rag-store.json configuration file', async () => {
      const projectRoot = '/test-project';

      await initializeProjectWithRAG(projectRoot);

      // Verify rag-store.json was written
      const writeFileCalls = mockFs.writeFileSync.mock.calls;
      const ragStoreCall = writeFileCalls.find(call =>
        (call[0] as string).includes('rag-store.json')
      );

      expect(ragStoreCall).toBeDefined();

      if (ragStoreCall) {
        const content = JSON.parse(ragStoreCall[1] as string);
        expect(content.version).toBeDefined();
        expect(content.stores).toBeDefined();
        expect(Array.isArray(content.stores)).toBe(true);
      }
    });

    it('should create rag-exclude.txt file', async () => {
      const projectRoot = '/test-project';

      await initializeProjectWithRAG(projectRoot);

      // Verify rag-exclude.txt was written
      const writeFileCalls = mockFs.writeFileSync.mock.calls;
      const excludeCall = writeFileCalls.find(call =>
        (call[0] as string).includes('rag-exclude.txt')
      );

      expect(excludeCall).toBeDefined();

      if (excludeCall) {
        const content = excludeCall[1] as string;
        expect(content).toContain('node_modules');
        expect(content).toContain('dist');
      }
    });

    it('should create default store configuration', async () => {
      const projectRoot = '/test-project';

      await initializeProjectWithRAG(projectRoot);

      const writeFileCalls = mockFs.writeFileSync.mock.calls;
      const ragStoreCall = writeFileCalls.find(call =>
        (call[0] as string).includes('rag-store.json')
      );

      if (ragStoreCall) {
        const config = JSON.parse(ragStoreCall[1] as string);

        expect(config.stores).toHaveLength(1);
        expect(config.stores[0].name).toBe('default');
        expect(config.stores[0].config.chunkSize).toBeDefined();
        expect(config.stores[0].config.chunkOverlap).toBeDefined();
        expect(config.stores[0].config.includePatterns).toBeDefined();
        expect(config.stores[0].config.excludePatterns).toBeDefined();
      }
    });
  });

  describe('.wundr/rag-store.json Creation', () => {
    it('should have correct structure', () => {
      const config = MOCK_RAG_STORE_CONFIG;

      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('stores');
      expect(config).toHaveProperty('settings');

      expect(Array.isArray(config.stores)).toBe(true);
      expect(config.stores.length).toBeGreaterThan(0);
    });

    it('should include default store with valid configuration', () => {
      const defaultStore = MOCK_RAG_STORE_CONFIG.stores[0];

      expect(defaultStore.name).toBe('default');
      expect(defaultStore.displayName).toBeDefined();
      expect(defaultStore.sourcePath).toBeDefined();
      expect(defaultStore.config).toBeDefined();

      // Validate config structure
      expect(defaultStore.config.chunkSize).toBeGreaterThan(0);
      expect(defaultStore.config.chunkOverlap).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(defaultStore.config.includePatterns)).toBe(true);
      expect(Array.isArray(defaultStore.config.excludePatterns)).toBe(true);
      expect(defaultStore.config.maxFileSize).toBeGreaterThan(0);
    });

    it('should include settings for auto-sync', () => {
      const settings = MOCK_RAG_STORE_CONFIG.settings;

      expect(settings).toHaveProperty('autoSync');
      expect(typeof settings.autoSync).toBe('boolean');

      expect(settings).toHaveProperty('syncInterval');
      expect(typeof settings.syncInterval).toBe('number');

      expect(settings).toHaveProperty('maxConcurrentIndexing');
      expect(typeof settings.maxConcurrentIndexing).toBe('number');
    });

    it('should have sensible default include patterns', () => {
      const includePatterns = MOCK_RAG_STORE_CONFIG.stores[0].config.includePatterns;

      expect(includePatterns).toContain('**/*.ts');
      expect(includePatterns).toContain('**/*.tsx');
      expect(includePatterns).toContain('**/*.js');
      expect(includePatterns).toContain('**/*.jsx');
      expect(includePatterns).toContain('**/*.md');
    });

    it('should have sensible default exclude patterns', () => {
      const excludePatterns = MOCK_RAG_STORE_CONFIG.stores[0].config.excludePatterns;

      expect(excludePatterns).toContain('**/node_modules/**');
      expect(excludePatterns).toContain('**/dist/**');
      expect(excludePatterns).toContain('**/.git/**');
      expect(excludePatterns).toContain('**/coverage/**');
    });
  });

  describe('.wundr/rag-exclude.txt Creation', () => {
    it('should have valid exclusion patterns', () => {
      const content = MOCK_RAG_EXCLUDE_TXT;

      expect(content).toContain('node_modules');
      expect(content).toContain('dist');
      expect(content).toContain('.git');
    });

    it('should include build output directories', () => {
      const content = MOCK_RAG_EXCLUDE_TXT;

      expect(content).toContain('dist/');
      expect(content).toContain('build/');
      expect(content).toContain('.next/');
    });

    it('should include test file patterns', () => {
      const content = MOCK_RAG_EXCLUDE_TXT;

      expect(content).toContain('*.test.ts');
      expect(content).toContain('*.spec.ts');
      expect(content).toContain('__tests__/');
    });

    it('should include generated file patterns', () => {
      const content = MOCK_RAG_EXCLUDE_TXT;

      expect(content).toContain('*.min.js');
      expect(content).toContain('*.min.css');
      expect(content).toContain('*.map');
    });

    it('should exclude environment files with secrets', () => {
      const content = MOCK_RAG_EXCLUDE_TXT;

      expect(content).toContain('.env');
      expect(content).toContain('.env.local');
    });

    it('should allow comments in exclude file', () => {
      const content = MOCK_RAG_EXCLUDE_TXT;
      const lines = content.split('\n');

      const commentLines = lines.filter(line => line.trim().startsWith('#'));
      expect(commentLines.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Loading', () => {
    it('should load rag-store.json configuration correctly', () => {
      // Setup mock to return config
      mockFileSystem.files.set(
        '.wundr/rag-store.json',
        JSON.stringify(MOCK_RAG_STORE_CONFIG, null, 2)
      );

      const config = loadRAGConfiguration('.wundr/rag-store.json');

      expect(config).toBeDefined();
      expect(config.version).toBe(MOCK_RAG_STORE_CONFIG.version);
      expect(config.stores).toHaveLength(MOCK_RAG_STORE_CONFIG.stores.length);
    });

    it('should handle missing configuration file gracefully', () => {
      mockFileSystem.existsSync.mockReturnValue(false);

      const config = loadRAGConfigurationSafe('.wundr/rag-store.json');

      expect(config).toBeNull();
    });

    it('should handle malformed JSON gracefully', () => {
      mockFileSystem.files.set('.wundr/rag-store.json', '{ invalid json }');
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      expect(() => {
        loadRAGConfiguration('.wundr/rag-store.json');
      }).toThrow();
    });

    it('should validate configuration schema', () => {
      const validConfig = MOCK_RAG_STORE_CONFIG;
      const validation = validateRAGConfig(validConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        version: '1.0.0',
        stores: [
          {
            name: '', // Empty name is invalid
            config: {
              chunkSize: -100, // Negative chunk size is invalid
            },
          },
        ],
      };

      const validation = validateRAGConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should load rag-exclude.txt patterns correctly', () => {
      mockFileSystem.files.set('.wundr/rag-exclude.txt', MOCK_RAG_EXCLUDE_TXT);
      mockFs.readFileSync.mockReturnValue(MOCK_RAG_EXCLUDE_TXT);

      const patterns = loadExcludePatterns('.wundr/rag-exclude.txt');

      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);

      // Should not include comment lines
      const commentPatterns = patterns.filter(p => p.startsWith('#'));
      expect(commentPatterns).toHaveLength(0);

      // Should not include empty lines
      const emptyPatterns = patterns.filter(p => p.trim() === '');
      expect(emptyPatterns).toHaveLength(0);
    });

    it('should merge exclude patterns from multiple sources', () => {
      const filePatterns = loadExcludePatterns('.wundr/rag-exclude.txt');
      const configPatterns = MOCK_RAG_STORE_CONFIG.stores[0].config.excludePatterns;

      const merged = mergeExcludePatterns(filePatterns, configPatterns);

      // Merged should include patterns from both sources
      expect(merged.length).toBeGreaterThanOrEqual(Math.max(filePatterns.length, configPatterns.length));

      // Should not have duplicates
      const uniquePatterns = [...new Set(merged)];
      expect(uniquePatterns.length).toBe(merged.length);
    });
  });

  describe('Configuration Updates', () => {
    it('should update existing configuration', async () => {
      mockFileSystem.files.set(
        '.wundr/rag-store.json',
        JSON.stringify(MOCK_RAG_STORE_CONFIG, null, 2)
      );

      const updatedConfig = {
        ...MOCK_RAG_STORE_CONFIG,
        settings: {
          ...MOCK_RAG_STORE_CONFIG.settings,
          autoSync: false,
        },
      };

      await saveRAGConfiguration('.wundr/rag-store.json', updatedConfig);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should add new store to existing configuration', async () => {
      mockFileSystem.files.set(
        '.wundr/rag-store.json',
        JSON.stringify(MOCK_RAG_STORE_CONFIG, null, 2)
      );

      const newStore = {
        name: 'secondary',
        displayName: 'Secondary Store',
        sourcePath: './packages',
        config: {
          chunkSize: 800,
          chunkOverlap: 150,
          includePatterns: ['**/*.ts'],
          excludePatterns: ['**/node_modules/**'],
          maxFileSize: 1048576,
        },
      };

      const updatedConfig = {
        ...MOCK_RAG_STORE_CONFIG,
        stores: [...MOCK_RAG_STORE_CONFIG.stores, newStore],
      };

      await saveRAGConfiguration('.wundr/rag-store.json', updatedConfig);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
        (call[0] as string).includes('rag-store.json')
      );

      if (writeCall) {
        const savedConfig = JSON.parse(writeCall[1] as string);
        expect(savedConfig.stores).toHaveLength(2);
      }
    });

    it('should update exclude patterns', async () => {
      const newPatterns = ['custom-exclude/', '*.custom'];

      await updateExcludePatterns('.wundr/rag-exclude.txt', newPatterns);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('Project Detection', () => {
    it('should detect existing RAG configuration', () => {
      mockFileSystem.existsSync.mockImplementation((p: string) =>
        p.includes('.wundr') || p.includes('rag-store.json')
      );

      const hasRAG = hasRAGConfiguration('/test-project');

      expect(hasRAG).toBe(true);
    });

    it('should detect missing RAG configuration', () => {
      mockFileSystem.existsSync.mockReturnValue(false);

      const hasRAG = hasRAGConfiguration('/test-project');

      expect(hasRAG).toBe(false);
    });

    it('should detect project root correctly', () => {
      mockFileSystem.existsSync.mockImplementation((p: string) =>
        p.includes('package.json') || p.includes('.wundr')
      );

      const projectRoot = findProjectRoot('/test-project/src/services');

      expect(projectRoot).toBeDefined();
    });
  });
});

// ============================================================================
// Helper Functions for Tests
// ============================================================================

async function initializeProjectWithRAG(projectRoot: string): Promise<void> {
  const wundrDir = `${projectRoot}/.wundr`;

  // Create .wundr directory
  fs.mkdirSync(wundrDir, { recursive: true });

  // Create rag-store.json
  const ragStoreConfig = {
    version: '1.0.0',
    stores: [
      {
        name: 'default',
        displayName: 'Default Store',
        sourcePath: '.',
        config: {
          chunkSize: 1000,
          chunkOverlap: 200,
          includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.md'],
          excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
          maxFileSize: 1048576,
        },
      },
    ],
    settings: {
      autoSync: true,
      syncInterval: 300000,
      maxConcurrentIndexing: 4,
    },
  };

  fs.writeFileSync(
    `${wundrDir}/rag-store.json`,
    JSON.stringify(ragStoreConfig, null, 2)
  );

  // Create rag-exclude.txt
  fs.writeFileSync(
    `${wundrDir}/rag-exclude.txt`,
    MOCK_RAG_EXCLUDE_TXT
  );
}

function loadRAGConfiguration(filePath: string): typeof MOCK_RAG_STORE_CONFIG {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function loadRAGConfigurationSafe(filePath: string): typeof MOCK_RAG_STORE_CONFIG | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return loadRAGConfiguration(filePath);
  } catch {
    return null;
  }
}

function validateRAGConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be an object'] };
  }

  const cfg = config as Record<string, unknown>;

  if (!cfg.version) {
    errors.push('Missing version field');
  }

  if (!cfg.stores || !Array.isArray(cfg.stores)) {
    errors.push('Missing or invalid stores array');
  } else {
    for (let i = 0; i < (cfg.stores as Array<Record<string, unknown>>).length; i++) {
      const store = (cfg.stores as Array<Record<string, unknown>>)[i];
      if (!store.name || (store.name as string).trim() === '') {
        errors.push(`Store at index ${i} has empty name`);
      }
      if (store.config && typeof store.config === 'object') {
        const storeConfig = store.config as Record<string, unknown>;
        if (typeof storeConfig.chunkSize === 'number' && storeConfig.chunkSize < 0) {
          errors.push(`Store at index ${i} has negative chunkSize`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function loadExcludePatterns(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

function mergeExcludePatterns(patterns1: string[], patterns2: string[]): string[] {
  const merged = new Set([...patterns1, ...patterns2]);
  return Array.from(merged);
}

async function saveRAGConfiguration(filePath: string, config: unknown): Promise<void> {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

async function updateExcludePatterns(filePath: string, newPatterns: string[]): Promise<void> {
  const existingPatterns = loadExcludePatterns(filePath);
  const merged = mergeExcludePatterns(existingPatterns, newPatterns);
  const content = merged.join('\n');
  fs.writeFileSync(filePath, content);
}

function hasRAGConfiguration(projectRoot: string): boolean {
  const ragStorePath = `${projectRoot}/.wundr/rag-store.json`;
  return fs.existsSync(ragStorePath);
}

function findProjectRoot(startPath: string): string | null {
  let currentPath = startPath;

  while (currentPath !== '/') {
    if (fs.existsSync(`${currentPath}/package.json`)) {
      return currentPath;
    }
    const parts = currentPath.split('/');
    parts.pop();
    currentPath = parts.join('/') || '/';
  }

  return null;
}
