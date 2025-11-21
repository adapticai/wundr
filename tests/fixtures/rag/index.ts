/**
 * RAG Test Fixtures
 *
 * Sample data and expected outputs for RAG integration tests.
 *
 * @module tests/fixtures/rag
 */

// ============================================================================
// Sample Source Files for RAG Indexing
// ============================================================================

/**
 * Sample TypeScript source file content
 */
export const SAMPLE_TS_FILE = `
import { Logger } from '@/utils/logger';
import { UserService } from '@/services/user-service';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  user: User;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  language: string;
}

export class AuthService {
  private logger: Logger;
  private userService: UserService;

  constructor(logger: Logger, userService: UserService) {
    this.logger = logger;
    this.userService = userService;
  }

  async authenticate(email: string, password: string): Promise<User | null> {
    this.logger.info(\`Authenticating user: \${email}\`);
    const user = await this.userService.findByEmail(email);
    if (!user) {
      this.logger.warn(\`User not found: \${email}\`);
      return null;
    }
    // Authentication logic
    return user;
  }

  async logout(userId: string): Promise<void> {
    this.logger.info(\`Logging out user: \${userId}\`);
    // Logout logic
  }
}
`;

/**
 * Sample JavaScript source file content
 */
export const SAMPLE_JS_FILE = `
const express = require('express');
const { validateRequest } = require('./middleware/validation');

const router = express.Router();

/**
 * User routes for REST API
 */

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await UserService.getAll();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user by ID
router.get('/users/:id', validateRequest, async (req, res) => {
  try {
    const user = await UserService.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create user
router.post('/users', validateRequest, async (req, res) => {
  try {
    const user = await UserService.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
`;

/**
 * Sample Markdown documentation content
 */
export const SAMPLE_MD_FILE = `
# User Authentication

This document describes the authentication flow for the application.

## Overview

The authentication system uses JWT tokens for session management.

### Features

- Email/password authentication
- OAuth2 support (Google, GitHub)
- Two-factor authentication (2FA)
- Session management
- Password reset flow

## API Endpoints

### POST /auth/login

Authenticates a user with email and password.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123",
    "name": "John Doe",
    "email": "user@example.com"
  }
}
\`\`\`

### POST /auth/logout

Logs out the current user and invalidates their session.

## Error Handling

All authentication errors return standardized error responses:

\`\`\`json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "AUTH_INVALID_CREDENTIALS"
}
\`\`\`
`;

/**
 * Sample JSON configuration content
 */
export const SAMPLE_JSON_FILE = `{
  "app": {
    "name": "sample-application",
    "version": "1.0.0",
    "environment": "development"
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "app_db",
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "auth": {
    "jwtSecret": "your-secret-key",
    "tokenExpiry": "24h",
    "refreshTokenExpiry": "7d"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}`;

// ============================================================================
// Mock RAG Store Data
// ============================================================================

/**
 * Mock RAG store metadata
 */
export const MOCK_RAG_STORE = {
  id: 'test-store-001',
  displayName: 'Test Store',
  createdAt: '2024-01-15T10:00:00.000Z',
  lastSyncAt: '2024-01-15T12:30:00.000Z',
  fileCount: 15,
  chunkCount: 120,
  sizeBytes: 45000,
  status: 'active' as const,
  config: {
    chunkSize: 1000,
    chunkOverlap: 200,
    includePatterns: ['**/*.ts', '**/*.js', '**/*.md'],
    excludePatterns: ['**/node_modules/**', '**/dist/**'],
    maxFileSize: 1024 * 1024,
    embeddingModel: 'text-embedding-004',
  },
};

/**
 * Mock indexed file metadata
 */
export const MOCK_INDEXED_FILES = [
  {
    path: 'src/services/auth.ts',
    hash: 'a1b2c3d4e5f6',
    sizeBytes: 3500,
    lastModified: '2024-01-15T09:00:00.000Z',
    indexedAt: '2024-01-15T10:05:00.000Z',
    chunkCount: 8,
    mimeType: 'text/typescript',
  },
  {
    path: 'src/routes/users.js',
    hash: 'f6e5d4c3b2a1',
    sizeBytes: 2800,
    lastModified: '2024-01-14T16:00:00.000Z',
    indexedAt: '2024-01-15T10:05:00.000Z',
    chunkCount: 6,
    mimeType: 'text/javascript',
  },
  {
    path: 'docs/authentication.md',
    hash: 'deadbeef1234',
    sizeBytes: 1500,
    lastModified: '2024-01-13T14:00:00.000Z',
    indexedAt: '2024-01-15T10:05:00.000Z',
    chunkCount: 4,
    mimeType: 'text/markdown',
  },
];

