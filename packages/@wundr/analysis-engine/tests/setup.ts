/**
 * Test setup for Analysis Engine
 */

import * as fs from 'fs-extra';
import * as path from 'path';

// Setup test environment
beforeAll(async () => {
  // Create test output directory
  const testOutputDir = path.join(__dirname, '../test-output');
  await fs.ensureDir(testOutputDir);
});

// Cleanup after tests
afterAll(async () => {
  // Optional: clean up test files
  // const testOutputDir = path.join(__dirname, '../test-output');
  // await fs.remove(testOutputDir);
});

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Mock console methods for cleaner test output
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

// Global test utilities
(global as any).testUtils = {
  createTempFile: async (content: string, extension = '.ts'): Promise<string> => {
    const tempDir = path.join(__dirname, '../test-output/temp');
    await fs.ensureDir(tempDir);
    
    const fileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${extension}`;
    const filePath = path.join(tempDir, fileName);
    
    await fs.writeFile(filePath, content);
    return filePath;
  },

  createTestProject: async (files: Record<string, string>): Promise<string> => {
    const projectDir = path.join(__dirname, `../test-output/project-${Date.now()}`);
    await fs.ensureDir(projectDir);
    
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(projectDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
    
    return projectDir;
  }
};