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