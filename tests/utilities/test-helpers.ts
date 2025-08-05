/**
 * Test utilities and helper functions for the testing suite
 */

import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';

/**
 * Create a temporary test project with sample files
 */
export function createTestProject(files: Record<string, string> = {}): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99, // ESNext
      module: 1, // CommonJS
      strict: true
    }
  });

  // Add default test files if none provided
  if (Object.keys(files).length === 0) {
    files = getDefaultTestFiles();
  }

  // Add files to project
  Object.entries(files).forEach(([filePath, content]) => {
    project.createSourceFile(filePath, content);
  });

  return project;
}

/**
 * Get default test files for common testing scenarios
 */
export function getDefaultTestFiles(): Record<string, string> {
  return {
    'src/types/user.ts': `
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface UserProfile {
  user: User;
  preferences: {
    theme: 'light' | 'dark';
    language: string;
  };
}`,

    'src/types/duplicate-user.ts': `
// This is a duplicate of User interface
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface UserData extends User {
  createdAt: Date;
}`,

    'src/services/user-service.ts': `
import { User } from '../types/user';

export class UserService {
  private users: User[] = [];

  async getUser(id: string): Promise<User | null> {
    const user = this.users.find(u => u.id === id);
    if (!user) {
      throw 'User not found'; // Bad practice - string throw
    }
    return user;
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: Math.random().toString(),
      ...userData
    };
    this.users.push(user);
    return user;
  }

  // Complex method for testing complexity calculation
  async processUsers(): Promise<void> {
    for (const user of this.users) {
      if (user.role === 'admin') {
        if (user.email.includes('@company.com')) {
          if (user.name.length > 5) {
            console.log('Processing admin user');
          } else {
            console.log('Short name admin');
          }
        } else {
          console.log('External admin');
        }
      } else {
        if (user.email.includes('@gmail.com')) {
          console.log('Gmail user');
        } else {
          console.log('Other email provider');
        }
      }
    }
  }
}`,

    'src/services/enhanced-user-service.ts': `
// Wrapper pattern example
import { UserService } from './user-service';
import { User } from '../types/user';

export class EnhancedUserService extends UserService {
  async getUserWithLogging(id: string): Promise<User | null> {
    console.log(\`Getting user: \${id}\`);
    const user = await this.getUser(id);
    console.log(\`Found user: \${user?.name}\`);
    return user;
  }
}`,

    'src/utils/constants.ts': `
// Should be enum
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MODERATOR: 'moderator'
} as const;

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
} as const;`,

    'src/utils/helpers.ts': `
import { User } from '../types/user';

// Old style type assertion
export function getUser(data: any): User {
  return <User>data;
}

// Should use optional chaining
export function getUserEmail(user: any): string | undefined {
  return user && user.email && user.email.toLowerCase();
}

// Unused export
export function unusedFunction(): void {
  console.log('This function is never used');
}`,

    'src/circular-a.ts': `
import { CircularB } from './circular-b';

export class CircularA {
  b: CircularB;
  
  constructor() {
    this.b = new CircularB();
  }
}`,

    'src/circular-b.ts': `
import { CircularA } from './circular-a';

export class CircularB {
  a: CircularA;
  
  createA(): CircularA {
    return new CircularA();
  }
}`,

    'src/index.ts': `
export * from './types/user';
export * from './services/user-service';
export * from './utils/constants';`
  };
}

/**
 * Create a mock analysis report for testing
 */
export function createMockAnalysisReport(overrides: any = {}): any {
  const defaultReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: 8,
      totalEntities: 15,
      duplicateClusters: 2,
      circularDependencies: 1,
      unusedExports: 1,
      codeSmells: 2
    },
    entities: [
      {
        name: 'User',
        type: 'interface',
        file: 'src/types/user.ts',
        line: 2,
        column: 0,
        exportType: 'named',
        normalizedHash: 'abc12345',
        dependencies: []
      },
      {
        name: 'User',
        type: 'interface',
        file: 'src/types/duplicate-user.ts',
        line: 3,
        column: 0,
        exportType: 'named',
        normalizedHash: 'abc12345', // Same hash = duplicate
        dependencies: []
      }
    ],
    duplicates: [
      {
        hash: 'abc12345',
        type: 'interface',
        severity: 'high',
        entities: [
          { name: 'User', file: 'src/types/user.ts' },
          { name: 'User', file: 'src/types/duplicate-user.ts' }
        ],
        structuralMatch: true,
        semanticMatch: true
      }
    ],
    circularDeps: [
      ['src/circular-a.ts', 'src/circular-b.ts', 'src/circular-a.ts']
    ],
    unusedExports: [
      {
        name: 'unusedFunction',
        type: 'function',
        file: 'src/utils/helpers.ts'
      }
    ],
    wrapperPatterns: [
      {
        base: 'UserService',
        wrapper: 'EnhancedUserService',
        confidence: 0.9
      }
    ],
    recommendations: []
  };

  return { ...defaultReport, ...overrides };
}