// ============================================================================
// Mock Search Results
// ============================================================================

/**
 * Mock RAG search chunks for "authentication" query
 */
export const MOCK_AUTH_SEARCH_CHUNKS = [
  {
    id: 'chunk-001',
    content: `export class AuthService {
  private logger: Logger;
  private userService: UserService;

  constructor(logger: Logger, userService: UserService) {
    this.logger = logger;
    this.userService = userService;
  }

  async authenticate(email: string, password: string): Promise<User | null> {
    this.logger.info(\`Authenticating user: \${email}\`);
    const user = await this.userService.findByEmail(email);
    if (!user) {
      this.logger.warn(\`User not found: \${email}\`);
      return null;
    }
    return user;
  }
}`,
    source: 'src/services/auth.ts',
    score: 0.92,
    timestamp: new Date('2024-01-15T10:05:00.000Z'),
    lineRange: { start: 15, end: 35 },
    metadata: { language: 'typescript' },
  },
  {
    id: 'chunk-002',
    content: `# User Authentication

This document describes the authentication flow for the application.

## Overview

The authentication system uses JWT tokens for session management.

### Features

- Email/password authentication
- OAuth2 support (Google, GitHub)
- Two-factor authentication (2FA)`,
    source: 'docs/authentication.md',
    score: 0.88,
    timestamp: new Date('2024-01-15T10:05:00.000Z'),
    lineRange: { start: 1, end: 15 },
    metadata: { language: 'markdown' },
  },
  {
    id: 'chunk-003',
    content: `### POST /auth/login

Authenticates a user with email and password.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
\`\`\``,
    source: 'docs/authentication.md',
    score: 0.75,
    timestamp: new Date('2024-01-15T10:05:00.000Z'),
    lineRange: { start: 22, end: 35 },
    metadata: { language: 'markdown' },
  },
];

/**
 * Mock RAG search result for "authentication" query
 */
export const MOCK_AUTH_SEARCH_RESULT = {
  query: 'authentication',
  chunks: MOCK_AUTH_SEARCH_CHUNKS,
  totalMatches: 3,
  searchTimeMs: 45,
};

/**
 * Mock RAG search chunks for "user routes" query
 */
export const MOCK_ROUTES_SEARCH_CHUNKS = [
  {
    id: 'chunk-004',
    content: `const router = express.Router();

/**
 * User routes for REST API
 */

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await UserService.getAll();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});`,
    source: 'src/routes/users.js',
    score: 0.94,
    timestamp: new Date('2024-01-15T10:05:00.000Z'),
    lineRange: { start: 5, end: 20 },
    metadata: { language: 'javascript' },
  },
  {
    id: 'chunk-005',
    content: `// Get user by ID
router.get('/users/:id', validateRequest, async (req, res) => {
  try {
    const user = await UserService.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});`,
    source: 'src/routes/users.js',
    score: 0.89,
    timestamp: new Date('2024-01-15T10:05:00.000Z'),
    lineRange: { start: 22, end: 35 },
    metadata: { language: 'javascript' },
  },
];

/**
 * Mock RAG search result for "user routes" query
 */
export const MOCK_ROUTES_SEARCH_RESULT = {
  query: 'user routes',
  chunks: MOCK_ROUTES_SEARCH_CHUNKS,
  totalMatches: 2,
  searchTimeMs: 32,
};

// ============================================================================
// Mock Sync Results
// ============================================================================

/**
 * Mock sync result after initial indexing
 */
export const MOCK_INITIAL_SYNC_RESULT = {
  added: 15,
  updated: 0,
  deleted: 0,
  unchanged: 0,
  totalChunks: 120,
  durationMs: 2500,
};

/**
 * Mock sync result after incremental update
 */
export const MOCK_INCREMENTAL_SYNC_RESULT = {
  added: 2,
  updated: 3,
  deleted: 1,
  unchanged: 9,
  totalChunks: 125,
  durationMs: 800,
};

// ============================================================================
// Mock Gemini API Responses
// ============================================================================

/**
 * Mock Gemini embedding response
 */
export const MOCK_GEMINI_EMBEDDING_RESPONSE = {
  embedding: {
    values: new Array(768).fill(0).map(() => Math.random() * 2 - 1),
  },
};

/**
 * Mock Gemini corpus create response
 */
export const MOCK_GEMINI_CORPUS_CREATE = {
  name: 'corpora/test-store-001',
  displayName: 'Test Store',
  createTime: '2024-01-15T10:00:00.000Z',
  updateTime: '2024-01-15T10:00:00.000Z',
};

/**
 * Mock Gemini document create response
 */
