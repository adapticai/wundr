import { jest } from '@jest/globals';

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

// Mock external dependencies
jest.mock('node-keytar', () => ({
  setPassword: jest.fn().mockResolvedValue(undefined),
  getPassword: jest.fn().mockResolvedValue(null),
  deletePassword: jest.fn().mockResolvedValue(undefined),
  findCredentials: jest.fn().mockResolvedValue([]),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ size: 1000, isDirectory: () => false, isFile: () => true }),
  unlink: jest.fn().mockResolvedValue(undefined),
  watch: jest.fn().mockReturnValue({ on: jest.fn(), close: jest.fn() }),
}));

// Set test environment
process.env.NODE_ENV = 'test';