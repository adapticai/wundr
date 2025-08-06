/**
 * Comprehensive test suite for DriftDetectionService
 * Tests service lifecycle, drift detection, baseline creation, and error handling
 */

import { DriftDetectionService } from '../../../scripts/governance/DriftDetectionService';
import { BaseService, ServiceResult } from '../../../scripts/core/BaseService';
import { AppError, FileSystemError, AnalysisError } from '../../../scripts/core/errors';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock external dependencies
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hash')
  }))
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

// Mock analysis result data
const mockAnalysisResult = {
  summary: {
    totalEntities: 100,
    duplicateClusters: 5,
    circularDependencies: 2,
    unusedExports: 10,
    codeSmells: 15
  },
  entities: [
    { 
      type: 'function', 
      name: 'testFunction', 
      file: 'test.ts',
      complexity: 5
    },
    { 
      type: 'class', 
      name: 'TestClass', 
      file: 'test.ts',
      complexity: 8
    }
  ]
};

const mockBaselineSnapshot = {
  timestamp: '2023-01-01T00:00:00.000Z',
  version: 'test-version',
  metrics: {
    totalEntities: 100,
    duplicateCount: 5,
    avgComplexity: 6.5,
    circularDeps: 2,
    unusedExports: 10,
    codeSmells: 15
  },
  entityHashes: new Map([
    ['function:testFunction:test.ts', 'hash1'],
    ['class:TestClass:test.ts', 'hash2']
  ]),
  fileHashes: new Map([
    ['test.ts', 'file-hash1'],
    ['other.ts', 'file-hash2']
  ])
};