export const MOCK_GEMINI_DOCUMENT_CREATE = {
  name: 'corpora/test-store-001/documents/doc-001',
  displayName: 'src/services/auth.ts',
  createTime: '2024-01-15T10:05:00.000Z',
  updateTime: '2024-01-15T10:05:00.000Z',
};

/**
 * Mock Gemini chunk create response
 */
export const MOCK_GEMINI_CHUNK_CREATE = {
  name: 'corpora/test-store-001/documents/doc-001/chunks/chunk-001',
  data: {
    stringValue: 'export class AuthService...',
  },
  createTime: '2024-01-15T10:05:00.000Z',
  updateTime: '2024-01-15T10:05:00.000Z',
  state: 'STATE_ACTIVE',
};

/**
 * Mock Gemini query response
 */
export const MOCK_GEMINI_QUERY_RESPONSE = {
  relevantChunks: [
    {
      chunk: {
        name: 'corpora/test-store-001/documents/doc-001/chunks/chunk-001',
        data: {
          stringValue: MOCK_AUTH_SEARCH_CHUNKS[0].content,
        },
        customMetadata: [
          { key: 'filePath', stringValue: 'src/services/auth.ts' },
          { key: 'startLine', numericValue: 15 },
          { key: 'endLine', numericValue: 35 },
        ],
      },
      chunkRelevanceScore: 0.92,
    },
    {
      chunk: {
        name: 'corpora/test-store-001/documents/doc-002/chunks/chunk-002',
        data: {
          stringValue: MOCK_AUTH_SEARCH_CHUNKS[1].content,
        },
        customMetadata: [
          { key: 'filePath', stringValue: 'docs/authentication.md' },
          { key: 'startLine', numericValue: 1 },
          { key: 'endLine', numericValue: 15 },
        ],
      },
      chunkRelevanceScore: 0.88,
    },
  ],
};

// ============================================================================
// Mock Project Configuration
// ============================================================================

/**
 * Mock .wundr/rag-store.json configuration
 */
