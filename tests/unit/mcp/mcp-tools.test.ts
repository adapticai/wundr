/**
 * Comprehensive tests for MCP (Model Context Protocol) tools integration
 */

import { MCPToolsHandler } from '@/mcp/mcp-tools-handler';
import { DriftDetectionHandler } from '@/governance/drift-detection-handler';
import { PatternStandardizeHandler } from '@/standardization/pattern-standardize-handler';
import { MonorepoManageHandler } from '@/monorepo/monorepo-manage-handler';
import { TestBaselineHandler } from '@/testing/test-baseline-handler';
import { promises as fs } from 'fs';
import path from 'path';

describe('MCP Tools Integration', () => {
  let tempDir: string;
  let mcpHandler: MCPToolsHandler;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp-mcp-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    mcpHandler = new MCPToolsHandler({
      outputDir: tempDir,
      enableLogging: false
    });
    
    await mcpHandler.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Drift Detection MCP Tool', () => {
    test('should create drift baseline through MCP interface', async () => {
      await createSampleProject(tempDir);
      
      const driftHandler = new DriftDetectionHandler();
      const result = await driftHandler.handle('create_baseline', {
        path: tempDir,
        baseline_name: 'test-baseline'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.baseline_created).toBe(true);
      expect(result.data.files_analyzed).toBeGreaterThan(0);
      
      // Verify baseline file exists
      const baselineExists = await fs.access(
        path.join(tempDir, '.wundr-baseline.json')
      ).then(() => true).catch(() => false);
      
      expect(baselineExists).toBe(true);
    });

    test('should detect drift through MCP interface', async () => {
      await createSampleProject(tempDir);
      
      const driftHandler = new DriftDetectionHandler();
      
      // Create baseline
      await driftHandler.handle('create_baseline', {
        path: tempDir,
        baseline_name: 'test-baseline'
      });
      
      // Modify project
      await fs.appendFile(
        path.join(tempDir, 'src/index.ts'),
        '\n// This is a modification to test drift detection\n'
      );
      
      // Detect drift
      const result = await driftHandler.handle('detect_drift', {
        path: tempDir,
        baseline_name: 'test-baseline'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.drift_detected).toBe(true);
      expect(result.data.changes).toHaveLength.greaterThan(0);
      expect(result.data.changes[0]).toHaveProperty('file');
      expect(result.data.changes[0]).toHaveProperty('type');
    });

    test('should show drift trends through MCP interface', async () => {
      await createSampleProject(tempDir);
      
      const driftHandler = new DriftDetectionHandler();
      
      // Create multiple baselines over time
      for (let i = 0; i < 3; i++) {
        await driftHandler.handle('create_baseline', {
          path: tempDir,
          baseline_name: `baseline-${i}`,
          timestamp: Date.now() + (i * 1000)
        });
        
        // Make changes between baselines
        await fs.appendFile(
          path.join(tempDir, 'src/index.ts'),
          `\n// Change ${i}\n`
        );
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const result = await driftHandler.handle('show_trends', {
        path: tempDir,
        time_range: '1h'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.trends).toBeDefined();
      expect(result.data.trends).toHaveLength.greaterThan(0);
    });
  });

  describe('Pattern Standardization MCP Tool', () => {
    test('should standardize error handling patterns', async () => {
      await createProjectWithPatternIssues(tempDir);
      
      const patternHandler = new PatternStandardizeHandler();
      const result = await patternHandler.handle('standardize_patterns', {
        path: tempDir,
        patterns: ['error-handling'],
        dry_run: false
      });
      
      expect(result.success).toBe(true);
      expect(result.data.fixes_applied).toBeGreaterThan(0);
      expect(result.data.patterns_fixed).toContain('error-handling');
      
      // Verify that string throws were replaced
      const fileContent = await fs.readFile(
        path.join(tempDir, 'src/ErrorHandler.ts'),
        'utf-8'
      );
      expect(fileContent).not.toContain('throw \'');
      expect(fileContent).toContain('throw new Error(');
    });

    test('should fix import ordering', async () => {
      await createProjectWithImportIssues(tempDir);
      
      const patternHandler = new PatternStandardizeHandler();
      const result = await patternHandler.handle('standardize_patterns', {
        path: tempDir,
        patterns: ['import-ordering'],
        dry_run: false
      });
      
      expect(result.success).toBe(true);
      expect(result.data.fixes_applied).toBeGreaterThan(0);
      
      // Verify import ordering
      const fileContent = await fs.readFile(
        path.join(tempDir, 'src/ImportsTest.ts'),
        'utf-8'
      );
      
      const lines = fileContent.split('\n').filter(line => line.trim().startsWith('import'));
      expect(lines).toHaveOrderedImports();
    });

    test('should review patterns needing attention', async () => {
      await createProjectWithPatternIssues(tempDir);
      
      const patternHandler = new PatternStandardizeHandler();
      const result = await patternHandler.handle('review_patterns', {
        path: tempDir,
        pattern_types: ['all']
      });
      
      expect(result.success).toBe(true);
      expect(result.data.patterns_found).toBeGreaterThan(0);
      expect(result.data.issues).toBeDefined();
      expect(result.data.issues).toHaveLength.greaterThan(0);
      expect(result.data.issues[0]).toHaveProperty('file');
      expect(result.data.issues[0]).toHaveProperty('pattern');
      expect(result.data.issues[0]).toHaveProperty('suggestion');
    });
  });

  describe('Monorepo Management MCP Tool', () => {
    test('should initialize monorepo structure', async () => {
      const monorepoHandler = new MonorepoManageHandler();
      const result = await monorepoHandler.handle('init_monorepo', {
        path: tempDir,
        workspace_type: 'npm',
        packages_dir: 'packages'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.monorepo_initialized).toBe(true);
      
      // Verify monorepo structure
      const packageJsonExists = await fs.access(
        path.join(tempDir, 'package.json')
      ).then(() => true).catch(() => false);
      
      const packagesExists = await fs.access(
        path.join(tempDir, 'packages')
      ).then(() => true).catch(() => false);
      
      expect(packageJsonExists).toBe(true);
      expect(packagesExists).toBe(true);
    });

    test('should add new package to monorepo', async () => {
      const monorepoHandler = new MonorepoManageHandler();
      
      // Initialize monorepo first
      await monorepoHandler.handle('init_monorepo', {
        path: tempDir,
        workspace_type: 'npm'
      });
      
      // Add new package
      const result = await monorepoHandler.handle('add_package', {
        path: tempDir,
        package_name: 'test-package',
        package_type: 'library'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.package_created).toBe(true);
      expect(result.data.package_path).toContain('test-package');
      
      // Verify package was created
      const packagePath = path.join(tempDir, 'packages', 'test-package');
      const packageExists = await fs.access(packagePath).then(() => true).catch(() => false);
      expect(packageExists).toBe(true);
      
      const packageJsonExists = await fs.access(
        path.join(packagePath, 'package.json')
      ).then(() => true).catch(() => false);
      expect(packageJsonExists).toBe(true);
    });

    test('should check for circular dependencies', async () => {
      await createMonorepoWithCircularDeps(tempDir);
      
      const monorepoHandler = new MonorepoManageHandler();
      const result = await monorepoHandler.handle('check_circular_deps', {
        path: tempDir
      });
      
      expect(result.success).toBe(true);
      expect(result.data.circular_dependencies_found).toBe(true);
      expect(result.data.cycles).toBeDefined();
      expect(result.data.cycles).toHaveLength.greaterThan(0);
    });
  });

  describe('Test Baseline MCP Tool', () => {
    test('should create coverage baseline', async () => {
      await createSampleProject(tempDir);
      await createBasicTests(tempDir);
      
      const testHandler = new TestBaselineHandler();
      const result = await testHandler.handle('create_baseline', {
        path: tempDir,
        baseline_type: 'coverage'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.baseline_created).toBe(true);
      expect(result.data.coverage_data).toBeDefined();
      
      // Verify baseline file
      const baselineExists = await fs.access(
        path.join(tempDir, '.test-baseline.json')
      ).then(() => true).catch(() => false);
      expect(baselineExists).toBe(true);
    });

    test('should compare against baseline', async () => {
      await createSampleProject(tempDir);
      await createBasicTests(tempDir);
      
      const testHandler = new TestBaselineHandler();
      
      // Create baseline
      await testHandler.handle('create_baseline', {
        path: tempDir,
        baseline_type: 'coverage'
      });
      
      // Modify tests to reduce coverage
      await fs.writeFile(
        path.join(tempDir, 'src/NewUncoveredFile.ts'),
        'export class NewUncoveredClass { untested() { return true; } }'
      );
      
      // Compare against baseline
      const result = await testHandler.handle('compare_baseline', {
        path: tempDir,
        baseline_type: 'coverage'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.comparison).toBeDefined();
      expect(result.data.coverage_change).toBeLessThan(0); // Coverage should have dropped
    });

    test('should update test metrics', async () => {
      await createSampleProject(tempDir);
      await createBasicTests(tempDir);
      
      const testHandler = new TestBaselineHandler();
      const result = await testHandler.handle('update_metrics', {
        path: tempDir,
        metrics_type: 'all'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.metrics_updated).toBe(true);
      expect(result.data.test_count).toBeGreaterThan(0);
      expect(result.data.coverage_percentage).toBeDefined();
    });
  });

  describe('MCP Error Handling and Edge Cases', () => {
    test('should handle invalid tool requests', async () => {
      const result = await mcpHandler.handleToolRequest('invalid_tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Unknown tool');
    });

    test('should validate tool parameters', async () => {
      const driftHandler = new DriftDetectionHandler();
      const result = await driftHandler.handle('create_baseline', {
        // Missing required 'path' parameter
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('path');
    });

    test('should handle file system errors gracefully', async () => {
      const driftHandler = new DriftDetectionHandler();
      const result = await driftHandler.handle('create_baseline', {
        path: '/nonexistent/path/that/does/not/exist'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle concurrent tool requests', async () => {
      await createSampleProject(tempDir);
      
      const driftHandler = new DriftDetectionHandler();
      
      // Execute multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        driftHandler.handle('create_baseline', {
          path: tempDir,
          baseline_name: `concurrent-baseline-${i}`
        })
      );
      
      const results = await Promise.all(promises);
      
      // All requests should complete (some might fail due to file conflicts, but they should handle it gracefully)
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('data');
      });
      
      // At least one should succeed
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  // Helper functions
  async function createSampleProject(dir: string) {
    const files = [
      {
        path: 'src/index.ts',
        content: 'export { UserService } from "./UserService"; export * from "./types";'
      },
      {
        path: 'src/UserService.ts',
        content: `
export class UserService {
  private users: any[] = [];
  
  getUsers() {
    return this.users;
  }
  
  addUser(user: any) {
    this.users.push(user);
  }
}`
      },
      {
        path: 'src/types.ts',
        content: 'export interface User { id: string; name: string; }'
      },
      {
        path: 'package.json',
        content: JSON.stringify({ name: 'test-project', version: '1.0.0' })
      }
    ];

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  async function createProjectWithPatternIssues(dir: string) {
    const content = `
export class ErrorHandler {
  handle(error: any) {
    if (typeof error === 'string') {
      throw 'String error: ' + error; // Issue: string throw
    }
    
    return fetch('/api/handle')
      .then(response => response.json())  // Issue: promise chain
      .catch(err => {
        throw 'Handling failed'; // Issue: string throw
      });
  }
}`;

    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    await fs.writeFile(path.join(dir, 'src/ErrorHandler.ts'), content);
  }

  async function createProjectWithImportIssues(dir: string) {
    const content = `
import { UserService } from './services/UserService';
import * as fs from 'fs';
import { Component } from 'react';
import path from 'path';
import { helper } from '../utils/helper';

export class ImportsTest {
  test() {
    return true;
  }
}`;

    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    await fs.writeFile(path.join(dir, 'src/ImportsTest.ts'), content);
  }

  async function createMonorepoWithCircularDeps(dir: string) {
    const packages = [
      {
        name: 'package-a',
        dependencies: { 'package-b': '1.0.0' }
      },
      {
        name: 'package-b',
        dependencies: { 'package-c': '1.0.0' }
      },
      {
        name: 'package-c',
        dependencies: { 'package-a': '1.0.0' }
      }
    ];

    await fs.mkdir(path.join(dir, 'packages'), { recursive: true });

    for (const pkg of packages) {
      const pkgDir = path.join(dir, 'packages', pkg.name);
      await fs.mkdir(pkgDir, { recursive: true });
      
      const packageJson = {
        name: pkg.name,
        version: '1.0.0',
        dependencies: pkg.dependencies
      };
      
      await fs.writeFile(
        path.join(pkgDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    }

    // Root package.json for monorepo
    const rootPackageJson = {
      name: 'test-monorepo',
      private: true,
      workspaces: ['packages/*']
    };

    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2)
    );
  }

  async function createBasicTests(dir: string) {
    const testContent = `
import { UserService } from '../src/UserService';

describe('UserService', () => {
  test('should create instance', () => {
    const service = new UserService();
    expect(service).toBeDefined();
  });
  
  test('should add users', () => {
    const service = new UserService();
    service.addUser({ id: '1', name: 'Test' });
    
    const users = service.getUsers();
    expect(users).toHaveLength(1);
  });
});`;

    await fs.mkdir(path.join(dir, 'tests'), { recursive: true });
    await fs.writeFile(path.join(dir, 'tests/UserService.test.ts'), testContent);
    
    // Jest config
    const jestConfig = {
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/*.test.ts'],
      collectCoverageFrom: ['src/**/*.ts']
    };
    
    await fs.writeFile(
      path.join(dir, 'jest.config.json'),
      JSON.stringify(jestConfig, null, 2)
    );
  }
});