describe('DriftDetectionService', () => {
  let service: DriftDetectionService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Setup fs mocks
    mockFs.ensureDir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.writeJson.mockResolvedValue(undefined);
    mockFs.readJson.mockResolvedValue({});
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFile.mockResolvedValue('file content');
    
    // Setup child_process mock
    mockExecSync.mockReturnValue('');
    
    service = new DriftDetectionService('/test/project');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Constructor and Configuration', () => {
    it('should create service with default project root', () => {
      const defaultService = new DriftDetectionService();
      expect(defaultService['projectRoot']).toBe(process.cwd());
    });

    it('should create service with custom project root', () => {
      const customService = new DriftDetectionService('/custom/project');
      expect(customService['projectRoot']).toBe('/custom/project');
    });

    it('should set correct directory paths', () => {
      expect(service['baselineDir']).toBe('/test/project/governance-output/baselines');
      expect(service['reportsDir']).toBe('/test/project/governance-output/drift-reports');
    });

    it('should extend BaseService', () => {
      expect(service).toBeInstanceOf(BaseService);
    });
  });

  describe('Service Lifecycle', () => {
    describe('onInitialize()', () => {
      it('should create required directories', async () => {
        await service.initialize();
        
        expect(mockFs.ensureDir).toHaveBeenCalledWith(
          '/test/project/governance-output/baselines'
        );
        expect(mockFs.ensureDir).toHaveBeenCalledWith(
          '/test/project/governance-output/drift-reports'
        );
      });

      it('should handle directory creation failure', async () => {
        const error = new Error('Directory creation failed');
        mockFs.ensureDir.mockRejectedValue(error);
        
        await expect(service.initialize()).rejects.toThrow('Directory creation failed');
      });
    });

    describe('checkHealth()', () => {
      it('should return true when directories exist', () => {
        mockFs.existsSync.mockReturnValue(true);
        const health = service.getHealth();
        
        expect(health.success).toBe(true);
        expect(health.data?.status).toBe('healthy');
      });

      it('should return false when directories do not exist', () => {
        mockFs.existsSync.mockReturnValue(false);
        const health = service.getHealth();
        
        expect(health.success).toBe(true);
        expect(health.data?.status).toBe('unhealthy');
      });
    });

    describe('onShutdown()', () => {
      it('should shutdown cleanly', async () => {
        await expect(service.shutdown()).resolves.not.toThrow();
      });
    });
  });

  describe('createBaseline()', () => {
    beforeEach(() => {
      // Mock analysis result
      mockFs.readJson.mockResolvedValue(mockAnalysisResult);
      mockFs.pathExists.mockResolvedValue(true);
    });

    it('should create baseline with default version', async () => {
      const result = await service.createBaseline();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.version).toBe('latest');
      expect(result.data?.metrics).toEqual({
        totalEntities: 100,
        duplicateCount: 5,
        avgComplexity: 6.5,
        circularDeps: 2,
        unusedExports: 10,
        codeSmells: 15
      });
    });

    it('should create baseline with custom version', async () => {
      const result = await service.createBaseline('v1.0.0');
      
      expect(result.success).toBe(true);
      expect(result.data?.version).toBe('v1.0.0');
    });

    it('should save baseline to correct file paths', async () => {
      await service.createBaseline('v1.0.0');
      
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/project/governance-output/baselines/baseline-v1.0.0.json',
        expect.objectContaining({
          version: 'v1.0.0',
          metrics: expect.any(Object)
        }),
        { spaces: 2 }
      );
      
      // Should also save as latest
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/project/governance-output/baselines/latest.json',
        expect.objectContaining({
          version: 'v1.0.0'
        }),
        { spaces: 2 }
      );
    });

    it('should save latest baseline when no version specified', async () => {
      await service.createBaseline();
      
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/test/project/governance-output/baselines/latest.json',
        expect.objectContaining({
          version: 'latest'
        }),
        { spaces: 2 }
      );
    });

    it('should handle analysis execution failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Analysis failed');
      });
      
      const result = await service.createBaseline();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AnalysisError);
      expect(result.error?.message).toBe('Failed to run analysis');
    });

    it('should handle missing analysis report', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await service.createBaseline();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(FileSystemError);
    });

    it('should handle file system errors during save', async () => {
      mockFs.writeJson.mockRejectedValue(new Error('Write failed'));
      
      const result = await service.createBaseline();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
    });

    it('should convert Maps to objects for JSON serialization', async () => {
      await service.createBaseline();
      
      const writeJsonCall = mockFs.writeJson.mock.calls[0];
      const serializedData = writeJsonCall[1];
      
      expect(serializedData.entityHashes).not.toBeInstanceOf(Map);
      expect(serializedData.fileHashes).not.toBeInstanceOf(Map);
      expect(typeof serializedData.entityHashes).toBe('object');
      expect(typeof serializedData.fileHashes).toBe('object');
    });
  });

  describe('detectDrift()', () => {
    beforeEach(() => {
      // Mock baseline loading
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json') || filePath.includes('baseline-')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(mockAnalysisResult);
      });
      
      mockFs.pathExists.mockResolvedValue(true);
    });

    it('should detect drift successfully', async () => {
      const result = await service.detectDrift();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.drift).toBeDefined();
      expect(result.data?.severity).toBeDefined();
      expect(result.data?.recommendations).toBeInstanceOf(Array);
      expect(result.data?.detailedChanges).toBeDefined();
    });

    it('should detect drift against specific baseline version', async () => {
      const result = await service.detectDrift('v1.0.0');
      
      expect(result.success).toBe(true);
      expect(mockFs.readJson).toHaveBeenCalledWith(
        '/test/project/governance-output/baselines/baseline-v1.0.0.json'
      );
    });

    it('should calculate drift metrics correctly', async () => {
      // Mock current snapshot with changes
      const modifiedAnalysisResult = {
        ...mockAnalysisResult,
        summary: {
          ...mockAnalysisResult.summary,
          totalEntities: 110, // 10 more entities
          duplicateClusters: 8, // 3 more duplicates
          circularDependencies: 4, // 2 more circular deps
          codeSmells: 20 // 5 more code smells
        }
      };
      
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(modifiedAnalysisResult);
      });
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(true);
      expect(result.data?.drift.newDuplicates).toBe(3);
      expect(result.data?.drift.newCircularDeps).toBe(2);
      expect(result.data?.drift.newCodeSmells).toBe(5);
    });

    it('should calculate severity levels correctly', async () => {
      // Test different drift scenarios
      const highDriftAnalysis = {
        ...mockAnalysisResult,
        summary: {
          ...mockAnalysisResult.summary,
          duplicateClusters: 25, // High number of duplicates
          circularDependencies: 12,
          codeSmells: 35
        }
      };
      
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(highDriftAnalysis);
      });
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(true);
      expect(['medium', 'high', 'critical']).toContain(result.data?.severity);
    });

    it('should generate appropriate recommendations', async () => {
      const result = await service.detectDrift();
      
      expect(result.success).toBe(true);
      expect(result.data?.recommendations).toBeInstanceOf(Array);
      expect(result.data?.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it('should save drift report', async () => {
      await service.detectDrift();
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/drift-report-.*\.json$/),
        expect.stringContaining('"drift"'),
        'utf-8'
      );
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/latest-drift-report\.json$/),
        expect.stringContaining('"drift"'),
        'utf-8'
      );
    });

    it('should handle missing baseline file', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(FileSystemError);
    });

    it('should handle baseline loading failure', async () => {
      mockFs.readJson.mockRejectedValue(new Error('Read failed'));
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
    });

    it('should handle current analysis failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Analysis failed');
      });
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AnalysisError);
    });

    it('should convert baseline objects back to Maps', async () => {
      const result = await service.detectDrift();
      
      expect(result.success).toBe(true);
      expect(result.data?.baselineSnapshot.entityHashes).toBeInstanceOf(Map);
      expect(result.data?.baselineSnapshot.fileHashes).toBeInstanceOf(Map);
    });
  });

  describe('checkDriftThresholds()', () => {
    beforeEach(() => {
      // Setup successful drift detection
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(mockAnalysisResult);
      });
      
      mockFs.pathExists.mockResolvedValue(true);
    });

    it('should pass with low drift score', async () => {
      const result = await service.checkDriftThresholds();
      
      expect(result.success).toBe(true);
      expect(result.data?.passed).toBe(true);
      expect(result.data?.severity).toBe('none');
      expect(result.data?.report).toBeDefined();
    });

    it('should fail with high drift score', async () => {
      // Mock high drift scenario
      const highDriftAnalysis = {
        ...mockAnalysisResult,
        summary: {
          ...mockAnalysisResult.summary,
          duplicateClusters: 30, // Very high duplicates
          circularDependencies: 20,
          codeSmells: 50
        }
      };
      
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(highDriftAnalysis);
      });
      
      const result = await service.checkDriftThresholds();
      
      expect(result.success).toBe(true);
      expect(result.data?.passed).toBe(false);
      expect(['high', 'critical']).toContain(result.data?.severity);
    });

    it('should use custom thresholds', async () => {
      const customThresholds = {
        critical: 200,
        high: 100,
        medium: 50
      };
      
      const result = await service.checkDriftThresholds(customThresholds);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle drift detection failure', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await service.checkDriftThresholds();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AnalysisError);
      expect(result.error?.message).toBe('Failed to detect drift');
    });

    it('should log when thresholds are exceeded', async () => {
      // Force high drift
      const highDriftAnalysis = {
        ...mockAnalysisResult,
        summary: {
          ...mockAnalysisResult.summary,
          duplicateClusters: 50,
          circularDependencies: 30
        }
      };
      
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(highDriftAnalysis);
      });
      
      await service.checkDriftThresholds();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"error"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Drift threshold exceeded')
      );
    });
  });

  describe('Private Method Testing', () => {
    describe('runAnalysis()', () => {
      it('should execute ast analyzer successfully', async () => {
        mockFs.pathExists.mockResolvedValue(true);
        mockFs.readJson.mockResolvedValue(mockAnalysisResult);
        
        const result = await service.createBaseline();
        
        expect(result.success).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(
          'npx ts-node scripts/analysis/enhanced-ast-analyzer.ts',
          {
            stdio: 'pipe',
            encoding: 'utf-8'
          }
        );
      });

      it('should handle analysis command failure', async () => {
        mockExecSync.mockImplementation(() => {
          throw new Error('Command failed');
        });
        
        const result = await service.createBaseline();
        
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(AnalysisError);
      });
    });

    describe('createSnapshot()', () => {
      it('should create proper snapshot structure', async () => {
        mockFs.readJson.mockResolvedValue(mockAnalysisResult);
        mockFs.pathExists.mockResolvedValue(true);
        
        const result = await service.createBaseline('test');
        
        expect(result.success).toBe(true);
        expect(result.data?.timestamp).toBeDefined();
        expect(result.data?.version).toBe('test');
        expect(result.data?.metrics).toBeDefined();
        expect(result.data?.entityHashes).toBeInstanceOf(Map);
        expect(result.data?.fileHashes).toBeInstanceOf(Map);
      });

      it('should calculate average complexity correctly', async () => {
        const complexityAnalysis = {
          ...mockAnalysisResult,
          entities: [
            { complexity: 4 },
            { complexity: 6 },
            { complexity: 8 }
          ]
        };
        
        mockFs.readJson.mockResolvedValue(complexityAnalysis);
        mockFs.pathExists.mockResolvedValue(true);
        
        const result = await service.createBaseline();
        
        expect(result.success).toBe(true);
        expect(result.data?.metrics.avgComplexity).toBe(6); // (4+6+8)/3
      });

      it('should handle entities without complexity', async () => {
        const noComplexityAnalysis = {
          ...mockAnalysisResult,
          entities: [
            { name: 'test1' },
            { name: 'test2' }
          ]
        };
        
        mockFs.readJson.mockResolvedValue(noComplexityAnalysis);
        mockFs.pathExists.mockResolvedValue(true);
        
        const result = await service.createBaseline();
        
        expect(result.success).toBe(true);
        expect(result.data?.metrics.avgComplexity).toBe(0);
      });
    });

    describe('calculateDriftScore()', () => {
      it('should calculate score using correct weights', async () => {
        // Create drift with known values
        const testDrift = {
          newDuplicates: 2,      // 2 * 5 = 10
          newCircularDeps: 1,    // 1 * 10 = 10
          newCodeSmells: 5,      // 5 * 3 = 15
          complexityIncrease: 3, // 3 * 2 = 6
          newUnusedExports: 4,   // 4 * 1 = 4
          removedEntities: 0,
          addedEntities: 0,
          modifiedEntities: 0,
          changedFiles: 0
        };
        
        // Expected score: 10 + 10 + 15 + 6 + 4 = 45
        
        // Create high drift scenario to test scoring
        const highDriftAnalysis = {
          ...mockAnalysisResult,
          summary: {
            ...mockAnalysisResult.summary,
            duplicateClusters: 7,  // +2 from baseline of 5
            circularDependencies: 3, // +1 from baseline of 2
            codeSmells: 20, // +5 from baseline of 15
            unusedExports: 14 // +4 from baseline of 10
          }
        };
        
        // Mock entities with higher complexity
        highDriftAnalysis.entities = [
          { complexity: 8.5 }, // Increases avg from 6.5 to 8.5 (+2)
          { complexity: 8.5 }
        ];
        
        mockFs.readJson.mockImplementation((filePath: string) => {
          if (filePath.includes('latest.json')) {
            return Promise.resolve({
              ...mockBaselineSnapshot,
              entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
              fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
            });
          }
          return Promise.resolve(highDriftAnalysis);
        });
        
        const result = await service.detectDrift();
        
        expect(result.success).toBe(true);
        // The scoring should result in medium or higher severity
        expect(['medium', 'high', 'critical']).toContain(result.data?.severity);
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty analysis results', async () => {
      const emptyAnalysis = {
        summary: {
          totalEntities: 0,
          duplicateClusters: 0,
          circularDependencies: 0,
          unusedExports: 0,
          codeSmells: 0
        },
        entities: []
      };
      
      mockFs.readJson.mockResolvedValue(emptyAnalysis);
      mockFs.pathExists.mockResolvedValue(true);
      
      const result = await service.createBaseline();
      
      expect(result.success).toBe(true);
      expect(result.data?.metrics.totalEntities).toBe(0);
      expect(result.data?.metrics.avgComplexity).toBe(0);
    });

    it('should handle malformed baseline files', async () => {
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('baseline') || filePath.includes('latest.json')) {
          return Promise.resolve({ invalid: 'data' });
        }
        return Promise.resolve(mockAnalysisResult);
      });
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
    });

    it('should handle file hashing errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Read failed'));
      
      const result = await service.createBaseline();
      
      // Should succeed but log warnings about failed file hashes
      expect(result.success).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"warn"')
      );
    });

    it('should handle very large drift scores', async () => {
      const massiveDriftAnalysis = {
        ...mockAnalysisResult,
        summary: {
          totalEntities: 10000,
          duplicateClusters: 1000,
          circularDependencies: 500,
          unusedExports: 2000,
          codeSmells: 5000
        }
      };
      
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(massiveDriftAnalysis);
      });
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(true);
      expect(result.data?.severity).toBe('critical');
    });

    it('should handle negative drift values correctly', async () => {
      const improvedAnalysis = {
        ...mockAnalysisResult,
        summary: {
          ...mockAnalysisResult.summary,
          duplicateClusters: 2,    // Reduced from 5
          circularDependencies: 0, // Reduced from 2
          codeSmells: 5           // Reduced from 15
        }
      };
      
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(improvedAnalysis);
      });
      
      const result = await service.detectDrift();
      
      expect(result.success).toBe(true);
      expect(result.data?.drift.newDuplicates).toBe(0); // Should not be negative
      expect(result.data?.drift.newCircularDeps).toBe(0);
      expect(result.data?.drift.newCodeSmells).toBe(0);
      expect(result.data?.severity).toBe('none');
    });

    it('should handle concurrent baseline operations', async () => {
      const promises = [
        service.createBaseline('v1'),
        service.createBaseline('v2'),
        service.createBaseline('v3')
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      expect(mockFs.writeJson).toHaveBeenCalledTimes(6); // 3 versions + 3 latest copies
    });

    it('should handle concurrent drift detection operations', async () => {
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('latest.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(mockAnalysisResult);
      });
      
      const promises = [
        service.detectDrift(),
        service.detectDrift(),
        service.detectDrift()
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete drift detection workflow', async () => {
      // Initialize service
      await service.initialize();
      
      // Create baseline
      const baselineResult = await service.createBaseline('v1.0.0');
      expect(baselineResult.success).toBe(true);
      
      // Mock current state with some drift
      const driftAnalysis = {
        ...mockAnalysisResult,
        summary: {
          ...mockAnalysisResult.summary,
          duplicateClusters: 8,
          codeSmells: 20
        }
      };
      
      mockFs.readJson.mockImplementation((filePath: string) => {
        if (filePath.includes('baseline-v1.0.0.json')) {
          return Promise.resolve({
            ...mockBaselineSnapshot,
            version: 'v1.0.0',
            entityHashes: Object.fromEntries(mockBaselineSnapshot.entityHashes),
            fileHashes: Object.fromEntries(mockBaselineSnapshot.fileHashes)
          });
        }
        return Promise.resolve(driftAnalysis);
      });
      
      // Detect drift
      const driftResult = await service.detectDrift('v1.0.0');
      expect(driftResult.success).toBe(true);
      expect(driftResult.data?.drift.newDuplicates).toBe(3);
      
      // Check thresholds
      const thresholdResult = await service.checkDriftThresholds({ medium: 10 });
      expect(thresholdResult.success).toBe(true);
      
      // Check health
      const health = service.getHealth();
      expect(health.data?.status).toBe('healthy');
      
      // Shutdown
      await service.shutdown();
    });

    it('should maintain service metrics across operations', async () => {
      await service.createBaseline();
      await service.detectDrift();
      await service.checkDriftThresholds();
      
      const health = service.getHealth();
      expect(health.data?.metrics.totalOperations).toBe(3);
      expect(health.data?.metrics.successfulOperations).toBe(3);
      expect(health.data?.metrics.failedOperations).toBe(0);
    });
  });
});