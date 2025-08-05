// Jest setup file for global configuration and utilities

import * as fs from 'fs';
import * as path from 'path';
import { beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods for cleaner test output
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset modules to ensure clean state
  jest.resetModules();
});

afterEach(() => {
  // Clean up any test files that might have been created
  cleanupTestFiles();
});

/**
 * Clean up any temporary files created during tests
 */
function cleanupTestFiles() {
  const testDirs = [
    './test-output',
    './analysis-output',
    './.governance',
    './consolidation.log',
    './consolidation-state.json',
    './standardization-log.md',
    './manual-review-required.md'
  ];

  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      try {
        if (fs.statSync(dir).isDirectory()) {
          fs.rmSync(dir, { recursive: true, force: true });
        } else {
          fs.unlinkSync(dir);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
}

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTypeScript(): R;
      toContainDuplicates(): R;
      toHaveComplexity(expected: number): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  /**
   * Check if a string contains valid TypeScript code
   */
  toBeValidTypeScript(received: string) {
    const ts = require('typescript');
    
    try {
      const result = ts.transpile(received, {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS
      });
      
      return {
        message: () => `Expected code to be valid TypeScript`,
        pass: result.length > 0
      };
    } catch (error) {
      return {
        message: () => `Expected code to be valid TypeScript but got error: ${error.message}`,
        pass: false
      };
    }
  },

  /**
   * Check if an analysis report contains duplicates
   */
  toContainDuplicates(received: any) {
    const hasDuplicates = received.duplicates && received.duplicates.length > 0;
    
    return {
      message: () => hasDuplicates 
        ? `Expected report not to contain duplicates`
        : `Expected report to contain duplicates`,
      pass: hasDuplicates
    };
  },

  /**
   * Check if an entity has expected complexity
   */
  toHaveComplexity(received: any, expected: number) {
    const actualComplexity = received.complexity || 0;
    const pass = actualComplexity === expected;
    
    return {
      message: () => pass
        ? `Expected complexity not to be ${expected}`
        : `Expected complexity ${expected} but got ${actualComplexity}`,
      pass
    };
  }
});

// Environment setup
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Disable actual file system operations in tests unless explicitly enabled
if (!process.env.ALLOW_FS_OPERATIONS) {
  // Mock fs operations that could be destructive
  const fsOperationsToMock = ['writeFileSync', 'unlinkSync', 'rmSync'];
  
  fsOperationsToMock.forEach(operation => {
    const original = fs[operation as keyof typeof fs];
    (fs as any)[operation] = jest.fn((...args: any[]) => {
      // Allow operations in test directories
      const filePath = args[0];
      if (typeof filePath === 'string' && 
          (filePath.includes('/test-') || filePath.includes('test.') || filePath.includes('.test'))) {
        return (original as any).apply(fs, args);
      }
      // Mock other operations
      return undefined;
    });
  });
}

export {};