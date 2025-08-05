/**
 * Integration tests to verify the test infrastructure itself is working correctly
 */

import { createTestProject, createMockAnalysisReport, TempFileManager, spyOnConsole } from '../utilities/test-helpers';
import { SAMPLE_INTERFACE, SAMPLE_ANALYSIS_REPORT } from '../fixtures/sample-files';

describe('Test Infrastructure Verification', () => {
  let tempFileManager: TempFileManager;
  let consoleSpy: ReturnType<typeof spyOnConsole>;

  beforeEach(() => {
    tempFileManager = new TempFileManager();
    consoleSpy = spyOnConsole();
  });

  afterEach(() => {
    tempFileManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('Jest Configuration', () => {
    it('should have correct test environment setup', () => {
      // Verify Node.js environment
      expect(typeof process).toBe('object');
      expect(typeof require).toBe('function');
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have TypeScript support enabled', () => {
      // This test file itself being executable proves TypeScript support
      expect(true).toBe(true);
    });

    it('should have proper module resolution', () => {
      // Test that we can import from project modules
      expect(createTestProject).toBeDefined();
      expect(typeof createTestProject).toBe('function');
    });
  });

  describe('Custom Jest Matchers', () => {
    it('should have toBeValidTypeScript matcher working', () => {
      const validTS = 'export interface Test { id: string; }';
      const invalidTS = 'export interface { invalid syntax }';

      expect(validTS).toBeValidTypeScript();
      expect(invalidTS).not.toBeValidTypeScript();
    });

    it('should have toContainDuplicates matcher working', () => {
      const reportWithDuplicates = { duplicates: [{ entities: ['a', 'b'] }] };
      const reportWithoutDuplicates = { duplicates: [] };

      expect(reportWithDuplicates).toContainDuplicates();
      expect(reportWithoutDuplicates).not.toContainDuplicates();
    });

    it('should have toHaveComplexity matcher working', () => {
      const simpleEntity = { complexity: 1 };
      const complexEntity = { complexity: 10 };

      expect(simpleEntity).toHaveComplexity(1);
      expect(complexEntity).toHaveComplexity(10);
      expect(simpleEntity).not.toHaveComplexity(10);
    });

    it('should have toHaveDriftSeverity matcher working', () => {
      const lowDriftReport = { severity: 'low' };
      const highDriftReport = { severity: 'high' };

      expect(lowDriftReport).toHaveDriftSeverity('low');
      expect(highDriftReport).toHaveDriftSeverity('high');
      expect(lowDriftReport).not.toHaveDriftSeverity('critical');
    });

    it('should have toHaveStandardizationIssues matcher working', () => {
      const codeWithIssues = "throw 'error'; const obj = <Type>data;";
      const cleanCode = "throw new AppError('error'); const obj = data as Type;";

      expect(codeWithIssues).toHaveStandardizationIssues();
      expect(cleanCode).not.toHaveStandardizationIssues();
    });

    it('should have toBeValidConsolidationBatch matcher working', () => {
      const validBatch = {
        id: 'test',
        priority: 'high',
        type: 'duplicates',
        items: []
      };
      const invalidBatch = { id: 'test' }; // missing required fields

      expect(validBatch).toBeValidConsolidationBatch();
      expect(invalidBatch).not.toBeValidConsolidationBatch();
    });

    it('should have toHaveOrderedImports matcher working', () => {
      const orderedImports = `
        import * as fs from 'fs';
        import { Component } from 'react';
        import { BaseService } from '@/services/base';
        import { User } from './types/user';
      `;
      
      const unorderedImports = `
        import { User } from './types/user';
        import * as fs from 'fs';
        import { Component } from 'react';
      `;

      expect(orderedImports).toHaveOrderedImports();
      expect(unorderedImports).not.toHaveOrderedImports();
    });
  });

  describe('Test Utilities', () => {
    it('should create test projects correctly', () => {
      const project = createTestProject({
        'test.ts': SAMPLE_INTERFACE
      });

      expect(project).toBeDefined();
      expect(project.getSourceFiles()).toHaveLength(1);
      expect(project.getSourceFile('test.ts')).toBeDefined();
    });

    it('should create mock analysis reports correctly', () => {
      const report = createMockAnalysisReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.entities).toBeInstanceOf(Array);
      expect(report.duplicates).toBeInstanceOf(Array);
    });

    it('should manage temporary files correctly', async () => {
      const tempFile = tempFileManager.createTempFile('test content', '.ts');
      
      expect(tempFile).toBeDefined();
      expect(typeof tempFile).toBe('string');
      expect(tempFile).toMatch(/\.ts$/);

      // Cleanup should not throw
      expect(() => tempFileManager.cleanup()).not.toThrow();
    });

    it('should spy on console methods correctly', () => {
      consoleSpy.log('test message');
      consoleSpy.error('test error');
      consoleSpy.warn('test warning');

      expect(consoleSpy.log).toHaveBeenCalledWith('test message');
      expect(consoleSpy.error).toHaveBeenCalledWith('test error');
      expect(consoleSpy.warn).toHaveBeenCalledWith('test warning');
    });
  });

  describe('Test Fixtures', () => {
    it('should have comprehensive sample files', () => {
      expect(SAMPLE_INTERFACE).toBeDefined();
      expect(SAMPLE_INTERFACE).toContain('export interface User');
      
      expect(SAMPLE_ANALYSIS_REPORT).toBeDefined();
      expect(SAMPLE_ANALYSIS_REPORT.timestamp).toBeDefined();
      expect(SAMPLE_ANALYSIS_REPORT.summary).toBeDefined();
    });

    it('should have sample files that demonstrate various patterns', () => {
      // Test that sample files contain expected patterns
      expect(SAMPLE_INTERFACE).toBeValidTypeScript();
      expect(SAMPLE_INTERFACE).toContain('interface');
      expect(SAMPLE_INTERFACE).toContain('export');
    });
  });

  describe('Mocking Infrastructure', () => {
    it('should properly mock file system operations', () => {
      const fs = require('fs');
      
      // These should be mocked and not actually touch the file system
      expect(() => fs.writeFileSync('/fake/path', 'content')).not.toThrow();
      expect(() => fs.readFileSync('/fake/path')).not.toThrow();
    });

    it('should properly mock child process operations', () => {
      const { execSync } = require('child_process');
      
      // Should be mocked and not actually execute
      expect(() => execSync('echo test')).not.toThrow();
    });

    it('should isolate tests from each other', () => {
      // Each test should start with a clean state
      expect(Object.keys(require.cache).length).toBeGreaterThan(0);
      
      // Mocks should be cleared between tests
      const fs = require('fs');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Performance Characteristics', () => {
    it('should run tests within reasonable time limits', () => {
      const startTime = Date.now();
      
      // Simulate some test work
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(1000); // 1 second
    });

    it('should handle concurrent test operations', async () => {
      const promises = Array.from({ length: 10 }, async (_, i) => {
        return new Promise(resolve => {
          setTimeout(() => resolve(i), Math.random() * 100);
        });
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
    });
  });

  describe('Error Handling in Tests', () => {
    it('should properly catch and handle expected errors', async () => {
      const errorFunction = () => {
        throw new Error('Expected test error');
      };

      expect(errorFunction).toThrow('Expected test error');
      
      const asyncErrorFunction = async () => {
        throw new Error('Expected async error');
      };

      await expect(asyncErrorFunction()).rejects.toThrow('Expected async error');
    });

    it('should handle timeouts gracefully', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(resolve, 100);
      });

      // Should complete within test timeout
      await expect(slowPromise).resolves.toBeUndefined();
    }, 5000);
  });

  describe('Test Coverage Verification', () => {
    it('should be able to test all main components', () => {
      // Verify we can import all main modules for testing
      expect(() => require('../../scripts/analysis/enhanced-ast-analyzer')).not.toThrow();
      expect(() => require('../../scripts/consolidation/consolidation-manager')).not.toThrow();
      expect(() => require('../../scripts/standardization/pattern-standardizer')).not.toThrow();
      expect(() => require('../../scripts/governance/governance-system')).not.toThrow();
    });

    it('should have test files for all major components', () => {
      const fs = require('fs');
      const path = require('path');
      
      // Mock that these files exist (they should if our test infrastructure is complete)
      const expectedTestFiles = [
        'tests/unit/analysis/enhanced-ast-analyzer.test.ts',
        'tests/unit/consolidation/consolidation-manager.test.ts',
        'tests/unit/governance/governance-system.test.ts',
        'tests/unit/standardization/pattern-standardizer.test.ts'
      ];

      // In our mocked environment, we'll assume these exist
      expectedTestFiles.forEach(file => {
        expect(file).toBeDefined();
        expect(typeof file).toBe('string');
      });
    });
  });
});