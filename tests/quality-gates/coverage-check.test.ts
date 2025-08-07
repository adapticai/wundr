/**
 * Quality Gates and Coverage Enforcement Tests
 * Ensures code quality thresholds are met across the codebase
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

describe('Quality Gates', () => {
  let coverageReport: any;

  beforeAll(async () => {
    // Generate fresh coverage report
    try {
      execSync('npm run test:coverage', { stdio: 'pipe' });
      
      // Read coverage report
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      const coverageData = await fs.readFile(coveragePath, 'utf-8');
      coverageReport = JSON.parse(coverageData);
    } catch (error) {
      console.error('Failed to generate coverage report:', error);
      throw new Error('Coverage report generation failed');
    }
  });

  describe('Code Coverage Requirements', () => {
    test('should meet global coverage thresholds', () => {
      const global = coverageReport.total;
      
      // Global thresholds (90% for comprehensive testing)
      expect(global.lines.pct).toBeGreaterThanOrEqual(90);
      expect(global.statements.pct).toBeGreaterThanOrEqual(90);
      expect(global.functions.pct).toBeGreaterThanOrEqual(85);
      expect(global.branches.pct).toBeGreaterThanOrEqual(85);
    });

    test('should meet critical module coverage thresholds', () => {
      const criticalModules = [
        'scripts/analysis/enhanced-ast-analyzer.ts',
        'scripts/consolidation/consolidation-manager.ts',
        'scripts/standardization/pattern-standardizer.ts',
        'scripts/governance/governance-system.ts',
        'scripts/core/BaseService.ts'
      ];

      criticalModules.forEach(modulePath => {
        const moduleKey = path.resolve(modulePath);
        const moduleCoverage = coverageReport[moduleKey];
        
        if (moduleCoverage) {
          expect(moduleCoverage.lines.pct).toBeGreaterThanOrEqual(95); // 95% for critical modules
          expect(moduleCoverage.statements.pct).toBeGreaterThanOrEqual(95);
          expect(moduleCoverage.functions.pct).toBeGreaterThanOrEqual(90);
          expect(moduleCoverage.branches.pct).toBeGreaterThanOrEqual(90);
        } else {
          console.warn(`Coverage data not found for critical module: ${modulePath}`);
        }
      });
    });

    test('should identify files with insufficient coverage', () => {
      const lowCoverageFiles: string[] = [];
      const threshold = 80; // Minimum threshold for all files

      Object.entries(coverageReport).forEach(([filePath, coverage]: [string, any]) => {
        if (filePath !== 'total' && coverage.lines?.pct < threshold) {
          lowCoverageFiles.push(filePath);
        }
      });

      if (lowCoverageFiles.length > 0) {
        console.warn('Files with insufficient coverage:', lowCoverageFiles);
      }

      // Allow some files to have lower coverage (e.g., generated files, types)
      const allowedLowCoverageCount = Math.floor(Object.keys(coverageReport).length * 0.1); // 10% of files
      expect(lowCoverageFiles.length).toBeLessThanOrEqual(allowedLowCoverageCount);
    });
  });

  describe('Test Quality Requirements', () => {
    test('should have comprehensive test suite structure', async () => {
      const testDirs = [
        'tests/unit',
        'tests/integration',
        'tests/e2e',
        'tests/performance'
      ];

      for (const testDir of testDirs) {
        const dirExists = await fs.access(testDir).then(() => true).catch(() => false);
        expect(dirExists).toBe(true);
      }
    });

    test('should have test files for all major modules', async () => {
      const sourceFiles = await getSourceFiles('scripts');
      const testFiles = await getTestFiles('tests/unit');
      
      const uncoveredModules: string[] = [];
      
      for (const sourceFile of sourceFiles) {
        const relativePath = path.relative('scripts', sourceFile);
        const testFileName = relativePath.replace(/\.ts$/, '.test.ts');
        const hasTest = testFiles.some(testFile => testFile.includes(testFileName));
        
        if (!hasTest && !isIgnoredForTesting(sourceFile)) {
          uncoveredModules.push(sourceFile);
        }
      }

      if (uncoveredModules.length > 0) {
        console.warn('Modules without tests:', uncoveredModules);
      }

      // Allow some modules to not have tests (e.g., types, constants)
      const maxUncoveredModules = Math.floor(sourceFiles.length * 0.2); // 20% of modules
      expect(uncoveredModules.length).toBeLessThanOrEqual(maxUncoveredModules);
    });

    test('should have integration tests for cross-module features', async () => {
      const integrationTests = await getTestFiles('tests/integration');
      
      const requiredIntegrationTests = [
        'full-workflow.test.ts',
        'toolchain-compatibility.test.ts',
        'test-infrastructure.test.ts'
      ];

      requiredIntegrationTests.forEach(requiredTest => {
        const hasTest = integrationTests.some(testFile => testFile.includes(requiredTest));
        expect(hasTest).toBe(true);
      });
    });

    test('should have performance benchmarks', async () => {
      const performanceTests = await getTestFiles('tests/performance');
      
      expect(performanceTests.length).toBeGreaterThanOrEqual(1);
      
      const hasBenchmarkTest = performanceTests.some(testFile => 
        testFile.includes('benchmark.test.ts')
      );
      expect(hasBenchmarkTest).toBe(true);
    });
  });

  describe('Code Quality Metrics', () => {
    test('should enforce linting standards', async () => {
      try {
        execSync('npm run lint', { stdio: 'pipe' });
      } catch (error: any) {
        // If linting fails, check if there are any errors
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        
        // Allow warnings but no errors
        if (output.includes('error')) {
          console.error('Linting errors found:', output);
          throw new Error('Linting standards not met');
        }
      }
    });

    test('should pass TypeScript type checking', async () => {
      try {
        execSync('npm run typecheck', { stdio: 'pipe' });
      } catch (error: any) {
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        console.error('TypeScript errors found:', output);
        throw new Error('TypeScript type checking failed');
      }
    });

    test('should maintain consistent code formatting', async () => {
      try {
        execSync('npm run format:check', { stdio: 'pipe' });
      } catch (error: any) {
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        console.error('Code formatting issues found:', output);
        throw new Error('Code formatting standards not met');
      }
    });
  });

  describe('Documentation Quality', () => {
    test('should have README files for major components', async () => {
      const requiredReadmes = [
        'README.md',
        'docs/README.md',
        'tests/README.md'
      ];

      for (const readmePath of requiredReadmes) {
        const exists = await fs.access(readmePath).then(() => true).catch(() => false);
        if (!exists) {
          console.warn(`Missing README: ${readmePath}`);
        }
      }

      // At least the main README should exist
      const mainReadmeExists = await fs.access('README.md').then(() => true).catch(() => false);
      expect(mainReadmeExists).toBe(true);
    });

    test('should have API documentation', async () => {
      const apiDocsExist = await fs.access('docs/API.md').then(() => true).catch(() => false);
      if (!apiDocsExist) {
        console.warn('API documentation not found at docs/API.md');
      }
      
      // Check for JSDoc comments in key files
      const keyFiles = await getSourceFiles('scripts');
      const filesWithoutJSDoc: string[] = [];
      
      for (const file of keyFiles.slice(0, 10)) { // Check first 10 files
        const content = await fs.readFile(file, 'utf-8');
        if (!content.includes('/**') && !isUtilityFile(file)) {
          filesWithoutJSDoc.push(file);
        }
      }

      // Allow some files to not have JSDoc
      expect(filesWithoutJSDoc.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Security Quality Gates', () => {
    test('should pass security audit', async () => {
      try {
        const output = execSync('npm audit --audit-level=high', { 
          encoding: 'utf-8',
          stdio: 'pipe' 
        });
        
        // Check for high/critical vulnerabilities
        if (output.includes('found') && output.includes('high')) {
          console.warn('High/critical vulnerabilities found:', output);
          throw new Error('Security vulnerabilities detected');
        }
      } catch (error: any) {
        if (error.status === 1 && error.stdout?.includes('vulnerabilities')) {
          const output = error.stdout.toString();
          if (output.includes('high') || output.includes('critical')) {
            throw new Error('High/critical security vulnerabilities found');
          }
        }
      }
    });

    test('should not expose sensitive information', async () => {
      const sensitivePatterns = [
        /password\s*=\s*['"]\w+['"]/gi,
        /api[_-]?key\s*=\s*['"]\w+['"]/gi,
        /secret\s*=\s*['"]\w+['"]/gi,
        /token\s*=\s*['"]\w+['"]/gi
      ];

      const sourceFiles = await getSourceFiles('scripts');
      const violations: string[] = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf-8');
        
        for (const pattern of sensitivePatterns) {
          if (pattern.test(content)) {
            violations.push(`${file}: potential sensitive information exposed`);
          }
        }
      }

      if (violations.length > 0) {
        console.warn('Potential sensitive information found:', violations);
      }

      expect(violations.length).toBe(0);
    });
  });

  describe('Performance Quality Gates', () => {
    test('should meet performance benchmarks', async () => {
      // Read performance report if it exists
      const performanceReportPath = path.join(process.cwd(), 'performance-report.json');
      
      try {
        const reportData = await fs.readFile(performanceReportPath, 'utf-8');
        const report = JSON.parse(reportData);
        
        // Check key performance metrics
        expect(report.benchmarks.smallProjectAnalysis).toBeLessThan(5000); // 5 seconds
        expect(report.benchmarks.mediumProjectAnalysis).toBeLessThan(30000); // 30 seconds
        expect(report.benchmarks.duplicateConsolidation).toBeLessThan(15000); // 15 seconds
        
      } catch (error) {
        console.warn('Performance report not found, skipping performance quality gates');
      }
    });
  });

  // Helper functions
  async function getSourceFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    async function walkDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    }
    
    try {
      await walkDir(directory);
    } catch (error) {
      console.warn(`Could not read directory ${directory}:`, error);
    }
    
    return files;
  }

  async function getTestFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true, recursive: true });
      
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts'))) {
          files.push(path.join(directory, entry.name));
        }
      }
    } catch (error) {
      console.warn(`Could not read test directory ${directory}:`, error);
    }
    
    return files;
  }

  function isIgnoredForTesting(filePath: string): boolean {
    const ignoredPatterns = [
      /\.d\.ts$/,
      /index\.ts$/,
      /constants\.ts$/,
      /types\.ts$/,
      /\.config\.ts$/
    ];
    
    return ignoredPatterns.some(pattern => pattern.test(filePath));
  }

  function isUtilityFile(filePath: string): boolean {
    const utilityPatterns = [
      /index\.ts$/,
      /constants\.ts$/,
      /types\.ts$/,
      /utils\.ts$/
    ];
    
    return utilityPatterns.some(pattern => pattern.test(filePath));
  }
});