/**
 * Test setup configuration
 */

import * as fs from 'fs-extra';

// Global test setup
beforeAll(async () => {
  // Ensure test directories exist
  const testDirs = [
    './test-sessions',
    './test-registry', 
    './test-models',
    './test-memory'
  ];

  for (const dir of testDirs) {
    await fs.ensureDir(dir);
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce logging during tests
});

// Global test cleanup
afterAll(async () => {
  // Cleanup test directories
  const testDirs = [
    './test-sessions',
    './test-registry',
    './test-models', 
    './test-memory',
    './coverage'
  ];

  for (const dir of testDirs) {
    try {
      await fs.remove(dir);
    } catch (error) {
      console.warn(`Failed to cleanup test directory ${dir}:`, error);
    }
  }
});

// Mock external dependencies that shouldn't be called during tests
jest.mock('sqlite3', () => ({
  Database: jest.fn().mockImplementation((path, callback) => {
    // Mock successful database connection
    if (callback) callback(null);
    
    return {
      serialize: jest.fn(fn => fn()),
      run: jest.fn((query, params, callback) => {
        if (typeof params === 'function') {
          params(null);
        } else if (callback) {
          callback(null);
        }
      }),
      all: jest.fn((query, params, callback) => {
        if (typeof params === 'function') {
          params(null, []);
        } else if (callback) {
          callback(null, []);
        }
      }),
      get: jest.fn((query, params, callback) => {
        if (typeof params === 'function') {
          params(null, null);
        } else if (callback) {
          callback(null, null);
        }
      }),
      close: jest.fn(callback => {
        if (callback) callback(null);
      })
    };
  })
}));

// Mock child_process for agent spawning
jest.mock('child_process', () => ({
  spawn: jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        // Simulate successful process completion
        setTimeout(() => callback(0), 10);
      }
    }),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() }
  }))
}));

// Mock Octokit for GitHub integration tests
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    users: {
      getAuthenticated: jest.fn().mockResolvedValue({
        data: { login: 'test-user' }
      })
    },
    pulls: {
      get: jest.fn().mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          changed_files: 5,
          additions: 100,
          deletions: 20
        }
      }),
      createReview: jest.fn().mockResolvedValue({
        data: { id: 456 }
      })
    }
  }))
}));

// Extend Jest matchers for better assertions
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  },

  toHaveValidAgentStructure(received: any) {
    const requiredFields = ['id', 'type', 'category', 'capabilities', 'status', 'metrics'];
    const hasAllFields = requiredFields.every(field => field in received);
    
    if (hasAllFields) {
      return {
        message: () => `expected agent not to have valid structure`,
        pass: true
      };
    } else {
      const missing = requiredFields.filter(field => !(field in received));
      return {
        message: () => `expected agent to have valid structure, missing: ${missing.join(', ')}`,
        pass: false
      };
    }
  }
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(60000);

export {};