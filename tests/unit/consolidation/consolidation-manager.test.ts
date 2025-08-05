/**
 * Unit tests for ConsolidationManager
 */

import { ConsolidationManager } from '../../../scripts/consolidation/consolidation-manager';
import { createTestProject, createMockConsolidationBatch, TempFileManager, spyOnConsole } from '../../utilities/test-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('ConsolidationManager', () => {
  let manager: ConsolidationManager;
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
    mockFs.copyFileSync.mockImplementation();
    mockFs.unlinkSync.mockImplementation();

    // Mock exec for compilation verification
    mockExecSync.mockReturnValue('');

    manager = new ConsolidationManager();
  });

  afterEach(() => {
    tempFileManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(() => new ConsolidationManager()).not.toThrow();
    });

    it('should load existing state file if it exists', () => {
      const mockState = { 'batch-1': { status: 'completed', timestamp: '2024-01-01' } };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockState));

      const newManager = new ConsolidationManager();
      
      expect(mockFs.readFileSync).toHaveBeenCalledWith('consolidation-state.json', 'utf-8');
    });
  });

  describe('processBatch', () => {
    it('should process a duplicates batch successfully', async () => {
      const batch = createMockConsolidationBatch('duplicates');
      const batchFile = tempFileManager.createTempFile(JSON.stringify(batch), '.json');

      mockFs.readFileSync.mockReturnValue(JSON.stringify(batch));

      // Mock the project with test entities
      const project = createTestProject({
        'src/types/user.ts': `
          export interface User {
            id: string;
            name: string;
          }
        `,
        'src/types/duplicate-user.ts': `
          export interface User {
            id: string;
            name: string;
          }
        `
      });

      // Replace the manager's project with our test project
      (manager as any).project = project;

      await manager.processBatch(batchFile);

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Starting batch')
      );
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Completed batch')
      );
    });

    it('should process unused exports batch successfully', async () => {
      const batch = createMockConsolidationBatch('unused-exports');
      batch.items = [
        { name: 'unusedFunction', file: 'src/utils.ts', type: 'function' },
        { name: 'UNUSED_CONSTANT', file: 'src/constants.ts', type: 'const' }
      ];

      mockFs.readFileSync.mockReturnValue(JSON.stringify(batch));

      const project = createTestProject({
        'src/utils.ts': `
          export function usedFunction() {}
          export function unusedFunction() {}
        `,
        'src/constants.ts': `
          export const USED_CONSTANT = 'used';
          export const UNUSED_CONSTANT = 'unused';
        `
      });

      (manager as any).project = project;

      await manager.processBatch('test-batch.json');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('unused exports')
      );
    });

    it('should handle wrapper patterns batch', async () => {
      const batch = createMockConsolidationBatch('wrapper-patterns');
      batch.items = [{
        base: 'UserService',
        wrapper: 'EnhancedUserService',
        baseFile: 'src/user-service.ts',
        wrapperFile: 'src/enhanced-user-service.ts',
        confidence: 0.9
      }];

      mockFs.readFileSync.mockReturnValue(JSON.stringify(batch));

      const project = createTestProject({
        'src/user-service.ts': `
          export class UserService {
            getUser() { return null; }
          }
        `,
        'src/enhanced-user-service.ts': `
          import { UserService } from './user-service';
          export class EnhancedUserService extends UserService {
            getUserWithLogging() { console.log('getting user'); return super.getUser(); }
          }
        `
      });

      (manager as any).project = project;

      await manager.processBatch('test-batch.json');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('wrapper pattern')
      );
    });

    it('should handle batch processing errors gracefully', async () => {
      const batch = createMockConsolidationBatch('duplicates');
      mockFs.readFileSync.mockReturnValue(JSON.stringify(batch));

      // Simulate an error during processing
      const project = createTestProject({});
      (manager as any).project = project;
      (manager as any).processDuplicates = jest.fn().mockRejectedValue(new Error('Processing failed'));

      await expect(manager.processBatch('test-batch.json')).rejects.toThrow('Processing failed');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Failed to process batch')
      );
    });

    it('should throw error for unknown batch type', async () => {
      const batch = { ...createMockConsolidationBatch(), type: 'unknown-type' };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(batch));

      await expect(manager.processBatch('test-batch.json')).rejects.toThrow('Unknown batch type: unknown-type');
    });
  });

  describe('createConsolidationPlan', () => {
    it('should create a valid consolidation plan for duplicates', () => {
      const duplicateCluster = {
        entities: [
          { name: 'User', file: 'src/types/user.ts', type: 'interface', jsDoc: 'Main user interface' },
          { name: 'User', file: 'src/types/duplicate.ts', type: 'interface' },
          { name: 'User', file: 'src/models/user.ts', type: 'interface' }
        ]
      };

      // Mock usage map
      (manager as any).loadUsageMap = jest.fn().mockReturnValue({
        'src/types/user.ts:User': { usages: [{ file: 'src/service.ts' }] },
        'src/types/duplicate.ts:User': { usages: [{ file: 'src/controller.ts' }] }
      });

      const plan = (manager as any).createConsolidationPlan(duplicateCluster);

      expect(plan.targetEntity).toBeDefined();
      expect(plan.sourceEntities).toHaveLength(2);
      expect(plan.affectedFiles).toContain('src/service.ts');
      expect(plan.affectedFiles).toContain('src/controller.ts');
      expect(plan.strategy).toBe('merge');
    });
  });

  describe('chooseBestCandidate', () => {
    it('should prefer entities in types directory', () => {
      const entities = [
        { name: 'User', file: 'src/models/user.ts', exportType: 'named' },
        { name: 'User', file: 'src/types/user.ts', exportType: 'named' },
        { name: 'User', file: 'src/temp/user.ts', exportType: 'named' }
      ];

      const best = (manager as any).chooseBestCandidate(entities);

      expect(best.file).toBe('src/types/user.ts');
    });

    it('should prefer entities with JSDoc', () => {
      const entities = [
        { name: 'User', file: 'src/a.ts', exportType: 'named' },
        { name: 'User', file: 'src/b.ts', exportType: 'named', jsDoc: 'User interface' }
      ];

      const best = (manager as any).chooseBestCandidate(entities);

      expect(best.file).toBe('src/b.ts');
    });

    it('should avoid entities with temp names', () => {
      const entities = [
        { name: 'TempUser', file: 'src/a.ts', exportType: 'named' },
        { name: 'User', file: 'src/b.ts', exportType: 'named' }
      ];

      const best = (manager as any).chooseBestCandidate(entities);

      expect(best.name).toBe('User');
    });
  });

  describe('generateConsolidatedEntity', () => {
    it('should merge interface properties correctly', async () => {
      const plan = {
        targetEntity: { name: 'User', file: 'src/user.ts', type: 'interface' },
        sourceEntities: [
          { name: 'User', file: 'src/duplicate.ts', type: 'interface' }
        ]
      };

      const project = createTestProject({
        'src/user.ts': `
          export interface User {
            id: string;
            name: string;
          }
        `,
        'src/duplicate.ts': `
          export interface User {
            id: string;
            email: string;
            role: string;
          }
        `
      });

      (manager as any).project = project;

      const consolidated = await (manager as any).generateConsolidatedEntity(plan);

      expect(consolidated).toContain('id');
      expect(consolidated).toContain('name');
      expect(consolidated).toContain('email');
      expect(consolidated).toContain('role');
    });

    it('should handle missing target entity', async () => {
      const plan = {
        targetEntity: { name: 'NonExistent', file: 'src/user.ts', type: 'interface' },
        sourceEntities: []
      };

      const project = createTestProject({
        'src/user.ts': 'export interface User { id: string; }'
      });

      (manager as any).project = project;

      await expect((manager as any).generateConsolidatedEntity(plan))
        .rejects.toThrow('Target entity NonExistent not found');
    });
  });

  describe('updateFileImports', () => {
    it('should update imports correctly after consolidation', async () => {
      const plan = {
        targetEntity: { name: 'User', file: 'src/types/user.ts' },
        sourceEntities: [
          { name: 'User', file: 'src/models/user.ts' }
        ]
      };

      const project = createTestProject({
        'src/service.ts': `
          import { User } from './models/user';
          export class UserService {
            getUser(): User { return null; }
          }
        `,
        'src/types/user.ts': 'export interface User { id: string; }',
        'src/models/user.ts': 'export interface User { id: string; }'
      });

      (manager as any).project = project;

      await (manager as any).updateFileImports('src/service.ts', plan);

      const serviceFile = project.getSourceFile('src/service.ts');
      const imports = serviceFile?.getImportDeclarations();
      expect(imports?.length).toBeGreaterThan(0);
    });
  });

  describe('verifyCompilation', () => {
    it('should pass when compilation succeeds', async () => {
      mockExecSync.mockReturnValue('');

      await expect((manager as any).verifyCompilation()).resolves.not.toThrow();
      expect(mockExecSync).toHaveBeenCalledWith('npx tsc --noEmit', { stdio: 'pipe' });
    });

    it('should fail when compilation fails', async () => {
      const error = new Error('Compilation failed');
      (error as any).stdout = 'Type error in file.ts';
      mockExecSync.mockImplementation(() => { throw error; });

      await expect((manager as any).verifyCompilation()).rejects.toThrow('Compilation failed after consolidation');
    });
  });

  describe('cleanupEmptyFiles', () => {
    it('should remove files with no content', async () => {
      const project = createTestProject({
        'src/empty.ts': 'import { Something } from "./other";',
        'src/with-content.ts': 'export interface User { id: string; }'
      });

      (manager as any).project = project;

      await (manager as any).cleanupEmptyFiles();

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('empty.ts')
      );
    });

    it('should not remove files with actual content', async () => {
      const project = createTestProject({
        'src/with-content.ts': 'export interface User { id: string; }'
      });

      (manager as any).project = project;

      await (manager as any).cleanupEmptyFiles();

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('extractUniqueFunctionality', () => {
    it('should identify unique methods in wrapper classes', () => {
      const project = createTestProject({
        'src/base.ts': `
          export class UserService {
            getUser() { return null; }
            createUser() { return null; }
          }
        `,
        'src/wrapper.ts': `
          export class EnhancedUserService extends UserService {
            getUser() { return super.getUser(); }
            getUserWithLogging() { console.log('getting'); return this.getUser(); }
            validateUser() { return true; }
          }
        `
      });

      const baseFile = project.getSourceFile('src/base.ts')!;
      const wrapperFile = project.getSourceFile('src/wrapper.ts')!;

      const unique = (manager as any).extractUniqueFunctionality(
        baseFile, wrapperFile, 'UserService', 'EnhancedUserService'
      );

      expect(unique).toHaveLength(2);
      expect(unique.map((u: any) => u.name)).toContain('getUserWithLogging');
      expect(unique.map((u: any) => u.name)).toContain('validateUser');
    });

    it('should return empty array when no unique functionality exists', () => {
      const project = createTestProject({
        'src/base.ts': `
          export class UserService {
            getUser() { return null; }
          }
        `,
        'src/wrapper.ts': `
          export class EnhancedUserService extends UserService {
            getUser() { return super.getUser(); }
          }
        `
      });

      const baseFile = project.getSourceFile('src/base.ts')!;
      const wrapperFile = project.getSourceFile('src/wrapper.ts')!;

      const unique = (manager as any).extractUniqueFunctionality(
        baseFile, wrapperFile, 'UserService', 'EnhancedUserService'
      );

      expect(unique).toHaveLength(0);
    });
  });

  describe('findEntity', () => {
    it('should find classes', () => {
      const project = createTestProject({
        'src/test.ts': 'export class TestClass {}'
      });

      const sourceFile = project.getSourceFile('src/test.ts')!;
      const entity = (manager as any).findEntity(sourceFile, 'TestClass');

      expect(entity).toBeDefined();
      expect(entity.getName()).toBe('TestClass');
    });

    it('should find interfaces', () => {
      const project = createTestProject({
        'src/test.ts': 'export interface TestInterface { id: string; }'
      });

      const sourceFile = project.getSourceFile('src/test.ts')!;
      const entity = (manager as any).findEntity(sourceFile, 'TestInterface');

      expect(entity).toBeDefined();
      expect(entity.getName()).toBe('TestInterface');
    });

    it('should find functions', () => {
      const project = createTestProject({
        'src/test.ts': 'export function testFunction() {}'
      });

      const sourceFile = project.getSourceFile('src/test.ts')!;
      const entity = (manager as any).findEntity(sourceFile, 'testFunction');

      expect(entity).toBeDefined();
      expect(entity.getName()).toBe('testFunction');
    });

    it('should return undefined for non-existent entities', () => {
      const project = createTestProject({
        'src/test.ts': 'export class TestClass {}'
      });

      const sourceFile = project.getSourceFile('src/test.ts')!;
      const entity = (manager as any).findEntity(sourceFile, 'NonExistent');

      expect(entity).toBeUndefined();
    });
  });

  describe('generateStatusReport', () => {
    it('should generate a status report with correct statistics', () => {
      const mockState = {
        'batch-1': { status: 'completed', timestamp: '2024-01-01' },
        'batch-2': { status: 'in-progress', timestamp: '2024-01-02' },
        'batch-3': { status: 'skipped', timestamp: '2024-01-03' },
        'batch-4': { status: 'completed', timestamp: '2024-01-04' }
      };

      (manager as any).state = mockState;

      const report = manager.generateStatusReport();

      expect(report).toContain('Completed: 2 batches');
      expect(report).toContain('In Progress: 1 batches');
      expect(report).toContain('Skipped: 1 batches');
      expect(report).toContain('batch-1: completed');
      expect(report).toContain('batch-2: in-progress');
    });

    it('should handle empty state', () => {
      (manager as any).state = {};

      const report = manager.generateStatusReport();

      expect(report).toContain('Completed: 0 batches');
      expect(report).toContain('In Progress: 0 batches');
      expect(report).toContain('Skipped: 0 batches');
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(manager.processBatch('non-existent.json')).rejects.toThrow('File not found');
    });

    it('should handle invalid JSON in batch files', async () => {
      mockFs.readFileSync.mockReturnValue('invalid json');

      await expect(manager.processBatch('invalid.json')).rejects.toThrow();
    });
  });

  describe('logging', () => {
    it('should log messages to file and console', () => {
      (manager as any).log('Test message', 'info');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('Test message')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith('Test message');
    });

    it('should handle error logging', () => {
      (manager as any).log('Error message', 'error');

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'consolidation.log',
        expect.stringContaining('[ERROR] Error message')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith('Error message');
    });
  });

  describe('state management', () => {
    it('should save batch state correctly', () => {
      const batch = createMockConsolidationBatch();
      batch.status = 'completed';

      (manager as any).saveState(batch);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'consolidation-state.json',
        expect.stringContaining('"completed"')
      );
    });
  });

  describe('import path utilities', () => {
    it('should detect imports correctly', () => {
      const isImport = (manager as any).isImportFrom('./user', '/src/user.ts', '/src/service.ts');
      expect(isImport).toBe(true);
    });

    it('should generate correct relative import paths', () => {
      const relativePath = (manager as any).getRelativeImportPath(
        '/src/services/user.ts',
        '/src/types/user.ts'
      );
      expect(relativePath).toBe('../types/user');
    });
  });
});