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
      toHaveDriftSeverity(expected: string): R;
      toHaveStandardizationIssues(): R;
      toBeValidConsolidationBatch(): R;
      toHaveOrderedImports(): R;
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
  },

  /**
   * Check if a drift report has expected severity
   */
  toHaveDriftSeverity(received: any, expected: string) {
    const actualSeverity = received.severity;
    const pass = actualSeverity === expected;
    
    return {
      message: () => pass
        ? `Expected drift severity not to be ${expected}`
        : `Expected drift severity ${expected} but got ${actualSeverity}`,
      pass
    };
  },

  /**
   * Check if code contains pattern standardization issues
   */
  toHaveStandardizationIssues(received: string) {
    const issues = [
      received.includes("throw '"), // String throws
      received.includes("throw \""), // String throws
      received.includes('.then('), // Promise chains
      received.includes('<') && received.includes('> '), // Type assertions
      received.includes(' && ') && received.includes('.'), // Null checks without optional chaining
      /^export const [A-Z_]+ = \{/.test(received), // Enum candidates
      /^export interface I[A-Z]/.test(received) // Interface with I prefix
    ];
    
    const hasIssues = issues.some(issue => issue);
    
    return {
      message: () => hasIssues
        ? `Expected code not to have standardization issues`
        : `Expected code to have standardization issues`,
      pass: hasIssues
    };
  },

  /**
   * Check if a consolidation batch is valid
   */
  toBeValidConsolidationBatch(received: any) {
    const requiredFields = ['id', 'priority', 'type', 'items'];
    const hasRequiredFields = requiredFields.every(field => field in received);
    const validPriority = ['critical', 'high', 'medium', 'low'].includes(received.priority);
    const validType = ['duplicates', 'unused-exports', 'wrapper-patterns', 'mixed'].includes(received.type);
    const hasItems = Array.isArray(received.items);
    
    const isValid = hasRequiredFields && validPriority && validType && hasItems;
    
    return {
      message: () => isValid
        ? `Expected batch not to be valid`
        : `Expected batch to be valid (missing: ${requiredFields.filter(f => !(f in received)).join(', ')})`,
      pass: isValid
    };
  },

  /**
   * Check if imports are properly ordered
   */
  toHaveOrderedImports(received: string) {
    const importLines = received.split('\\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length === 0) return { message: () => 'No imports found', pass: true };
    
    const nodeImports = importLines.filter(line => 
      line.includes("from 'fs'") || 
      line.includes("from 'path'") || 
      line.includes("from 'crypto'") ||
      line.includes('from "fs"') || 
      line.includes('from "path"') || 
      line.includes('from "crypto"')
    );
    
    const externalImports = importLines.filter(line => 
      !line.includes("from './") && 
      !line.includes("from '../") && 
      !line.includes("from '@/") &&
      !nodeImports.includes(line)
    );
    
    const internalImports = importLines.filter(line => line.includes("from '@/"));
    const relativeImports = importLines.filter(line => 
      line.includes("from './") || line.includes("from '../")
    );
    
    // Check if groups are in correct order
    const expectedOrder = [...nodeImports, ...externalImports, ...internalImports, ...relativeImports];
    const actualOrder = importLines;
    
    const isOrdered = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);
    
    return {
      message: () => isOrdered
        ? `Expected imports not to be ordered`
        : `Expected imports to be ordered (node, external, internal, relative)`,
      pass: isOrdered
    };
  }
});

// Environment setup
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Note: fs operations are mocked at the module level in individual test files when needed

export {};