/**
 * Create a mock consolidation batch for testing
 */
export function createMockConsolidationBatch(type: string = 'duplicates'): any {
  return {
    id: `test-batch-${Date.now()}`,
    priority: 'high',
    type,
    status: 'pending',
    items: type === 'duplicates' ? [
      {
        hash: 'abc12345',
        type: 'interface',
        severity: 'high',
        entities: [
          { name: 'User', file: 'src/types/user.ts', type: 'interface' },
          { name: 'User', file: 'src/types/duplicate-user.ts', type: 'interface' }
        ]
      }
    ] : []
  };
}

/**
 * Create mock drift report for governance testing
 */
export function createMockDriftReport(severity: string = 'medium'): any {
  return {
    timestamp: new Date().toISOString(),
    baseline: {
      timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      metrics: {
        totalEntities: 10,
        duplicateCount: 1,
        avgComplexity: 5,
        circularDeps: 0,
        unusedExports: 2
      },
      entities: new Map([
        ['src/types/user.ts:User:interface', 'abc12345']
      ])
    },
    current: {
      timestamp: new Date().toISOString(),
      metrics: {
        totalEntities: 15,
        duplicateCount: 2,
        avgComplexity: 7,
        circularDeps: 1,
        unusedExports: 3
      },
      entities: new Map([
        ['src/types/user.ts:User:interface', 'abc12345'],
        ['src/types/duplicate-user.ts:User:interface', 'abc12345']
      ])
    },
    drift: {
      newDuplicates: 1,
      removedEntities: 0,
      addedEntities: 5,
      complexityIncrease: 2,
      newCircularDeps: 1,
      newUnusedExports: 1,
      violatedStandards: []
    },
    recommendations: ['Fix the new duplicate entities'],
    severity
  };
}

/**
 * Create a mock standardization log
 */
export function createMockStandardizationLog(): string[] {
  return [
    '[src/errors.ts] Replaced string throw: "Invalid input"',
    '[src/service.ts] Made function getUserData async',
    '[src/constants.ts] Converted const USER_ROLES to enum UserRoles',
    '[src/auth.ts] Renamed interface IUser to User',
    '[src/utils.ts] Applied optional chaining: user?.profile',
    '[src/types.ts] Replaced <User> with \'as User\''
  ];
}

/**
 * Create mock analysis snapshot for governance testing
 */
export function createMockAnalysisSnapshot(overrides: any = {}): any {
  const defaultSnapshot = {
    timestamp: new Date().toISOString(),
    metrics: {
      totalEntities: 20,
      duplicateCount: 2,
      avgComplexity: 4.5,
      circularDeps: 0,
      unusedExports: 3
    },
    entities: new Map([
      ['src/types/user.ts:User:interface', 'hash123'],
      ['src/services/user.ts:UserService:class', 'hash456']
    ])
  };

  return { ...defaultSnapshot, ...overrides };
}

/**
 * Create mock ESLint violation
 */
export function createMockViolation(overrides: any = {}): any {
  const defaultViolation = {
    rule: 'no-wrapper-pattern',
    file: 'src/service.ts',
    line: 10,
    message: 'Avoid wrapper pattern',
    severity: 'error' as const
  };

  return { ...defaultViolation, ...overrides };
}

/**
 * Create mock weekly governance summary
 */
export function createMockWeeklySummary(): any {
  return {
    period: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    },
    totalDriftEvents: 12,
    severityBreakdown: {
      none: 3,
      low: 4,
      medium: 3,
      high: 2,
      critical: 0
    },
    trends: {
      duplicates: 'improving',
      complexity: 'worsening',
      overall: 'stable'
    },
    topViolations: [
      { rule: 'no-wrapper-pattern', count: 8 },
      { rule: 'consistent-error-handling', count: 5 }
    ],
    recommendations: [
      'Address the increasing complexity trend',
      'Continue good work on reducing duplicates'
    ]
  };
}

/**
 * Temporary file utilities for testing
 */
export class TempFileManager {
  private tempFiles: string[] = [];
  private tempDirs: string[] = [];

