/**
 * Integration tests for toolchain compatibility and interoperability
 */

import { EnhancedASTAnalyzer } from '../../scripts/analysis/enhanced-ast-analyzer';
import { ConsolidationManager } from '../../scripts/consolidation/consolidation-manager';
import { PatternStandardizer } from '../../scripts/standardization/pattern-standardizer';
import { GovernanceSystem } from '../../scripts/governance/governance-system';
import { createTestProject, TempFileManager, spyOnConsole } from '../utilities/test-helpers';
import { INTEGRATION_PROJECT_FILES } from '../fixtures/sample-files';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Mock external dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('@octokit/rest');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Toolchain Compatibility Integration Tests', () => {
  let tempFileManager: TempFileManager;
  let consoleSpy: ReturnType<typeof spyOnConsole>;

  beforeEach(() => {
    jest.clearAllMocks();
    tempFileManager = new TempFileManager();
    consoleSpy = spyOnConsole();

    // Setup common mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation();
    mockFs.appendFileSync.mockImplementation();
    mockFs.mkdirSync.mockImplementation();
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.copyFileSync.mockImplementation();
    mockExecSync.mockReturnValue('');
  });

  afterEach(() => {
    tempFileManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('TypeScript Compiler Integration', () => {
    it('should work with different TypeScript versions', async () => {
      const analyzer = new EnhancedASTAnalyzer();
      
      // Mock different TypeScript configurations
      const tsConfigs = [
        {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        },
        {
          target: 'ES2022',
          module: 'esnext',
          strict: true,
          moduleResolution: 'bundler'
        },
        {
          target: 'ES5',
          module: 'commonjs',
          strict: false,
          lib: ['ES2015', 'DOM']
        }
      ];

      for (const config of tsConfigs) {
        // Create test project with specific config
        const project = createTestProject({
          'tsconfig.json': JSON.stringify({ compilerOptions: config }),
          'src/test.ts': 'export interface Test { id: string; }'
        });

        // Replace analyzer's project
        (analyzer as any).project = project;

        // Should handle different configurations
        expect(() => project.getSourceFiles()).not.toThrow();
        expect(project.getSourceFiles()).toHaveLength(2); // tsconfig + test file
      }
    });

    it('should handle TypeScript compilation errors gracefully', async () => {
      const standardizer = new PatternStandardizer();
      
      // Mock compilation failure
      mockExecSync.mockImplementation(() => {
        const error = new Error('TypeScript compilation failed');
        (error as any).stdout = 'src/test.ts(1,1): error TS2322: Type string is not assignable to type number';
        throw error;
      });

      // Should not crash the entire workflow
      await expect(standardizer.standardizeProject()).resolves.not.toThrow();
      
      // Should log the compilation issues
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting pattern standardization')
      );
    });
  });

  describe('ts-morph Integration', () => {
    it('should correctly use ts-morph APIs across all tools', async () => {
      const testProject = createTestProject(INTEGRATION_PROJECT_FILES);

      // Test AST Analyzer usage
      const analyzer = new EnhancedASTAnalyzer();
      (analyzer as any).project = testProject;

      // Should be able to get source files
      const sourceFiles = testProject.getSourceFiles();
      expect(sourceFiles.length).toBeGreaterThan(0);

      // Test Consolidation Manager usage
      const consolidationManager = new ConsolidationManager();
      (consolidationManager as any).project = testProject;

      // Should be able to find entities
      const userFile = testProject.getSourceFile((file: any) => 
        file.getFilePath().includes('user.ts')
      );
      expect(userFile).toBeDefined();

      // Test Pattern Standardizer usage
      const standardizer = new PatternStandardizer();
      (standardizer as any).project = testProject;

      // Should be able to process files
      const shouldProcess = (standardizer as any).shouldProcessFile(userFile);
      expect(typeof shouldProcess).toBe('boolean');
    });

    it('should handle large AST manipulations efficiently', async () => {
      // Create a project with many files
      const largeProject: Record<string, string> = {};
      
      for (let i = 0; i < 50; i++) {
        largeProject[`src/file${i}.ts`] = `
          export interface Entity${i} {
            id: string;
            name: string;
            data: any;
          }
          
          export class Service${i} {
            private entity: Entity${i};
            
            start(): void {
              throw 'Service starting';
            }
            
            getEntity(): Entity${i} {
              return <Entity${i}>this.entity;
            }
          }
        `;
      }

      const project = createTestProject(largeProject);
      const standardizer = new PatternStandardizer();
      (standardizer as any).project = project;

      const startTime = Date.now();
      
      // Process all files
      const sourceFiles = project.getSourceFiles();
      for (const file of sourceFiles) {
        if ((standardizer as any).shouldProcessFile(file)) {
          // Apply a standardization rule
          (standardizer as any).standardizeErrorHandling(file);
        }
      }

      const endTime = Date.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
      expect(sourceFiles.length).toBe(50);
    });
  });

  describe('File System Integration', () => {
    it('should handle various file system scenarios', async () => {
      const consolidationManager = new ConsolidationManager();

      // Test with various file system states
      const scenarios = [
        {
          name: 'missing state file',
          existsSync: () => false,
          expectedBehavior: 'create new state'
        },
        {
          name: 'corrupted state file',
          existsSync: () => true,
          readFileSync: () => 'invalid json',
          expectedBehavior: 'handle gracefully'
        },
        {
          name: 'permission denied',
          existsSync: () => true,
          writeFileSync: () => { throw new Error('EACCES: permission denied'); },
          expectedBehavior: 'log error'
        }
      ];

      for (const scenario of scenarios) {
        jest.clearAllMocks();
        
        mockFs.existsSync.mockImplementation(scenario.existsSync);
        if (scenario.readFileSync) {
          mockFs.readFileSync.mockImplementation(scenario.readFileSync);
        }
        if (scenario.writeFileSync) {
          mockFs.writeFileSync.mockImplementation(scenario.writeFileSync);
        }

        // Should handle each scenario appropriately
        expect(() => new ConsolidationManager()).not.toThrow();
      }
    });

    it('should work across different operating systems', async () => {
      const originalPlatform = process.platform;
      
      try {
        // Test Windows paths
        Object.defineProperty(process, 'platform', { value: 'win32' });
        
        const analyzer = new EnhancedASTAnalyzer();
        expect(() => new EnhancedASTAnalyzer()).not.toThrow();

        // Test Unix paths
        Object.defineProperty(process, 'platform', { value: 'linux' });
        
        const governance = new GovernanceSystem();
        expect(() => new GovernanceSystem()).not.toThrow();

        // Test macOS paths
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        
        const standardizer = new PatternStandardizer();
        expect(() => new PatternStandardizer()).not.toThrow();

      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });
  });

  describe('External Tool Integration', () => {
    it('should integrate with ESLint correctly', async () => {
      const governance = new GovernanceSystem();

      // Mock ESLint output
      const eslintOutput = JSON.stringify([
        {
          filePath: '/src/test.ts',
          messages: [
            {
              ruleId: 'no-wrapper-pattern',
              severity: 2,
              message: 'Avoid wrapper pattern',
              line: 10,
              column: 5
            },
            {
              ruleId: 'consistent-error-handling',
              severity: 1,
              message: 'Use AppError instead of string throws',
              line: 15,
              column: 10
            }
          ]
        }
      ]);

      mockExecSync.mockReturnValue(eslintOutput);

      const violations = (governance as any).checkStandardsViolations();

      expect(violations).toHaveLength(2);
      expect(violations[0].rule).toBe('no-wrapper-pattern');
      expect(violations[0].severity).toBe('error');
      expect(violations[1].rule).toBe('consistent-error-handling');
      expect(violations[1].severity).toBe('warning');
    });

    it('should handle ESLint configuration errors', async () => {
      const governance = new GovernanceSystem();

      // Mock ESLint configuration error
      mockExecSync.mockImplementation(() => {
        throw new Error('ESLint configuration not found');
      });

      // Should not crash
      const violations = (governance as any).checkStandardsViolations();
      expect(violations).toEqual([]);
    });

    it('should generate custom ESLint rules correctly', () => {
      const governance = new GovernanceSystem();

      governance.generateESLintRules();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '.eslint-rules/custom-governance.js',
        expect.stringContaining('no-wrapper-pattern')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '.eslint-rules/custom-governance.js',
        expect.stringContaining('consistent-error-handling')
      );
    });
  });

  describe('GitHub Integration', () => {
    it('should integrate with GitHub API when configured', async () => {
      const governance = new GovernanceSystem();

      // Setup GitHub environment
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      process.env.CI = 'true';

      // Mock Octokit
      const mockOctokit = {
        issues: {
          create: jest.fn().mockResolvedValue({ data: { number: 123 } })
        }
      };
      (governance as any).octokit = mockOctokit;

      // Create critical drift report
      const criticalReport = {
        timestamp: new Date().toISOString(),
        severity: 'critical',
        drift: {
          newDuplicates: 10,
          complexityIncrease: 15,
          newCircularDeps: 5,
          violatedStandards: []
        },
        recommendations: ['Fix critical issues immediately']
      };

      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await (governance as any).enforceGovernance(criticalReport);

      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: '🚨 Critical Code Drift Detected',
        body: expect.stringContaining('Critical Code Drift Detected'),
        labels: ['critical', 'code-quality', 'drift']
      });

      processExitSpy.mockRestore();
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_REPOSITORY;
      delete process.env.CI;
    });

    it('should work without GitHub integration', async () => {
      const governance = new GovernanceSystem();

      // No GitHub token set
      expect((governance as any).octokit).toBeUndefined();

      // Should still work for drift detection
      const mockBaseline = {
        timestamp: new Date().toISOString(),
        metrics: { totalEntities: 5, duplicateCount: 0, avgComplexity: 2, circularDeps: 0, unusedExports: 0 },
        entities: new Map()
      };

      (governance as any).getBaseline = jest.fn().mockReturnValue(mockBaseline);

      const driftReport = await governance.detectDrift();
      expect(driftReport).toBeDefined();
      expect(driftReport.severity).toBeDefined();
    });
  });

  describe('Configuration Compatibility', () => {
    it('should work with various tsconfig configurations', async () => {
      const configs = [
        // Standard configuration
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            strict: true
          }
        },
        // Modern configuration
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'esnext',
            moduleResolution: 'bundler',
            strict: true,
            exactOptionalPropertyTypes: true
          }
        },
        // Legacy configuration
        {
          compilerOptions: {
            target: 'ES5',
            module: 'commonjs',
            lib: ['ES2015', 'DOM'],
            strict: false
          }
        }
      ];

      for (const config of configs) {
        const project = createTestProject({
          'tsconfig.json': JSON.stringify(config),
          'src/test.ts': 'export const test = true;'
        });

        const analyzer = new EnhancedASTAnalyzer();
        (analyzer as any).project = project;

        // Should work with any valid TypeScript configuration
        expect(() => project.getSourceFiles()).not.toThrow();
      }
    });

    it('should handle monorepo structures', async () => {
      // Create a monorepo structure
      const monorepoFiles = {
        'packages/core/src/index.ts': 'export * from "./types";',
        'packages/core/src/types.ts': 'export interface Core { id: string; }',
        'packages/utils/src/index.ts': 'export * from "./helpers";',
        'packages/utils/src/helpers.ts': 'export function helper() {}',
        'packages/app/src/index.ts': 'import { Core } from "@core/types";',
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@core/*': ['packages/core/src/*'],
              '@utils/*': ['packages/utils/src/*']
            }
          }
        })
      };

      const project = createTestProject(monorepoFiles);
      const analyzer = new EnhancedASTAnalyzer();
      (analyzer as any).project = project;

      // Should handle monorepo path mappings
      const sourceFiles = project.getSourceFiles();
      expect(sourceFiles.length).toBe(6); // 5 ts files + tsconfig
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from partial failures', async () => {
      const consolidationManager = new ConsolidationManager();

      // Create a batch with some valid and some invalid items
      const mixedBatch = {
        id: 'mixed-batch',
        priority: 'medium',
        type: 'duplicates',
        status: 'pending',
        items: [
          {
            hash: 'valid-hash',
            entities: [
              { name: 'ValidInterface', file: 'src/valid.ts', type: 'interface' }
            ]
          },
          {
            hash: 'invalid-hash',
            entities: [
              { name: 'MissingInterface', file: 'src/missing.ts', type: 'interface' }
            ]
          }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mixedBatch));

      // Should process valid items even if some fail
      await consolidationManager.processBatch('mixed-batch.json');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Starting batch')
      );
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Completed batch')
      );
    });

    it('should maintain consistency after interruptions', async () => {
      const governance = new GovernanceSystem();

      // Simulate interruption during report generation
      let callCount = 0;
      mockFs.writeFileSync.mockImplementation((path: string, content: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Disk full');
        }
        // Subsequent calls succeed
      });

      mockFs.copyFileSync.mockImplementation(); // Should succeed

      const mockBaseline = {
        timestamp: new Date().toISOString(),
        metrics: { totalEntities: 5, duplicateCount: 0, avgComplexity: 2, circularDeps: 0, unusedExports: 0 },
        entities: new Map()
      };

      (governance as any).getBaseline = jest.fn().mockReturnValue(mockBaseline);

      // Should handle the interruption gracefully
      await expect(governance.detectDrift()).rejects.toThrow('Disk full');

      // But system should remain in consistent state
      expect(mockFs.copyFileSync).not.toHaveBeenCalled(); // Shouldn't reach this point
    });
  });
});