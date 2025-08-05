/**
 * Unit tests for PatternStandardizer
 */

import { PatternStandardizer } from '../../../scripts/standardization/pattern-standardizer';
import { createTestProject, TempFileManager, spyOnConsole } from '../../utilities/test-helpers';
import {
  BAD_ERROR_HANDLING,
  OLD_ASYNC_PATTERN,
  CONST_ENUM_CANDIDATE,
  OLD_TYPE_ASSERTION,
  NO_OPTIONAL_CHAINING,
  UNORDERED_IMPORTS,
  INTERFACE_WITH_I_PREFIX,
  INCORRECT_SERVICE_PATTERN
} from '../../fixtures/sample-files';
import * as fs from 'fs';

// Mock file system operations
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('PatternStandardizer', () => {
  let standardizer: PatternStandardizer;
  let tempFileManager: TempFileManager;
  let consoleSpy: ReturnType<typeof spyOnConsole>;

  beforeEach(() => {
    jest.clearAllMocks();
    tempFileManager = new TempFileManager();
    consoleSpy = spyOnConsole();

    // Mock file system operations
    mockFs.writeFileSync.mockImplementation();

    standardizer = new PatternStandardizer();
  });

  afterEach(() => {
    tempFileManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with all standardization rules', () => {
      const rules = (standardizer as any).rules;
      
      expect(rules).toHaveLength(8);
      expect(rules.find((r: any) => r.name === 'consistent-error-handling')).toBeDefined();
      expect(rules.find((r: any) => r.name === 'async-await-pattern')).toBeDefined();
      expect(rules.find((r: any) => r.name === 'enum-standardization')).toBeDefined();
      expect(rules.find((r: any) => r.name === 'service-lifecycle')).toBeDefined();
      expect(rules.find((r: any) => r.name === 'import-ordering')).toBeDefined();
      expect(rules.find((r: any) => r.name === 'naming-conventions')).toBeDefined();
      expect(rules.find((r: any) => r.name === 'optional-chaining')).toBeDefined();
      expect(rules.find((r: any) => r.name === 'type-assertions')).toBeDefined();
    });
  });

  describe('standardizeProject', () => {
    it('should apply all rules to project files', async () => {
      const project = createTestProject({
        'src/test.ts': BAD_ERROR_HANDLING
      });

      // Replace the standardizer's project with our test project
      (standardizer as any).project = project;

      await standardizer.standardizeProject();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'standardization-log.md',
        expect.stringContaining('Pattern Standardization Log')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting pattern standardization')
      );
    });

    it('should skip test and declaration files', async () => {
      const project = createTestProject({
        'src/component.test.ts': 'export const test = true;',
        'src/types.d.ts': 'declare const global: any;',
        'src/regular.ts': 'export const regular = true;'
      });

      (standardizer as any).project = project;

      const shouldProcessSpy = jest.spyOn(standardizer as any, 'shouldProcessFile');

      await standardizer.standardizeProject();

      // Should have been called for all files but returned false for test/d.ts files
      expect(shouldProcessSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling standardization', () => {
    it('should replace string throws with AppError', () => {
      const project = createTestProject({
        'src/service.ts': BAD_ERROR_HANDLING
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeErrorHandling(sourceFile);

      expect(modified).toBe(true);
      
      const content = sourceFile.getText();
      expect(content).toContain('throw new AppError');
      expect(content).not.toContain("throw 'ID is required'");
      expect(content).not.toContain("throw 'User not found'");
    });

    it('should replace new Error() with AppError', () => {
      const project = createTestProject({
        'src/service.ts': `
          export function test() {
            throw new Error('Something went wrong');
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeErrorHandling(sourceFile);

      expect(modified).toBe(true);
      
      const content = sourceFile.getText();
      expect(content).toContain('throw new AppError');
      expect(content).not.toContain('throw new Error');
    });

    it('should add AppError import when needed', () => {
      const project = createTestProject({
        'src/service.ts': `
          export function test() {
            throw 'test error';
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      (standardizer as any).standardizeErrorHandling(sourceFile);

      const imports = sourceFile.getImportDeclarations();
      const appErrorImport = imports.find(imp => 
        imp.getModuleSpecifierValue() === '@/errors'
      );
      
      expect(appErrorImport).toBeDefined();
      expect(appErrorImport?.getNamedImports().some(
        imp => imp.getName() === 'AppError'
      )).toBe(true);
    });

    it('should not modify code without string throws', () => {
      const project = createTestProject({
        'src/service.ts': `
          export function test() {
            throw new AppError('Already correct', 'TEST_ERROR');
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeErrorHandling(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('async/await pattern standardization', () => {
    it('should make functions with promise returns async', () => {
      const project = createTestProject({
        'src/service.ts': `
          export function getUserData(): Promise<User> {
            return database.findUser()
              .then(user => user)
              .then(user => enrichUser(user));
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeAsyncAwait(sourceFile);

      expect(modified).toBe(true);
      
      const func = sourceFile.getFunctions()[0];
      expect(func.isAsync()).toBe(true);
    });

    it('should not modify async functions', () => {
      const project = createTestProject({
        'src/service.ts': `
          export async function getUserData(): Promise<User> {
            const user = await database.findUser();
            return enrichUser(user);
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeAsyncAwait(sourceFile);

      expect(modified).toBe(false);
    });

    it('should not modify functions without promise chains', () => {
      const project = createTestProject({
        'src/service.ts': `
          export function getUser(): Promise<User> {
            return database.findUser();
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeAsyncAwait(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('enum standardization', () => {
    it('should convert const objects to enums', () => {
      const project = createTestProject({
        'src/constants.ts': CONST_ENUM_CANDIDATE
      });

      const sourceFile = project.getSourceFile('src/constants.ts')!;
      const modified = (standardizer as any).standardizeEnums(sourceFile);

      expect(modified).toBe(true);
      
      const content = sourceFile.getText();
      expect(content).toContain('export enum UserRoles');
      expect(content).toContain('ADMIN = \'admin\'');
      expect(content).toContain('export enum StatusCodes');
      expect(content).toContain('SUCCESS = 200');
    });

    it('should not convert objects with non-string values for mixed types', () => {
      const project = createTestProject({
        'src/constants.ts': `
          export const MIXED_OBJECT = {
            name: 'test',
            count: 42,
            active: true
          } as const;
        `
      });

      const sourceFile = project.getSourceFile('src/constants.ts')!;
      const modified = (standardizer as any).standardizeEnums(sourceFile);

      expect(modified).toBe(false);
    });

    it('should not convert objects with lowercase names', () => {
      const project = createTestProject({
        'src/constants.ts': `
          export const config = {
            debug: 'on',
            env: 'development'
          } as const;
        `
      });

      const sourceFile = project.getSourceFile('src/constants.ts')!;
      const modified = (standardizer as any).standardizeEnums(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('service lifecycle standardization', () => {
    it('should make services extend BaseService', () => {
      const project = createTestProject({
        'src/user-service.ts': INCORRECT_SERVICE_PATTERN
      });

      const sourceFile = project.getSourceFile('src/user-service.ts')!;
      const modified = (standardizer as any).standardizeServiceLifecycle(sourceFile);

      expect(modified).toBe(true);
      
      const classDecl = sourceFile.getClasses()[0];
      expect(classDecl.getExtends()?.getText()).toBe('BaseService');
      
      const content = sourceFile.getText();
      expect(content).toContain('import { BaseService }');
    });

    it('should rename start/stop methods to onStart/onStop', () => {
      const project = createTestProject({
        'src/test-service.ts': `
          export class TestService {
            start(): void {
              console.log('Starting');
            }
            
            stop(): void {
              console.log('Stopping');
            }
          }
        `
      });

      const sourceFile = project.getSourceFile('src/test-service.ts')!;
      (standardizer as any).standardizeServiceLifecycle(sourceFile);

      const classDecl = sourceFile.getClasses()[0];
      expect(classDecl.getMethod('onStart')).toBeDefined();
      expect(classDecl.getMethod('onStop')).toBeDefined();
      expect(classDecl.getMethod('start')).toBeUndefined();
      expect(classDecl.getMethod('stop')).toBeUndefined();
      
      // Check if methods are protected
      expect(classDecl.getMethod('onStart')?.getScope()).toBe('protected');
      expect(classDecl.getMethod('onStop')?.getScope()).toBe('protected');
    });

    it('should add constructor with super call', () => {
      const project = createTestProject({
        'src/test-service.ts': `
          export class TestService {
            start(): void {}
          }
        `
      });

      const sourceFile = project.getSourceFile('src/test-service.ts')!;
      (standardizer as any).standardizeServiceLifecycle(sourceFile);

      const classDecl = sourceFile.getClasses()[0];
      const constructor = classDecl.getConstructors()[0];
      
      expect(constructor).toBeDefined();
      expect(constructor.getText()).toContain("super('TestService')");
    });

    it('should not modify non-service classes', () => {
      const project = createTestProject({
        'src/user.ts': `
          export class User {
            start(): void {}
          }
        `
      });

      const sourceFile = project.getSourceFile('src/user.ts')!;
      const modified = (standardizer as any).standardizeServiceLifecycle(sourceFile);

      expect(modified).toBe(false);
    });

    it('should not modify services already extending BaseService', () => {
      const project = createTestProject({
        'src/user-service.ts': `
          import { BaseService } from '@/services/base';
          
          export class UserService extends BaseService {
            protected onStart(): void {}
          }
        `
      });

      const sourceFile = project.getSourceFile('src/user-service.ts')!;
      const modified = (standardizer as any).standardizeServiceLifecycle(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('import ordering standardization', () => {
    it('should reorder imports correctly', () => {
      const project = createTestProject({
        'src/service.ts': UNORDERED_IMPORTS
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeImports(sourceFile);

      expect(modified).toBe(true);
      
      const content = sourceFile.getText();
      const imports = content.split('\n').filter(line => line.startsWith('import'));
      
      // Node imports should come first
      expect(imports[0]).toContain('* as fs');
      expect(imports[1]).toContain('* as path');
      
      // External imports should be after node imports
      expect(imports.find(imp => imp.includes('react'))).toBeDefined();
      
      // Internal imports (@/) should come after external
      expect(imports.find(imp => imp.includes('@/services'))).toBeDefined();
      
      // Relative imports should come last
      expect(imports.find(imp => imp.includes('./types'))).toBeDefined();
    });

    it('should not modify already correctly ordered imports', () => {
      const project = createTestProject({
        'src/service.ts': `
          import * as fs from 'fs';
          import { Component } from 'react';
          import { BaseService } from '@/services/base';
          import { User } from './types/user';
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeImports(sourceFile);

      expect(modified).toBe(false);
    });

    it('should handle files with no imports', () => {
      const project = createTestProject({
        'src/constants.ts': 'export const TEST = "test";'
      });

      const sourceFile = project.getSourceFile('src/constants.ts')!;
      const modified = (standardizer as any).standardizeImports(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('naming conventions standardization', () => {
    it('should remove I prefix from interfaces', () => {
      const project = createTestProject({
        'src/interfaces.ts': INTERFACE_WITH_I_PREFIX
      });

      const sourceFile = project.getSourceFile('src/interfaces.ts')!;
      const modified = (standardizer as any).standardizeNaming(sourceFile);

      expect(modified).toBe(true);
      
      const interfaces = sourceFile.getInterfaces();
      expect(interfaces[0].getName()).toBe('User');
      expect(interfaces[1].getName()).toBe('UserService');
    });

    it('should standardize service class names', () => {
      const project = createTestProject({
        'src/service.ts': `
          export class UserSRV {
            getData() {}
          }
          
          export class PaymentServiceClass {
            process() {}
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeNaming(sourceFile);

      expect(modified).toBe(true);
      
      const classes = sourceFile.getClasses();
      expect(classes[0].getName()).toBe('UserService');
      expect(classes[1].getName()).toBe('PaymentService');
    });

    it('should not modify correctly named entities', () => {
      const project = createTestProject({
        'src/service.ts': `
          export interface User {
            id: string;
          }
          
          export class UserService {
            getData() {}
          }
        `
      });

      const sourceFile = project.getSourceFile('src/service.ts')!;
      const modified = (standardizer as any).standardizeNaming(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('optional chaining standardization', () => {
    it('should replace null checks with optional chaining', () => {
      const project = createTestProject({
        'src/utils.ts': NO_OPTIONAL_CHAINING
      });

      const sourceFile = project.getSourceFile('src/utils.ts')!;
      const modified = (standardizer as any).standardizeOptionalChaining(sourceFile);

      expect(modified).toBe(true);
      
      const content = sourceFile.getText();
      expect(content).toContain('user?.profile');
      expect(content).toContain('obj?.data');
    });

    it('should not modify code already using optional chaining', () => {
      const project = createTestProject({
        'src/utils.ts': `
          export function getUserEmail(user: any): string | undefined {
            return user?.profile?.email?.toLowerCase();
          }
        `
      });

      const sourceFile = project.getSourceFile('src/utils.ts')!;
      const modified = (standardizer as any).standardizeOptionalChaining(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('type assertions standardization', () => {
    it('should replace angle bracket assertions with as keyword', () => {
      const project = createTestProject({
        'src/utils.ts': OLD_TYPE_ASSERTION
      });

      const sourceFile = project.getSourceFile('src/utils.ts')!;
      const modified = (standardizer as any).standardizeTypeAssertions(sourceFile);

      expect(modified).toBe(true);
      
      const content = sourceFile.getText();
      expect(content).toContain('data as User');
      expect(content).toContain('user as User');
      expect(content).not.toContain('<User>');
    });

    it('should not modify code already using as assertions', () => {
      const project = createTestProject({
        'src/utils.ts': `
          export function parseUserData(data: any): User {
            return data as User;
          }
        `
      });

      const sourceFile = project.getSourceFile('src/utils.ts')!;
      const modified = (standardizer as any).standardizeTypeAssertions(sourceFile);

      expect(modified).toBe(false);
    });
  });

  describe('utility methods', () => {
    describe('shouldProcessFile', () => {
      it('should process regular TypeScript files', () => {
        const project = createTestProject({
          'src/service.ts': 'export class Service {}'
        });
        
        const sourceFile = project.getSourceFile('src/service.ts')!;
        const shouldProcess = (standardizer as any).shouldProcessFile(sourceFile);
        
        expect(shouldProcess).toBe(true);
      });

      it('should skip test files', () => {
        const project = createTestProject({
          'src/service.test.ts': 'export const test = true;'
        });
        
        const sourceFile = project.getSourceFile('src/service.test.ts')!;
        const shouldProcess = (standardizer as any).shouldProcessFile(sourceFile);
        
        expect(shouldProcess).toBe(false);
      });

      it('should skip spec files', () => {
        const project = createTestProject({
          'src/service.spec.ts': 'export const test = true;'
        });
        
        const sourceFile = project.getSourceFile('src/service.spec.ts')!;
        const shouldProcess = (standardizer as any).shouldProcessFile(sourceFile);
        
        expect(shouldProcess).toBe(false);
      });

      it('should skip declaration files', () => {
        const project = createTestProject({
          'src/types.d.ts': 'declare const global: any;'
        });
        
        const sourceFile = project.getSourceFile('src/types.d.ts')!;
        const shouldProcess = (standardizer as any).shouldProcessFile(sourceFile);
        
        expect(shouldProcess).toBe(false);
      });
    });

    describe('ensureImport', () => {
      it('should add new import when none exists', () => {
        const project = createTestProject({
          'src/service.ts': 'export class Service {}'
        });

        const sourceFile = project.getSourceFile('src/service.ts')!;
        (standardizer as any).ensureImport(sourceFile, 'AppError', '@/errors');

        const imports = sourceFile.getImportDeclarations();
        const appErrorImport = imports.find(imp => 
          imp.getModuleSpecifierValue() === '@/errors'
        );
        
        expect(appErrorImport).toBeDefined();
        expect(appErrorImport?.getNamedImports().some(
          imp => imp.getName() === 'AppError'
        )).toBe(true);
      });

      it('should add to existing import from same module', () => {
        const project = createTestProject({
          'src/service.ts': `
            import { BaseError } from '@/errors';
            export class Service {}
          `
        });

        const sourceFile = project.getSourceFile('src/service.ts')!;
        (standardizer as any).ensureImport(sourceFile, 'AppError', '@/errors');

        const imports = sourceFile.getImportDeclarations();
        const errorsImport = imports.find(imp => 
          imp.getModuleSpecifierValue() === '@/errors'
        );
        
        const namedImports = errorsImport?.getNamedImports().map(imp => imp.getName());
        expect(namedImports).toContain('BaseError');
        expect(namedImports).toContain('AppError');
      });

      it('should not add duplicate imports', () => {
        const project = createTestProject({
          'src/service.ts': `
            import { AppError } from '@/errors';
            export class Service {}
          `
        });

        const sourceFile = project.getSourceFile('src/service.ts')!;
        (standardizer as any).ensureImport(sourceFile, 'AppError', '@/errors');

        const imports = sourceFile.getImportDeclarations();
        const errorsImport = imports.find(imp => 
          imp.getModuleSpecifierValue() === '@/errors'
        );
        
        const namedImports = errorsImport?.getNamedImports();
        expect(namedImports).toHaveLength(1);
        expect(namedImports?.[0].getName()).toBe('AppError');
      });
    });

    describe('toPascalCase', () => {
      it('should convert snake_case to PascalCase', () => {
        const result = (standardizer as any).toPascalCase('USER_ROLES');
        expect(result).toBe('UserRoles');
      });

      it('should handle single words', () => {
        const result = (standardizer as any).toPascalCase('ADMIN');
        expect(result).toBe('Admin');
      });

      it('should handle multiple underscores', () => {
        const result = (standardizer as any).toPascalCase('API_RESPONSE_CODES');
        expect(result).toBe('ApiResponseCodes');
      });
    });

    describe('logging', () => {
      it('should log changes to internal array', () => {
        const project = createTestProject({
          'src/test.ts': 'export const test = true;'
        });

        const sourceFile = project.getSourceFile('src/test.ts')!;
        (standardizer as any).log(sourceFile, 'Test change');

        const changesLog = (standardizer as any).changesLog;
        expect(changesLog).toContain('[src/test.ts] Test change');
      });
    });
  });

  describe('generateReviewReport', () => {
    it('should identify complex promise chains', async () => {
      const project = createTestProject({
        'src/service.ts': `
          export function complexChain() {
            return api.getData()
              .then(data => validate(data))
              .then(validated => transform(validated))
              .then(transformed => save(transformed))
              .then(saved => notify(saved));
          }
        `
      });

      (standardizer as any).project = project;

      await standardizer.generateReviewReport();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'manual-review-required.md',
        expect.stringContaining('Complex Promise Chains')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'manual-review-required.md',
        expect.stringContaining('complexChain() has 4 .then() calls')
      );
    });

    it('should identify non-standard services', async () => {
      const project = createTestProject({
        'src/user-service.ts': `
          export class UserService {
            getData() { return []; }
            processData() { return null; }
          }
        `
      });

      (standardizer as any).project = project;

      await standardizer.generateReviewReport();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'manual-review-required.md',
        expect.stringContaining('Non-Standard Services')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'manual-review-required.md',
        expect.stringContaining('UserService')
      );
    });

    it('should not flag services with standard methods', async () => {
      const project = createTestProject({
        'src/user-service.ts': `
          export class UserService {
            protected onStart() {}
            protected onStop() {}
            getData() { return []; }
          }
        `
      });

      (standardizer as any).project = project;

      await standardizer.generateReviewReport();

      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0] === 'manual-review-required.md'
      );

      // Should still create the report but not flag this service
      expect(writeCall).toBeDefined();
      expect(writeCall?.[1]).toContain('Non-Standard Services (0)');
    });
  });

  describe('error handling', () => {
    it('should handle files that cannot be processed', async () => {
      const project = createTestProject({
        'src/invalid.ts': 'this is not valid typescript {'
      });

      (standardizer as any).project = project;

      // Should not throw an error
      await expect(standardizer.standardizeProject()).resolves.not.toThrow();
    });

    it('should handle empty projects', async () => {
      const project = createTestProject({});
      (standardizer as any).project = project;

      await standardizer.standardizeProject();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Modified 0 files total')
      );
    });
  });

  describe('changes log', () => {
    it('should save changes log when changes are made', async () => {
      const project = createTestProject({
        'src/service.ts': `
          export function test() {
            throw 'error';
          }
        `
      });

      (standardizer as any).project = project;

      await standardizer.standardizeProject();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'standardization-log.md',
        expect.stringContaining('Pattern Standardization Log')
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'standardization-log.md',
        expect.stringContaining('Total changes:')
      );
    });

    it('should not save log when no changes are made', () => {
      const project = createTestProject({
        'src/service.ts': 'export const perfect = true;'
      });

      (standardizer as any).project = project;
      (standardizer as any).saveChangesLog();

      expect(mockFs.writeFileSync).not.toHaveBeenCalledWith(
        'standardization-log.md',
        expect.any(String)
      );
    });
  });
});