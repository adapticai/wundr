/**
 * @fileoverview Jest Test Setup
 * Global setup for all test files.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DAEMON_JWT_SECRET = 'test-jwt-secret';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console output in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