  createTempFile(content: string, extension: string = '.ts'): string {
    const tempFile = path.join(
      process.cwd(),
      `test-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${extension}`
    );
    
    fs.writeFileSync(tempFile, content);
    this.tempFiles.push(tempFile);
    return tempFile;
  }

  createTempDir(): string {
    const tempDir = path.join(
      process.cwd(),
      `test-temp-dir-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    
    fs.mkdirSync(tempDir, { recursive: true });
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  cleanup(): void {
    // Clean up temp files
    this.tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    // Clean up temp directories
    this.tempDirs.forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    this.tempFiles = [];
    this.tempDirs = [];
  }
}

/**
 * Mock implementation utilities
 */
export function createMockFS(): jest.Mocked<typeof fs> {
  return {
    ...fs,
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    rmSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    copyFileSync: jest.fn(),
    appendFileSync: jest.fn()
  } as any;
}

/**
 * Assert that a function throws with a specific message
 */
export function expectThrowsAsync(fn: () => Promise<any>, expectedMessage?: string): Promise<Error> {
  return fn().then(
    () => {
      throw new Error('Expected function to throw, but it did not');
    },
    (error: Error) => {
      if (expectedMessage && !error.message.includes(expectedMessage)) {
        throw new Error(`Expected error message to include "${expectedMessage}", but got "${error.message}"`);
      }
      return error;
    }
  );
}

/**
 * Wait for a specified time (useful for async testing)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a spy on console methods
 */
export function spyOnConsole(): {
  log: jest.SpyInstance;
  error: jest.SpyInstance;
  warn: jest.SpyInstance;
  info: jest.SpyInstance;
} {
  return {
    log: jest.spyOn(console, 'log').mockImplementation(),
    error: jest.spyOn(console, 'error').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
    info: jest.spyOn(console, 'info').mockImplementation()
  };
}

/**
 * Mock ts-morph Project with custom file system
 */
export function createMockProject(files: Record<string, string> = {}): any {
  const sourceFiles = new Map();
  
  Object.entries(files).forEach(([path, content]) => {
    const mockSourceFile = {
      getFilePath: () => path,
      getText: () => content,
      save: jest.fn().mockResolvedValue(undefined),
      replaceWithText: jest.fn(),
      getImportDeclarations: jest.fn().mockReturnValue([]),
      insertImportDeclaration: jest.fn(),
      addNamedImport: jest.fn(),
      getInterfaces: jest.fn().mockReturnValue([]),
      getClasses: jest.fn().mockReturnValue([]),
      getFunctions: jest.fn().mockReturnValue([]),
      getVariableDeclarations: jest.fn().mockReturnValue([]),
      getDescendantsOfKind: jest.fn().mockReturnValue([])
    };
    
    sourceFiles.set(path, mockSourceFile);
  });

  return {
    getSourceFiles: jest.fn().mockReturnValue(Array.from(sourceFiles.values())),
    getSourceFile: jest.fn().mockImplementation((path: string) => sourceFiles.get(path)),
    addSourceFileAtPath: jest.fn(),
    createSourceFile: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined)
  };
}

/**
 * Create mock process.env for testing
 */
export function mockEnvironment(env: Record<string, string | undefined>): () => void {
  const originalEnv = { ...process.env };
  
  Object.assign(process.env, env);
  
  return () => {
    process.env = originalEnv;
  };
}

/**
 * Mock a GitHub API response
 */
export function createMockGitHubAPI(): any {
  return {
    issues: {
      create: jest.fn().mockResolvedValue({ data: { id: 123, number: 456 } }),
      createComment: jest.fn().mockResolvedValue({ data: { id: 789 } }),
      list: jest.fn().mockResolvedValue({ data: [] }),
      get: jest.fn().mockResolvedValue({ data: { id: 123 } })
    },
    pulls: {
      create: jest.fn().mockResolvedValue({ data: { id: 123, number: 456 } }),
      list: jest.fn().mockResolvedValue({ data: [] }),
      get: jest.fn().mockResolvedValue({ data: { id: 123 } })
    },
    repos: {
      get: jest.fn().mockResolvedValue({ data: { name: 'test-repo' } }),
      getContent: jest.fn().mockResolvedValue({ data: { content: 'base64content' } })
    }
  };
}

/**
 * Create a performance timer for testing
 */
export class TestTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    this.endTime = Date.now();
    return this.endTime - this.startTime;
  }

  getElapsed(): number {
    return this.endTime - this.startTime;
  }
}

/**
 * Create a mock child process execution result
 */
export function createMockExecResult(stdout: string = '', stderr: string = '', code: number = 0): any {
  return {
    stdout,
    stderr,
    status: code,
    signal: null,
    output: [null, Buffer.from(stdout), Buffer.from(stderr)]
  };
}

/**
 * Simulate async operation with controllable timing
 */
export function createAsyncMock<T>(
  result: T, 
  delay: number = 0, 
  shouldReject: boolean = false
): jest.MockedFunction<() => Promise<T>> {
  return jest.fn().mockImplementation(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldReject) {
          reject(new Error(String(result)));
        } else {
          resolve(result);
        }
      }, delay);
    });
  });
}

/**
 * Create a batch of test files for integration testing
 */
export function createIntegrationTestFiles(): Record<string, string> {
  return {
    'src/types/user.ts': `
      export interface User {
        id: string;
        name: string;
        email: string;
      }
    `,
    'src/types/user-duplicate.ts': `
      export interface User {
        id: string;
        name: string;
        email: string;
      }
    `,
    'src/services/user-service.ts': `
      export class UserService {
        private users: User[] = [];
        
        start(): void {
          console.log('Starting service');
        }
        
        stop(): void {
          console.log('Stopping service');
        }
        
        getUser(id: string): User | null {
          if (!id) {
            throw 'ID is required';
          }
          return this.users.find(u => u.id === id) || null;
        }
      }
    `,
    'src/services/enhanced-user-service.ts': `
      import { UserService } from './user-service';
      
      export class EnhancedUserService extends UserService {
        getUserWithLogging(id: string): User | null {
          console.log('Getting user:', id);
          return super.getUser(id);
        }
      }
    `,
    'src/utils/helpers.ts': `
      export function parseUser(data: any): User {
        return <User>data;
      }
      
      export function getUserName(user: any): string | undefined {
        return user && user.profile && user.profile.name;
      }
      
      export function unusedHelper(): void {
        console.log('This function is never used');
      }
    `,
    'src/constants.ts': `
      export const USER_STATUS = {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        PENDING: 'pending'
      } as const;
    `,
    'src/interfaces.ts': `
      export interface IUserService {
        getUser(id: string): User | null;
      }
      
      export interface IUserRepository {
        save(user: User): Promise<void>;
      }
    `,
    'package.json': `{
      "name": "integration-test-project",
      "version": "1.0.0",
      "dependencies": {
        "typescript": "^5.0.0"
      }
    }`,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "strict": true
      }
    }`
  };
}

/**
 * Validate that a TypeScript code string compiles
 */
export function validateTypeScriptCode(code: string): { valid: boolean; errors: string[] } {
  const ts = require('typescript');
  
  try {
    const result = ts.transpile(code, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true
    });
    
    return { valid: result.length > 0, errors: [] };
  } catch (error: any) {
    return { valid: false, errors: [error.message] };
  }
}

