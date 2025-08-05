/**
 * Unit tests for EnhancedASTAnalyzer
 */

import { EnhancedASTAnalyzer } from '../../../scripts/analysis/enhanced-ast-analyzer';
import { createTestProject, createMockAnalysisReport, TempFileManager, spyOnConsole } from '../../utilities/test-helpers';
import { 
  SAMPLE_INTERFACE, 
  DUPLICATE_INTERFACE, 
  SAMPLE_CLASS, 
  WRAPPER_CLASS,
  COMPLEX_FUNCTION,
  CIRCULAR_DEPENDENCY_A,
  CIRCULAR_DEPENDENCY_B,
  UNUSED_EXPORTS
} from '../../fixtures/sample-files';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system operations
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('EnhancedASTAnalyzer', () => {
  let analyzer: EnhancedASTAnalyzer;
  let tempFileManager: TempFileManager;
  let consoleSpy: ReturnType<typeof spyOnConsole>;

  beforeEach(() => {
    jest.clearAllMocks();
    tempFileManager = new TempFileManager();
    consoleSpy = spyOnConsole();
    
    // Mock fs.existsSync to return true for output directory
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation();
    mockFs.writeFileSync.mockImplementation();
    
    analyzer = new EnhancedASTAnalyzer();
  });

  afterEach(() => {
    tempFileManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default tsconfig path', () => {
      expect(() => new EnhancedASTAnalyzer()).not.toThrow();
    });

    it('should initialize with custom tsconfig path', () => {
      expect(() => new EnhancedASTAnalyzer('./custom-tsconfig.json')).not.toThrow();
    });
  });

  describe('analyzeProject', () => {
    beforeEach(() => {
      // Mock the analyzer to use in-memory project
      const project = createTestProject({
        'src/types/user.ts': SAMPLE_INTERFACE,
        'src/types/duplicate-user.ts': DUPLICATE_INTERFACE,
        'src/services/user-service.ts': SAMPLE_CLASS,
        'src/services/wrapper-service.ts': WRAPPER_CLASS,
        'src/utils/complex.ts': COMPLEX_FUNCTION,
        'src/unused.ts': UNUSED_EXPORTS
      });

      // Replace the analyzer's project with our test project
      (analyzer as any).project = project;
      (analyzer as any).tsProgram = project.getProgram().compilerObject;
      (analyzer as any).typeChecker = (analyzer as any).tsProgram.getTypeChecker();
    });

    it('should analyze project and return complete report', async () => {
      const report = await analyzer.analyzeProject();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.entities).toBeInstanceOf(Array);
      expect(report.duplicates).toBeInstanceOf(Array);
      expect(report.unusedExports).toBeInstanceOf(Array);
      expect(report.wrapperPatterns).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should detect duplicate interfaces', async () => {
      const report = await analyzer.analyzeProject();

      expect(report.duplicates.length).toBeGreaterThan(0);
      const duplicateCluster = report.duplicates.find(d => d.type === 'interface');
      expect(duplicateCluster).toBeDefined();
      expect(duplicateCluster?.entities.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate correct summary metrics', async () => {
      const report = await analyzer.analyzeProject();

      expect(report.summary.totalFiles).toBeGreaterThan(0);
      expect(report.summary.totalEntities).toBeGreaterThan(0);
      expect(typeof report.summary.duplicateClusters).toBe('number');
      expect(typeof report.summary.unusedExports).toBe('number');
    });

    it('should handle empty project gracefully', async () => {
      const emptyProject = createTestProject({});
      (analyzer as any).project = emptyProject;

      const report = await analyzer.analyzeProject();

      expect(report.summary.totalFiles).toBe(0);
      expect(report.summary.totalEntities).toBe(0);
      expect(report.entities).toHaveLength(0);
    });
  });

  describe('detectDuplicates', () => {
    it('should identify structural duplicates', async () => {
      const project = createTestProject({
        'file1.ts': SAMPLE_INTERFACE,
        'file2.ts': DUPLICATE_INTERFACE
      });
      (analyzer as any).project = project;

      // Populate entities map manually for this test
      const entities = new Map();
      entities.set('file1.ts:User', {
        name: 'User',
        type: 'interface',
        file: 'file1.ts',
        normalizedHash: 'abc123',
        semanticHash: 'def456'
      });
      entities.set('file2.ts:User', {
        name: 'User',
        type: 'interface',
        file: 'file2.ts',
        normalizedHash: 'abc123',
        semanticHash: 'def456'
      });
      (analyzer as any).entities = entities;

      const duplicates = await (analyzer as any).detectDuplicates();

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].entities).toHaveLength(2);
      expect(duplicates[0].structuralMatch).toBe(true);
    });

    it('should calculate correct severity for duplicates', async () => {
      const entities = [
        { complexity: 10, dependencies: [] },
        { complexity: 15, dependencies: ['dep1', 'dep2'] },
        { complexity: 20, dependencies: ['dep1', 'dep2', 'dep3'] },
        { complexity: 25, dependencies: ['dep1', 'dep2', 'dep3', 'dep4'] }
      ];

      const severity = (analyzer as any).calculateDuplicateSeverity(entities);
      
      expect(['critical', 'high', 'medium']).toContain(severity);
    });
  });

  describe('findUnusedExports', () => {
    it('should identify unused exports', () => {
      const project = createTestProject({
        'exports.ts': UNUSED_EXPORTS,
        'imports.ts': `import { usedFunction } from './exports';`
      });
      (analyzer as any).project = project;

      // Populate entities for unused exports
      const entities = new Map();
      entities.set('exports.ts:usedFunction', {
        name: 'usedFunction',
        exportType: 'named'
      });
      entities.set('exports.ts:unusedFunction', {
        name: 'unusedFunction',
        exportType: 'named'
      });
      (analyzer as any).entities = entities;

      const unusedExports = (analyzer as any).findUnusedExports();

      const unusedNames = unusedExports.map((e: any) => e.name);
      expect(unusedNames).toContain('unusedFunction');
      expect(unusedNames).not.toContain('usedFunction');
    });
  });

  describe('detectWrapperPatterns', () => {
    it('should detect wrapper patterns by naming conventions', () => {
      const entities = new Map();
      entities.set('file1:UserService', {
        name: 'UserService',
        type: 'class'
      });
      entities.set('file2:EnhancedUserService', {
        name: 'EnhancedUserService',
        type: 'class'
      });
      entities.set('file3:ExtendedUserService', {
        name: 'ExtendedUserService',
        type: 'class'
      });
      (analyzer as any).entities = entities;

      const wrapperPatterns = (analyzer as any).detectWrapperPatterns();

      expect(wrapperPatterns.length).toBeGreaterThan(0);
      const enhancedWrapper = wrapperPatterns.find((w: any) => w.wrapper === 'EnhancedUserService');
      expect(enhancedWrapper).toBeDefined();
      expect(enhancedWrapper.base).toBe('UserService');
      expect(enhancedWrapper.confidence).toBe(0.9);
    });

    it('should not detect false positive wrapper patterns', () => {
      const entities = new Map();
      entities.set('file1:UserService', {
        name: 'UserService',
        type: 'class'
      });
      entities.set('file2:PaymentService', {
        name: 'PaymentService',
        type: 'class'
      });
      (analyzer as any).entities = entities;

      const wrapperPatterns = (analyzer as any).detectWrapperPatterns();

      expect(wrapperPatterns).toHaveLength(0);
    });
  });

  describe('complexity calculation', () => {
    it('should calculate cyclomatic complexity correctly', () => {
      const project = createTestProject({
        'complex.ts': COMPLEX_FUNCTION
      });

      const sourceFile = project.getSourceFile('complex.ts')!;
      const func = sourceFile.getFunctions()[0];

      const complexity = (analyzer as any).calculateComplexity(func);

      // The complex function has multiple if statements and loops
      expect(complexity).toBeGreaterThan(1);
      expect(typeof complexity).toBe('number');
    });

    it('should return 1 for simple functions', () => {
      const project = createTestProject({
        'simple.ts': `
          export function simpleFunction(): string {
            return 'hello';
          }
        `
      });

      const sourceFile = project.getSourceFile('simple.ts')!;
      const func = sourceFile.getFunctions()[0];

      const complexity = (analyzer as any).calculateComplexity(func);

      expect(complexity).toBe(1);
    });
  });

  describe('hash generation', () => {
    it('should generate consistent normalized hashes', () => {
      const content = { prop1: 'value1', prop2: 'value2' };
      
      const hash1 = (analyzer as any).generateNormalizedHash(content);
      const hash2 = (analyzer as any).generateNormalizedHash(content);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(8);
    });

    it('should generate different hashes for different content', () => {
      const content1 = { prop1: 'value1' };
      const content2 = { prop1: 'value2' };
      
      const hash1 = (analyzer as any).generateNormalizedHash(content1);
      const hash2 = (analyzer as any).generateNormalizedHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('entity extraction', () => {
    it('should extract interfaces correctly', () => {
      const project = createTestProject({
        'interface.ts': SAMPLE_INTERFACE
      });
      const sourceFile = project.getSourceFile('interface.ts')!;
      (analyzer as any).entities = new Map();

      (analyzer as any).extractInterfaces(sourceFile);

      const entities = Array.from((analyzer as any).entities.values());
      const interfaceEntity = entities.find(e => e.type === 'interface');
      
      expect(interfaceEntity).toBeDefined();
      expect(interfaceEntity.name).toBe('User');
      expect(interfaceEntity.members.properties).toBeDefined();
      expect(interfaceEntity.members.properties.length).toBeGreaterThan(0);
    });

    it('should extract classes correctly', () => {
      const project = createTestProject({
        'class.ts': SAMPLE_CLASS
      });
      const sourceFile = project.getSourceFile('class.ts')!;
      (analyzer as any).entities = new Map();

      (analyzer as any).extractClasses(sourceFile);

      const entities = Array.from((analyzer as any).entities.values());
      const classEntity = entities.find(e => e.type === 'service' || e.type === 'class');
      
      expect(classEntity).toBeDefined();
      expect(classEntity.name).toBe('UserService');
      expect(classEntity.members.methods).toBeDefined();
      expect(classEntity.members.methods.length).toBeGreaterThan(0);
    });

    it('should detect service classes by naming convention', () => {
      const project = createTestProject({
        'service.ts': `
          export class UserService {
            async getUser() { return null; }
          }
        `
      });
      const sourceFile = project.getSourceFile('service.ts')!;
      (analyzer as any).entities = new Map();

      (analyzer as any).extractClasses(sourceFile);

      const entities = Array.from((analyzer as any).entities.values());
      const serviceEntity = entities.find(e => e.type === 'service');
      
      expect(serviceEntity).toBeDefined();
      expect(serviceEntity.name).toBe('UserService');
    });
  });

  describe('recommendations generation', () => {
    it('should generate appropriate recommendations for critical duplicates', () => {
      const duplicates = [{
        severity: 'critical',
        entities: [{ name: 'User' }, { name: 'User' }, { name: 'User' }],
        type: 'interface'
      }];

      const recommendations = (analyzer as any).generateRecommendations(
        duplicates, [], [], []
      );

      expect(recommendations.length).toBeGreaterThan(0);
      const criticalRec = recommendations.find((r: any) => r.priority === 'CRITICAL');
      expect(criticalRec).toBeDefined();
      expect(criticalRec.type).toBe('MERGE_DUPLICATES');
    });

    it('should generate recommendations for unused exports', () => {
      const unusedExports = [
        { name: 'unused1' },
        { name: 'unused2' },
        { name: 'unused3' }
      ];

      const recommendations = (analyzer as any).generateRecommendations(
        [], unusedExports, [], []
      );

      expect(recommendations.length).toBeGreaterThan(0);
      const deadCodeRec = recommendations.find((r: any) => r.type === 'REMOVE_DEAD_CODE');
      expect(deadCodeRec).toBeDefined();
      expect(deadCodeRec.count).toBe(3);
    });

    it('should generate recommendations for wrapper patterns', () => {
      const wrapperPatterns = [{
        base: 'UserService',
        wrapper: 'EnhancedUserService',
        confidence: 0.9
      }];

      const recommendations = (analyzer as any).generateRecommendations(
        [], [], wrapperPatterns, []
      );

      expect(recommendations.length).toBeGreaterThan(0);
      const wrapperRec = recommendations.find((r: any) => r.type === 'REFACTOR_WRAPPER');
      expect(wrapperRec).toBeDefined();
      expect(wrapperRec.priority).toBe('MEDIUM');
    });
  });

  describe('saveReport', () => {
    it('should save report files', async () => {
      const report = createMockAnalysisReport();
      const outputDir = './test-output';

      await analyzer.saveReport(report, outputDir);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('analysis-report.json'),
        expect.stringContaining('"timestamp"')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('entities.csv'),
        expect.any(String)
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('duplicates.csv'),
        expect.any(String)
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('ANALYSIS_SUMMARY.md'),
        expect.any(String)
      );
    });

    it('should create output directory if it does not exist', async () => {
      const report = createMockAnalysisReport();
      mockFs.existsSync.mockReturnValue(false);

      await analyzer.saveReport(report);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        './analysis-output',
        { recursive: true }
      );
    });
  });

  describe('markdown report generation', () => {
    it('should generate properly formatted markdown report', () => {
      const report = createMockAnalysisReport();
      
      const markdown = (analyzer as any).generateMarkdownReport(report);

      expect(markdown).toContain('# Code Analysis Report');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('## Critical Issues');
      expect(markdown).toContain('## Recommendations');
      expect(markdown).toContain('## Next Steps');
      expect(markdown).toContain(report.timestamp);
    });

    it('should handle empty recommendations', () => {
      const report = createMockAnalysisReport({
        recommendations: []
      });
      
      const markdown = (analyzer as any).generateMarkdownReport(report);

      expect(markdown).toContain('## Recommendations');
      expect(markdown).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid tsconfig path gracefully', () => {
      expect(() => {
        new EnhancedASTAnalyzer('./non-existent-tsconfig.json');
      }).not.toThrow();
    });

    it('should handle file system errors during save', async () => {
      const report = createMockAnalysisReport();
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(analyzer.saveReport(report)).rejects.toThrow('Permission denied');
    });
  });

  describe('integration with ts-morph', () => {
    it('should correctly use TypeScript compiler API', () => {
      const project = createTestProject({
        'test.ts': `
          export interface TestInterface {
            id: number;
            name: string;
          }
        `
      });

      expect(project.getSourceFiles()).toHaveLength(1);
      const sourceFile = project.getSourceFile('test.ts')!;
      expect(sourceFile.getInterfaces()).toHaveLength(1);
    });
  });
});