import fs from 'fs-extra';
import path from 'path';
import { jest } from '@jest/globals';

// Setup global test environment
beforeAll(async () => {
  // Create temporary test directories
  const testDir = path.join(process.cwd(), '.test-tmp');
  await fs.ensureDir(testDir);
  process.env.WUNDR_TEST_DIR = testDir;

  // Mock console methods to avoid test output noise
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(async () => {
  // Cleanup test directories
  const testDir = process.env.WUNDR_TEST_DIR;
  if (testDir && await fs.pathExists(testDir)) {
    await fs.remove(testDir);
  }
});

// Mock external dependencies
jest.mock('inquirer');
jest.mock('blessed');
jest.mock('chokidar');
jest.mock('child_process');

// Extend Jest matchers for CLI testing
expect.extend({
  toBeValidCommand(received) {
    const pass = received && typeof received.name === 'function' && typeof received.description === 'function';
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid command`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid command`,
        pass: false,
      };
    }
  },
  
  toHaveExitCode(received, expected) {
    const pass = received === expected;
    if (pass) {
      return {
        message: () => `Expected exit code not to be ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected exit code ${expected} but received ${received}`,
        pass: false,
      };
    }
  }
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCommand(): R;
      toHaveExitCode(exitCode: number): R;
    }
  }
}