export const MOCK_RAG_STORE_CONFIG = {
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

/**
 * Mock .wundr/rag-exclude.txt content
 */
export const MOCK_RAG_EXCLUDE_TXT = `# RAG Indexing Exclusions
# Add file patterns to exclude from RAG indexing

# Build outputs
dist/
build/
.next/
out/

# Dependencies
node_modules/
vendor/

# Version control
.git/
.svn/

# Test files
*.test.ts
*.spec.ts
__tests__/

# Generated files
*.min.js
*.min.css
*.map

# Logs and temporary files
*.log
tmp/
.cache/

# Environment files with secrets
.env
.env.local
.env.*.local
`;

// ============================================================================
// Error Fixtures for Error Debugger Tests
// ============================================================================

/**
 * Sample error message for debugging
 */
export const SAMPLE_TYPE_ERROR = `
TypeError: Cannot read properties of undefined (reading 'userId')
    at AuthService.authenticate (/app/src/services/auth.ts:25:42)
    at UserController.login (/app/src/controllers/user.ts:15:35)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
`;

/**
 * Sample runtime error for debugging
 */
export const SAMPLE_RUNTIME_ERROR = `
Error: Connection refused to database
    at DatabasePool.connect (/app/src/database/pool.ts:45:15)
    at DatabaseService.query (/app/src/services/database.ts:32:24)
    at UserRepository.findById (/app/src/repositories/user.ts:18:28)
    at async AuthService.authenticate (/app/src/services/auth.ts:30:20)
`;

/**
 * Sample validation error for debugging
 */
export const SAMPLE_VALIDATION_ERROR = `
ValidationError: Invalid email format
    at Validator.validateEmail (/app/src/utils/validators.ts:55:11)
    at UserService.createUser (/app/src/services/user.ts:42:18)
    at UserController.register (/app/src/controllers/user.ts:28:32)
`;

/**
 * Expected identifier extractions from errors
 */
export const EXPECTED_ERROR_IDENTIFIERS = {
  typeError: {
    functions: ['AuthService.authenticate', 'UserController.login'],
    files: ['src/services/auth.ts', 'src/controllers/user.ts'],
    properties: ['userId'],
    lineNumbers: [25, 15],
  },
  runtimeError: {
    functions: [
      'DatabasePool.connect',
      'DatabaseService.query',
      'UserRepository.findById',
      'AuthService.authenticate',
    ],
    files: [
      'src/database/pool.ts',
      'src/services/database.ts',
      'src/repositories/user.ts',
      'src/services/auth.ts',
    ],
    lineNumbers: [45, 32, 18, 30],
  },
  validationError: {
    functions: ['Validator.validateEmail', 'UserService.createUser', 'UserController.register'],
    files: ['src/utils/validators.ts', 'src/services/user.ts', 'src/controllers/user.ts'],
    lineNumbers: [55, 42, 28],
  },
};

// ============================================================================
// Hook Test Fixtures
// ============================================================================

/**
 * Sample request for context enhancement hook
 */
export const SAMPLE_HOOK_REQUEST = {
  type: 'codeGeneration',
  prompt: 'Add user authentication to the login endpoint',
  context: {
    currentFile: 'src/routes/auth.ts',
    projectRoot: '/app',
  },
};

/**
 * Expected enhanced request after hook processing
 */
export const EXPECTED_ENHANCED_REQUEST = {
  ...SAMPLE_HOOK_REQUEST,
  ragContext: {
    relevantFiles: ['src/services/auth.ts', 'docs/authentication.md'],
    codeSnippets: expect.any(Array),
    summary: expect.stringContaining('authentication'),
  },
};

/**
 * Sample hook configuration
 */
export const SAMPLE_HOOK_CONFIG = {
  enabled: true,
  triggerPatterns: ['auth', 'login', 'authentication', 'user'],
  maxContextTokens: 4000,
  minRelevanceScore: 0.5,
};

// ============================================================================
// Helper Functions for Tests
// ============================================================================

/**
 * Create a mock RAG service for testing
 */
export function createMockRAGService() {
  return {
    search: jest.fn().mockResolvedValue(MOCK_AUTH_SEARCH_RESULT),
    searchMultiple: jest.fn().mockResolvedValue([MOCK_AUTH_SEARCH_RESULT, MOCK_ROUTES_SEARCH_RESULT]),
    indexDirectory: jest.fn().mockResolvedValue(undefined),
    isIndexed: jest.fn().mockResolvedValue(true),
    createStore: jest.fn().mockResolvedValue(MOCK_RAG_STORE),
    listStores: jest.fn().mockResolvedValue([MOCK_RAG_STORE]),
    getStore: jest.fn().mockResolvedValue(MOCK_RAG_STORE),
    deleteStore: jest.fn().mockResolvedValue(true),
    syncStore: jest.fn().mockResolvedValue(MOCK_INCREMENTAL_SYNC_RESULT),
    getStoreStatus: jest.fn().mockResolvedValue({
      ...MOCK_RAG_STORE,
      health: { status: 'healthy', checks: [], lastCheckedAt: new Date().toISOString() },
    }),
  };
}

/**
 * Create a mock file system for RAG tests
 */
export function createMockFileSystem() {
  const files = new Map<string, string>([
    ['src/services/auth.ts', SAMPLE_TS_FILE],
    ['src/routes/users.js', SAMPLE_JS_FILE],
    ['docs/authentication.md', SAMPLE_MD_FILE],
    ['config/app.json', SAMPLE_JSON_FILE],
  ]);

  return {
    existsSync: jest.fn((path: string) => files.has(path) || path.endsWith('.wundr')),
    readFileSync: jest.fn((path: string) => {
      if (files.has(path)) {
        return files.get(path);
      }
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }),
    writeFileSync: jest.fn((path: string, content: string) => {
      files.set(path, content);
    }),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn((dir: string) => {
      const entries: string[] = [];
      for (const filePath of files.keys()) {
        if (filePath.startsWith(dir)) {
          const relativePath = filePath.slice(dir.length + 1);
          const firstPart = relativePath.split('/')[0];
          if (firstPart && !entries.includes(firstPart)) {
            entries.push(firstPart);
          }
        }
      }
      return entries;
    }),
    statSync: jest.fn((path: string) => ({
      isDirectory: () => !path.includes('.'),
      isFile: () => path.includes('.'),
      size: files.get(path)?.length ?? 0,
      mtime: new Date(),
    })),
    unlinkSync: jest.fn((path: string) => {
      files.delete(path);
    }),
    rmSync: jest.fn(),
    copyFileSync: jest.fn(),
    appendFileSync: jest.fn(),
    files,
  };
}

/**
 * Create a temporary project structure for integration tests
 */
export function getTestProjectFiles(): Record<string, string> {
  return {
    'src/services/auth.ts': SAMPLE_TS_FILE,
    'src/routes/users.js': SAMPLE_JS_FILE,
    'docs/authentication.md': SAMPLE_MD_FILE,
    'config/app.json': SAMPLE_JSON_FILE,
    '.wundr/rag-store.json': JSON.stringify(MOCK_RAG_STORE_CONFIG, null, 2),
    '.wundr/rag-exclude.txt': MOCK_RAG_EXCLUDE_TXT,
  };
}
