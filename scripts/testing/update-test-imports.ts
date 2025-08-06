#!/usr/bin/env node
// scripts/testing/update-test-imports.ts

import { Project, SourceFile, ImportDeclaration } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

interface ImportMapping {
  from: string;
  to: string;
  pattern: RegExp;
  replacement: string;
}

interface TestImportReport {
  timestamp: string;
  filesScanned: number;
  filesModified: number;
  importsUpdated: number;
  mappingsApplied: number;
  details: Array<{
    file: string;
    oldImport: string;
    newImport: string;
    mapping: string;
  }>;
}

export class TestImportsUpdater {
  private project: Project;
  private report: TestImportReport;
  private mappings: ImportMapping[] = [];

  constructor() {
    this.project = new Project({
      tsConfigFilePath: './tsconfig.json',
      addFilesFromTsConfig: false
    });

    // Add test files specifically
    this.project.addSourceFilesAtPaths([
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'tests/**/*.ts',
      '__tests__/**/*.ts'
    ]);

    this.report = {
      timestamp: new Date().toISOString(),
      filesScanned: 0,
      filesModified: 0,
      importsUpdated: 0,
      mappingsApplied: 0,
      details: []
    };

    this.initializeCommonMappings();
  }

  /**
   * Initialize common import mappings for refactoring scenarios
   */
  private initializeCommonMappings() {
    this.mappings = [
      // Convert relative imports to absolute paths
      {
        from: '../src/',
        to: '@/',
        pattern: /^\.\.\/src\/(.+)$/,
        replacement: '@/$1'
      },
      {
        from: '../../src/',
        to: '@/',
        pattern: /^\.\.\/\.\.\/src\/(.+)$/,
        replacement: '@/$1'
      },
      {
        from: '../../../src/',
        to: '@/',
        pattern: /^\.\.\/\.\.\/\.\.\/src\/(.+)$/,
        replacement: '@/$1'
      },

      // Convert to monorepo package imports
      {
        from: '../types/',
        to: '@company/core-types',
        pattern: /^\.\.\/types\/(.*)$/,
        replacement: '@company/core-types'
      },
      {
        from: '../errors/',
        to: '@company/errors',
        pattern: /^\.\.\/errors\/(.*)$/,
        replacement: '@company/errors'
      },
      {
        from: '../utils/',
        to: '@company/utils',
        pattern: /^\.\.\/utils\/(.*)$/,
        replacement: '@company/utils'
      },
      {
        from: '../services/',
        to: '@company/services',
        pattern: /^\.\.\/services\/(.*)$/,
        replacement: '@company/services'
      },
      {
        from: '../models/',
        to: '@company/models',
        pattern: /^\.\.\/models\/(.*)$/,
        replacement: '@company/models'
      },

      // Common test utilities
      {
        from: '../test-utils/',
        to: '@/test-utils',
        pattern: /^\.\.\/test-utils\/(.*)$/,
        replacement: '@/test-utils/$1'
      },
      {
        from: '../../test-utils/',
        to: '@/test-utils',
        pattern: /^\.\.\/\.\.\/test-utils\/(.*)$/,
        replacement: '@/test-utils/$1'
      },

      // Mock imports
      {
        from: '../mocks/',
        to: '@/mocks',
        pattern: /^\.\.\/mocks\/(.*)$/,
        replacement: '@/mocks/$1'
      },
      {
        from: '__mocks__/',
        to: '@/mocks',
        pattern: /^__mocks__\/(.*)$/,
        replacement: '@/mocks/$1'
      }
    ];
  }

  /**
   * Add custom import mapping
   */
  addMapping(from: string, to: string): void {
    const pattern = new RegExp(`^${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.*)$`);
    this.mappings.push({
      from,
      to,
      pattern,
      replacement: to + '$1'
    });
  }

  /**
   * Update all test file imports
   */
  async updateTestImports(): Promise<TestImportReport> {
    console.log('= Updating test imports...\n');

    const testFiles = this.project.getSourceFiles();
    this.report.filesScanned = testFiles.length;

    if (testFiles.length === 0) {
      console.log('� No test files found. Make sure test files exist in:');
      console.log('  - src/**/*.test.ts');
      console.log('  - src/**/*.spec.ts');
      console.log('  - tests/**/*.ts');
      console.log('  - __tests__/**/*.ts');
      return this.report;
    }

    console.log(`Found ${testFiles.length} test files to process...\n`);

    for (const testFile of testFiles) {
      const modified = await this.updateFileImports(testFile);
      if (modified) {
        this.report.filesModified++;
        await testFile.save();
      }
    }

    this.report.mappingsApplied = this.mappings.length;

    console.log(`\n Test import update complete!`);
    console.log(`  Files scanned: ${this.report.filesScanned}`);
    console.log(`  Files modified: ${this.report.filesModified}`);
    console.log(`  Imports updated: ${this.report.importsUpdated}`);

    return this.report;
  }