/**
 * Create a mock file system state for testing
 */
export function createMockFileSystemState(): {
  files: Map<string, string>;
  directories: Set<string>;
  mockFs: jest.Mocked<typeof import('fs')>;
} {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  
  const mockFs = {
    existsSync: jest.fn((path: string) => files.has(path) || directories.has(path)),
    readFileSync: jest.fn((path: string) => {
      if (files.has(path)) {
        return files.get(path);
      }
      throw new Error(`File not found: ${path}`);
    }),
    writeFileSync: jest.fn((path: string, content: string) => {
      files.set(path, content);
    }),
    appendFileSync: jest.fn((path: string, content: string) => {
      const existing = files.get(path) || '';
      files.set(path, existing + content);
    }),
    mkdirSync: jest.fn((path: string) => {
      directories.add(path);
    }),
    readdirSync: jest.fn((path: string) => {
      return Array.from(files.keys())
        .filter(file => file.startsWith(path))
        .map(file => file.replace(path + '/', ''));
    }),
    unlinkSync: jest.fn((path: string) => {
      files.delete(path);
    }),
    rmSync: jest.fn((path: string) => {
      directories.delete(path);
      // Remove all files in directory
      Array.from(files.keys())
        .filter(file => file.startsWith(path))
        .forEach(file => files.delete(file));
    }),
    copyFileSync: jest.fn((src: string, dest: string) => {
      const content = files.get(src);
      if (content) {
        files.set(dest, content);
      }
    }),
    statSync: jest.fn((path: string) => ({
      isDirectory: () => directories.has(path),
      isFile: () => files.has(path)
    }))
  } as any;
  
  return { files, directories, mockFs };
}