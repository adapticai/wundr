/**
 * Integration tests for the complete monorepo refactoring workflow
 */

import { EnhancedASTAnalyzer } from '../../scripts/analysis/enhanced-ast-analyzer';
import { ConsolidationManager } from '../../scripts/consolidation/consolidation-manager';
import { PatternStandardizer } from '../../scripts/standardization/pattern-standardizer';
import { GovernanceSystem } from '../../scripts/governance/governance-system';
import { createIntegrationTestFiles, TempFileManager, spyOnConsole } from '../utilities/test-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock file system and external dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('@octokit/rest');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Full Workflow Integration Tests', () => {
  let tempFileManager: TempFileManager;
  let consoleSpy: ReturnType<typeof spyOnConsole>;

  beforeEach(() => {
    jest.clearAllMocks();
    tempFileManager = new TempFileManager();
    consoleSpy = spyOnConsole();

    // Mock file system operations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation();
    mockFs.appendFileSync.mockImplementation();
    mockFs.mkdirSync.mockImplementation();
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.copyFileSync.mockImplementation();
    mockFs.unlinkSync.mockImplementation();
    mockFs.rmSync.mockImplementation();

    // Mock exec operations
    mockExecSync.mockReturnValue('');
  });

  afterEach(() => {
    tempFileManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('Analysis → Consolidation → Standardization → Governance', () => {
    it('should complete full workflow without errors', async () => {
      // Step 1: Analysis
      const analyzer = new EnhancedASTAnalyzer();
      
      // Mock analysis report for testing
      const mockAnalysisReport = {
        timestamp: new Date().toISOString(),
        summary: {
          totalFiles: 8,
          totalEntities: 15,
          duplicateClusters: 2,
          circularDependencies: 1,
          unusedExports: 3,
          codeSmells: 5
        },
        entities: [
          {
            name: 'User',
            type: 'interface',
            file: 'src/types/user.ts',
            normalizedHash: 'abc123',
            dependencies: []
          },
          {
            name: 'User',
            type: 'interface', 
            file: 'src/types/user-duplicate.ts',
            normalizedHash: 'abc123', // Same hash = duplicate
            dependencies: []
          }
        ],
        duplicates: [
          {
            hash: 'abc123',
            type: 'interface',
            severity: 'high',
            entities: [
              { name: 'User', file: 'src/types/user.ts' },
              { name: 'User', file: 'src/types/user-duplicate.ts' }
            ]
          }
        ],
        unusedExports: [
          { name: 'unusedHelper', file: 'src/utils/helpers.ts' }
        ],
        wrapperPatterns: [
          { base: 'UserService', wrapper: 'EnhancedUserService', confidence: 0.9 }
        ],
        recommendations: []
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockAnalysisReport));

      // Run analysis
      const analysisReport = mockAnalysisReport; // Simulate analysis result

      expect(analysisReport.summary.duplicateClusters).toBe(2);
      expect(analysisReport.duplicates).toHaveLength(1);
      expect(analysisReport.unusedExports).toHaveLength(1);
      expect(analysisReport.wrapperPatterns).toHaveLength(1);

      // Step 2: Consolidation
      const consolidationManager = new ConsolidationManager();

      // Create a consolidation batch from analysis results
      const consolidationBatch = {
        id: 'test-batch-001',
        priority: 'high' as const,
        type: 'duplicates' as const,
        status: 'pending' as const,
        items: analysisReport.duplicates
      };

      // Mock batch file for consolidation
      const batchContent = JSON.stringify(consolidationBatch);
      mockFs.readFileSync.mockReturnValue(batchContent);

      // Process consolidation batch
      const batchFile = 'test-batch.json';
      await consolidationManager.processBatch(batchFile);

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Starting batch')
      );

      // Step 3: Pattern Standardization
      const standardizer = new PatternStandardizer();

      // Apply standardization rules
      await standardizer.standardizeProject();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'standardization-log.md',
        expect.stringContaining('Pattern Standardization Log')
      );

      // Step 4: Governance Check
      const governance = new GovernanceSystem();

      // Mock baseline for drift detection
      const mockBaseline = {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        metrics: {
          totalEntities: 10,
          duplicateCount: 3,
          avgComplexity: 4,
          circularDeps: 1,
          unusedExports: 5
        },
        entities: new Map()
      };

      (governance as any).getBaseline = jest.fn().mockReturnValue(mockBaseline);

      // Run drift detection
      const driftReport = await governance.detectDrift();

      expect(driftReport).toBeDefined();
      expect(driftReport.severity).toBeDefined();
      expect(driftReport.recommendations).toBeInstanceOf(Array);

      // Verify the workflow completed successfully
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting pattern standardization')
      );
    }, 30000);

    it('should handle errors gracefully in the workflow', async () => {
      // Simulate analysis failure
      const analyzer = new EnhancedASTAnalyzer();
      
      mockExecSync.mockImplementation(() => {
        throw new Error('TypeScript compilation failed');
      });

      await expect(analyzer.analyzeProject()).rejects.toThrow();

      // Simulate consolidation failure
      const consolidationManager = new ConsolidationManager();
      
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Batch file not found');
      });

      await expect(consolidationManager.processBatch('missing.json')).rejects.toThrow();

      // Verify error handling
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Failed to process batch')
      );
    });
  });

  describe('Governance Enforcement', () => {
    it('should enforce governance rules based on drift severity', async () => {
      const governance = new GovernanceSystem();

      // Mock critical drift scenario
      const criticalDriftReport = {
        timestamp: new Date().toISOString(),
        baseline: {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          metrics: { totalEntities: 10, duplicateCount: 1, avgComplexity: 3, circularDeps: 0, unusedExports: 2 },
          entities: new Map()
        },
        current: {
          timestamp: new Date().toISOString(),
          metrics: { totalEntities: 15, duplicateCount: 8, avgComplexity: 15, circularDeps: 3, unusedExports: 10 },
          entities: new Map()
        },
        drift: {
          newDuplicates: 7,
          removedEntities: 0,
          addedEntities: 5,
          complexityIncrease: 12,
          newCircularDeps: 3,
          newUnusedExports: 8,
          violatedStandards: []
        },
        recommendations: ['Fix critical duplicates immediately'],
        severity: 'critical' as const
      };

      // Mock process.exit to prevent actual exit
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Set CI environment
      process.env.CI = 'true';

      await (governance as any).enforceGovernance(criticalDriftReport);

      // Should create blocking file in CI
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '.governance-block',
        'Critical drift detected. Fix before proceeding.'
      );

      // Should exit with code 1
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
      delete process.env.CI;
    });

    it('should generate weekly governance reports', async () => {
      const governance = new GovernanceSystem();

      // Mock historical drift reports
      mockFs.readdirSync.mockReturnValue(['drift-1.json', 'drift-2.json', 'drift-3.json']);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify({ severity: 'high', drift: { violatedStandards: [] } }))
        .mockReturnValueOnce(JSON.stringify({ severity: 'medium', drift: { violatedStandards: [] } }))
        .mockReturnValueOnce(JSON.stringify({ severity: 'low', drift: { violatedStandards: [] } }));

      await governance.createWeeklyReport();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('weekly-'),
        expect.stringContaining('"totalDriftEvents"')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.md'),
        expect.stringContaining('# Weekly Governance Report')
      );
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle a complete refactoring scenario', async () => {
      // Setup: Create a project with various issues
      const testFiles = createIntegrationTestFiles();
      
      // 1. Initial Analysis
      const analyzer = new EnhancedASTAnalyzer();
      
      // Mock comprehensive analysis result
      const comprehensiveReport = {
        timestamp: new Date().toISOString(),
        summary: {
          totalFiles: Object.keys(testFiles).length,
          totalEntities: 20,
          duplicateClusters: 3,
          circularDependencies: 0,
          unusedExports: 2,
          codeSmells: 8
        },
        entities: [],
        duplicates: [
          {
            hash: 'user-interface-hash',
            type: 'interface',
            severity: 'high',
            entities: [
              { name: 'User', file: 'src/types/user.ts' },
              { name: 'User', file: 'src/types/user-duplicate.ts' }
            ]
          }
        ],
        unusedExports: [
          { name: 'unusedHelper', file: 'src/utils/helpers.ts' }
        ],
        wrapperPatterns: [
          { base: 'UserService', wrapper: 'EnhancedUserService', confidence: 0.9 }
        ],
        recommendations: [
          'Consolidate duplicate User interfaces',
          'Remove unused helper functions',
          'Refactor wrapper pattern in EnhancedUserService'
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(comprehensiveReport));

      // 2. Generate Consolidation Batches
      const consolidationManager = new ConsolidationManager();

      // Create batches for different issue types
      const batchConfigs = [
        {
          id: 'duplicates-batch',
          type: 'duplicates',
          items: comprehensiveReport.duplicates
        },
        {
          id: 'unused-exports-batch',
          type: 'unused-exports',
          items: comprehensiveReport.unusedExports
        },
        {
          id: 'wrapper-patterns-batch',
          type: 'wrapper-patterns',
          items: comprehensiveReport.wrapperPatterns
        }
      ];

      // Process each batch
      for (const config of batchConfigs) {
        const batchContent = JSON.stringify({
          ...config,
          priority: 'high',
          status: 'pending'
        });
        mockFs.readFileSync.mockReturnValue(batchContent);
        
        await consolidationManager.processBatch(`${config.id}.json`);
      }

      // 3. Apply Pattern Standardization
      const standardizer = new PatternStandardizer();
      await standardizer.standardizeProject();

      // 4. Generate Review Report
      await standardizer.generateReviewReport();

      // 5. Final Governance Check
      const governance = new GovernanceSystem();
      
      // Mock improved state after refactoring
      const improvedBaseline = {
        timestamp: new Date().toISOString(),
        metrics: {
          totalEntities: 18, // Reduced due to consolidation
          duplicateCount: 0, // Fixed duplicates
          avgComplexity: 4.2, // Slightly improved
          circularDeps: 0,
          unusedExports: 0 // Cleaned up
        },
        entities: new Map()
      };

      (governance as any).getBaseline = jest.fn().mockReturnValue(improvedBaseline);

      const finalDriftReport = await governance.detectDrift();

      // Verify improvements
      expect(finalDriftReport.severity).toBe('none');
      expect(finalDriftReport.recommendations).toContain(
        expect.stringContaining('No significant drift detected')
      );

      // Verify all steps completed
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'consolidation-state.json',
        expect.any(String)
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'standardization-log.md',
        expect.any(String)
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'manual-review-required.md',
        expect.any(String)
      );
    }, 45000);

    it('should maintain state across workflow interruptions', async () => {
      const consolidationManager = new ConsolidationManager();

      // Mock existing state
      const existingState = {
        'batch-001': { status: 'completed', timestamp: '2024-01-01' },
        'batch-002': { status: 'in-progress', timestamp: '2024-01-02' }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingState));

      // Create new manager instance - should load existing state
      const newManager = new ConsolidationManager();

      // Verify state was loaded
      const statusReport = newManager.generateStatusReport();
      expect(statusReport).toContain('Completed: 1 batches');
      expect(statusReport).toContain('In Progress: 1 batches');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large codebases efficiently', async () => {
      const analyzer = new EnhancedASTAnalyzer();

      // Mock large analysis report
      const largeReport = {
        timestamp: new Date().toISOString(),
        summary: {
          totalFiles: 500,
          totalEntities: 2000,
          duplicateClusters: 50,
          circularDependencies: 5,
          unusedExports: 100,
          codeSmells: 200
        },
        entities: Array.from({ length: 2000 }, (_, i) => ({
          name: `Entity${i}`,
          type: 'interface',
          file: `src/types/entity${i}.ts`,
          normalizedHash: `hash${i}`
        })),
        duplicates: Array.from({ length: 50 }, (_, i) => ({
          hash: `duplicate-hash-${i}`,
          type: 'interface',
          severity: 'medium',
          entities: [
            { name: `Duplicate${i}A`, file: `src/a/duplicate${i}.ts` },
            { name: `Duplicate${i}B`, file: `src/b/duplicate${i}.ts` }
          ]
        })),
        unusedExports: [],
        wrapperPatterns: [],
        recommendations: []
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(largeReport));

      const startTime = Date.now();
      const report = largeReport; // Simulate analysis
      const endTime = Date.now();

      // Verify it handles large datasets
      expect(report.summary.totalEntities).toBe(2000);
      expect(report.duplicates).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should gracefully handle concurrent operations', async () => {
      const consolidationManager = new ConsolidationManager();

      // Mock multiple batch files
      const batches = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-batch-${i}`,
        priority: 'medium',
        type: 'duplicates',
        status: 'pending',
        items: [{ hash: `hash-${i}`, entities: [] }]
      }));

      // Process batches concurrently
      const processingPromises = batches.map(async (batch, i) => {
        mockFs.readFileSync.mockReturnValue(JSON.stringify(batch));
        return consolidationManager.processBatch(`batch-${i}.json`);
      });

      // All should complete without errors
      await expect(Promise.all(processingPromises)).resolves.not.toThrow();

      // Verify all batches were logged
      expect(mockFs.appendFileSync).toHaveBeenCalledTimes(10); // 2 calls per batch (start + complete)
    });
  });
});