  /**
   * Update imports in a single file
   */
  private async updateFileImports(sourceFile: SourceFile): Promise<boolean> {
    const filePath = sourceFile.getFilePath();
    let hasChanges = false;

    const importDeclarations = sourceFile.getImportDeclarations();

    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const updatedSpecifier = this.applyMappings(moduleSpecifier);

      if (updatedSpecifier !== moduleSpecifier) {
        // Log the change
        this.report.details.push({
          file: filePath,
          oldImport: moduleSpecifier,
          newImport: updatedSpecifier,
          mapping: this.findAppliedMapping(moduleSpecifier)
        });

        // Update the import
        importDecl.setModuleSpecifier(updatedSpecifier);
        hasChanges = true;
        this.report.importsUpdated++;

        console.log(`  ${path.basename(filePath)}: ${moduleSpecifier} � ${updatedSpecifier}`);
      }
    }

    // Also check for dynamic imports
    const dynamicImports = sourceFile.getDescendantsOfKind(40); // SyntaxKind.CallExpression
    
    for (const callExpr of dynamicImports) {
      if (callExpr.getExpression().getText() === 'import') {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          if (firstArg.getKind() === 10) { // StringLiteral
            const moduleSpecifier = firstArg.getText().slice(1, -1); // Remove quotes
            const updatedSpecifier = this.applyMappings(moduleSpecifier);

            if (updatedSpecifier !== moduleSpecifier) {
              firstArg.replaceWithText(`'${updatedSpecifier}'`);
              hasChanges = true;
              this.report.importsUpdated++;

              this.report.details.push({
                file: filePath,
                oldImport: `import('${moduleSpecifier}')`,
                newImport: `import('${updatedSpecifier}')`,
                mapping: this.findAppliedMapping(moduleSpecifier)
              });

              console.log(`  ${path.basename(filePath)}: dynamic import('${moduleSpecifier}') � import('${updatedSpecifier}')`);
            }
          }
        }
      }
    }

    return hasChanges;
  }

  /**
   * Apply all mappings to a module specifier
   */
  private applyMappings(moduleSpecifier: string): string {
    for (const mapping of this.mappings) {
      if (mapping.pattern.test(moduleSpecifier)) {
        return moduleSpecifier.replace(mapping.pattern, mapping.replacement);
      }
    }
    return moduleSpecifier;
  }

  /**
   * Find which mapping was applied
   */
  private findAppliedMapping(moduleSpecifier: string): string {
    for (const mapping of this.mappings) {
      if (mapping.pattern.test(moduleSpecifier)) {
        return `${mapping.from} � ${mapping.to}`;
      }
    }
    return 'unknown mapping';
  }

  /**
   * Update imports for specific pattern
   */
  async updateSpecificPattern(fromPattern: string, toPattern: string): Promise<void> {
    console.log(`= Updating imports: ${fromPattern} � ${toPattern}`);

    // Add the specific mapping
    this.addMapping(fromPattern, toPattern);

    const testFiles = this.project.getSourceFiles();
    let updatedFiles = 0;

    for (const testFile of testFiles) {
      const importDeclarations = testFile.getImportDeclarations();
      let hasChanges = false;

      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        
        if (moduleSpecifier.includes(fromPattern)) {
          const newSpecifier = moduleSpecifier.replace(fromPattern, toPattern);
          importDecl.setModuleSpecifier(newSpecifier);
          hasChanges = true;

          console.log(`  ${path.basename(testFile.getFilePath())}: ${moduleSpecifier} � ${newSpecifier}`);
        }
      }

      if (hasChanges) {
        await testFile.save();
        updatedFiles++;
      }
    }

    console.log(` Updated ${updatedFiles} files`);
  }

  /**
   * Fix common test import patterns
   */
  async fixCommonPatterns(): Promise<void> {
    console.log('🔧 Fixing common test import patterns...\n');

    const testFiles = this.project.getSourceFiles();
    let totalFixes = 0;

    for (const testFile of testFiles) {
      let fixes = 0;
      const importDeclarations = testFile.getImportDeclarations();

      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();

        // Fix: Remove .ts extensions from imports
        if (moduleSpecifier.endsWith('.ts') && !moduleSpecifier.includes('.d.ts')) {
          const newSpecifier = moduleSpecifier.replace(/\.ts$/, '');
          importDecl.setModuleSpecifier(newSpecifier);
          fixes++;
        }

        // Fix: Remove index from imports
        if (moduleSpecifier.endsWith('/index')) {
          const newSpecifier = moduleSpecifier.replace(/\/index$/, '');
          importDecl.setModuleSpecifier(newSpecifier);
          fixes++;
        }

        // Fix: Normalize path separators
        if (moduleSpecifier.includes('\\')) {
          const newSpecifier = moduleSpecifier.replace(/\\/g, '/');
          importDecl.setModuleSpecifier(newSpecifier);
          fixes++;
        }
      }

      if (fixes > 0) {
        await testFile.save();
        totalFixes += fixes;
        console.log(`  Fixed ${fixes} imports in ${path.basename(testFile.getFilePath())}`);
      }
    }

    console.log(`\n Applied ${totalFixes} common pattern fixes`);
  }

  /**
   * Generate import mapping from analysis report
   */
  generateMappingsFromAnalysis(analysisReportPath: string): void {
    if (!fs.existsSync(analysisReportPath)) {
      console.warn(`Analysis report not found: ${analysisReportPath}`);
      return;
    }

    console.log('=� Generating mappings from analysis report...');

    const report = JSON.parse(fs.readFileSync(analysisReportPath, 'utf-8'));
    
    // Look for consolidated entities that moved
    if (report.duplicates) {
      report.duplicates.forEach((cluster: any) => {
        if (cluster.entities.length > 1) {
          // Assume first entity is the target, others need to be redirected
          const target = cluster.entities[0];
          
          cluster.entities.slice(1).forEach((source: any) => {
            const fromPath = this.getRelativeImportPath(source.file);
            const toPath = this.getRelativeImportPath(target.file);
            
            if (fromPath !== toPath) {
              this.addMapping(fromPath, toPath);
              console.log(`  Added mapping: ${fromPath} � ${toPath}`);
            }
          });
        }
      });
    }

    console.log(` Generated mappings from analysis report`);
  }

  /**
   * Convert file path to import path
   */
  private getRelativeImportPath(filePath: string): string {
    return filePath
      .replace(/^src\//, '@/')
      .replace(/\.ts$/, '')
      .replace(/\/index$/, '');
  }

  /**
   * Validate that all imports resolve correctly
   */
  async validateImports(): Promise<boolean> {
    console.log('= Validating test imports...');

    const testFiles = this.project.getSourceFiles();
    let hasErrors = false;

    for (const testFile of testFiles) {
      const diagnostics = testFile.getPreEmitDiagnostics();
      
      const importErrors = diagnostics.filter((d: ts.Diagnostic) => 
        d.getMessageText().toString().includes('Cannot find module') ||
        d.getMessageText().toString().includes('Module not found')
      );

      if (importErrors.length > 0) {
        hasErrors = true;
        console.log(`L Import errors in ${path.basename(testFile.getFilePath())}:`);
        
        importErrors.forEach((error: ts.Diagnostic) => {
          console.log(`  Line ${error.getLineNumber()}: ${error.getMessageText()}`);
        });
      }
    }

    if (!hasErrors) {
      console.log(' All imports validated successfully');
    }

    return !hasErrors;
  }

  /**
   * Generate report
   */
  generateReport(): void {
    const reportContent = `# Test Imports Update Report

Generated: ${this.report.timestamp}

## Summary
- Files Scanned: ${this.report.filesScanned}
- Files Modified: ${this.report.filesModified}
- Imports Updated: ${this.report.importsUpdated}
- Mappings Applied: ${this.report.mappingsApplied}

## Import Mappings Used

${this.mappings.map(m => `- \`${m.from}\` � \`${m.to}\``).join('\n')}

