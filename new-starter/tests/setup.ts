import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(30_000);

// Mock console methods in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Clean up after tests
afterAll(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});