## Detailed Changes

${this.report.details.map(detail => `### ${path.basename(detail.file)}
**Mapping**: ${detail.mapping}
- **Before**: \`${detail.oldImport}\`
- **After**: \`${detail.newImport}\`
`).join('\n')}

## Files Modified

${[...new Set(this.report.details.map(d => d.file))].map(file => `- ${file}`).join('\n')}

## Next Steps

1. Run tests to ensure all imports work correctly
2. Check for any remaining broken imports
3. Update any hardcoded paths in test configurations
4. Consider adding path mapping to tsconfig.json for consistent imports

## Validation

Run \`npm run test:imports\` to validate all imports resolve correctly.
`;

    fs.writeFileSync('test-imports-report.md', reportContent);
    console.log('\n=� Report saved to test-imports-report.md');
  }

  /**
   * List current mappings
   */
  listMappings(): void {
    console.log('=� Current Import Mappings:\n');

    this.mappings.forEach((mapping, index) => {
      console.log(`${index + 1}. ${mapping.from} � ${mapping.to}`);
      console.log(`   Pattern: ${mapping.pattern}`);
      console.log('');
    });
  }

  /**
   * Preview import changes without applying them
   */
  async previewChanges(): Promise<void> {
    console.log('= Previewing import changes...\n');

    const testFiles = this.project.getSourceFiles();
    const preview: Array<{ file: string; changes: Array<{ from: string; to: string }> }> = [];

    for (const testFile of testFiles) {
      const changes: Array<{ from: string; to: string }> = [];
      const importDeclarations = testFile.getImportDeclarations();

      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        const updatedSpecifier = this.applyMappings(moduleSpecifier);

        if (updatedSpecifier !== moduleSpecifier) {
          changes.push({
            from: moduleSpecifier,
            to: updatedSpecifier
          });
        }
      }

      if (changes.length > 0) {
        preview.push({
          file: testFile.getFilePath(),
          changes
        });
      }
    }

    if (preview.length === 0) {
      console.log(' No changes needed!');
      return;
    }

    preview.forEach(filePreview => {
      console.log(`${path.basename(filePreview.file)}:`);
      filePreview.changes.forEach(change => {
        console.log(`  ${change.from} � ${change.to}`);
      });
      console.log('');
    });

    const totalChanges = preview.reduce((sum, p) => sum + p.changes.length, 0);
    console.log(`=� Total: ${totalChanges} import changes across ${preview.length} files`);
  }
}

// CLI interface
if (require.main === module) {
  const updater = new TestImportsUpdater();
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  switch (command) {
    case 'update':
      updater.updateTestImports()
        .then(() => {
          updater.generateReport();
          
          // Validate imports
          updater.validateImports().then(isValid => {
            if (!isValid) {
              console.warn('� Some imports may not resolve correctly. Please review.');
            }
          });
        })
        .catch(error => {
          console.error('L Update failed:', error);
          process.exit(1);
        });
      break;

    case 'pattern':
      if (!arg1 || !arg2) {
        console.error('Usage: update-test-imports.ts pattern <from-pattern> <to-pattern>');
        process.exit(1);
      }
      updater.updateSpecificPattern(arg1, arg2)
        .catch(error => {
          console.error('L Pattern update failed:', error);
          process.exit(1);
        });
      break;

    case 'fix-common':
      updater.fixCommonPatterns()
        .catch(error => {
          console.error('L Fix common patterns failed:', error);
          process.exit(1);
        });
      break;

    case 'from-analysis':
      if (!arg1) {
        console.error('Usage: update-test-imports.ts from-analysis <analysis-report.json>');
        process.exit(1);
      }
      updater.generateMappingsFromAnalysis(arg1);
      updater.updateTestImports()
        .then(() => updater.generateReport())
        .catch(error => {
          console.error('L Analysis-based update failed:', error);
          process.exit(1);
        });
      break;

    case 'preview':
      updater.previewChanges()
        .catch(error => {
          console.error('L Preview failed:', error);
          process.exit(1);
        });
      break;

    case 'validate':
      updater.validateImports()
        .then(isValid => {
          process.exit(isValid ? 0 : 1);
        });
      break;

    case 'list-mappings':
      updater.listMappings();
      break;

    default:
      console.log(`
Usage: update-test-imports.ts <command> [args]

Commands:
  update                              - Update all test imports using default mappings
  pattern <from> <to>                 - Update specific import pattern
  fix-common                          - Fix common import issues (.ts extensions, etc.)
  from-analysis <analysis-report>     - Generate mappings from analysis report
  preview                             - Preview changes without applying them
  validate                            - Validate that all imports resolve
  list-mappings                       - Show current import mappings

Examples:
  npm run test:update-imports                    # Update all test imports
  npm run test:update-imports pattern "../src" "@"  # Update specific pattern
  npm run test:update-imports fix-common         # Fix common issues
  npm run test:update-imports preview            # See what would change
      `);
  }
}