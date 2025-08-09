#!/usr/bin/env node
// scripts/pattern-standardizer.ts

import { Project, SourceFile, ClassDeclaration, Node, SyntaxKind, ts } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

interface StandardizationRule {
  name: string;
  description: string;
  apply: (sourceFile: SourceFile) => boolean;
}

export class PatternStandardizer {
  private project: Project;
  private rules: StandardizationRule[] = [];
  private changesLog: string[] = [];

  constructor() {
    this.project = new Project({
      tsConfigFilePath: './tsconfig.json',
      addFilesFromTsConfig: true
    });

    this.initializeRules();
  }

  /**
   * Initialize all standardization rules
   */
  private initializeRules() {
    this.rules = [
      {
        name: 'consistent-error-handling',
        description: 'Replace string throws with AppError instances',
        apply: this.standardizeErrorHandling.bind(this)
      },
      {
        name: 'async-await-pattern',
        description: 'Convert promise chains to async/await',
        apply: this.standardizeAsyncAwait.bind(this)
      },
      {
        name: 'enum-standardization',
        description: 'Convert const objects to proper enums',
        apply: this.standardizeEnums.bind(this)
      },
      {
        name: 'service-lifecycle',
        description: 'Ensure services extend BaseService',
        apply: this.standardizeServiceLifecycle.bind(this)
      },
      {
        name: 'import-ordering',
        description: 'Standardize import order and grouping',
        apply: this.standardizeImports.bind(this)
      },
      {
        name: 'naming-conventions',
        description: 'Fix naming convention violations',
        apply: this.standardizeNaming.bind(this)
      },
      {
        name: 'optional-chaining',
        description: 'Use optional chaining where appropriate',
        apply: this.standardizeOptionalChaining.bind(this)
      },
      {
        name: 'type-assertions',
        description: 'Replace angle bracket assertions with as keyword',
        apply: this.standardizeTypeAssertions.bind(this)
      }
    ];
  }

  /**
   * Apply all standardization rules to the project
   */
  async standardizeProject() {
    console.log('🔧 Starting pattern standardization...\n');

    const sourceFiles = this.project.getSourceFiles();
    let totalChanges = 0;

    for (const rule of this.rules) {
      console.log(`Applying rule: ${rule.name}`);
      let ruleChanges = 0;

      for (const sourceFile of sourceFiles) {
        if (this.shouldProcessFile(sourceFile)) {
          const hasChanges = rule.apply(sourceFile);
          if (hasChanges) {
            ruleChanges++;
            await sourceFile.save();
          }
        }
      }

      if (ruleChanges > 0) {
        console.log(`  ✓ Modified ${ruleChanges} files`);
        totalChanges += ruleChanges;
      } else {
        console.log(`  - No changes needed`);
      }
    }

    // Save changes log
    this.saveChangesLog();

    console.log(`\n✅ Standardization complete! Modified ${totalChanges} files total.`);
  }

  /**
   * Rule: Standardize error handling
   */
  private standardizeErrorHandling(sourceFile: SourceFile): boolean {
    let modified = false;

    // Find all throw statements
    sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).forEach(throwStmt => {
      const expression = throwStmt.getExpression();

      // Check if throwing a string literal
      if (expression && Node.isStringLiteral(expression)) {
        const errorMessage = expression.getLiteralValue();

        // Replace with AppError
        throwStmt.replaceWithText(
          `throw new AppError('${errorMessage}', 'GENERAL_ERROR')`
        );

        // Ensure AppError is imported
        this.ensureImport(sourceFile, 'AppError', '@/errors');

        modified = true;
        this.log(sourceFile, `Replaced string throw: "${errorMessage}"`);
      }

      // Check if throwing new Error()
      if (expression && Node.isNewExpression(expression)) {
        const expressionText = expression.getExpression().getText();
        if (expressionText === 'Error') {
          const args = expression.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            const errorMessage = args[0].getText();

            throwStmt.replaceWithText(
              `throw new AppError(${errorMessage}, 'GENERAL_ERROR')`
            );

            this.ensureImport(sourceFile, 'AppError', '@/errors');
            modified = true;
            this.log(sourceFile, 'Replaced Error with AppError');
          }
        }
      }
    });

    return modified;
  }

  /**
   * Rule: Convert promise chains to async/await
   */
  private standardizeAsyncAwait(sourceFile: SourceFile): boolean {
    let modified = false;

    // Find functions that return promises but aren't async
    sourceFile.getFunctions().forEach(func => {
      const returnType = func.getReturnType();
      const returnTypeText = returnType.getText();

      if (returnTypeText.includes('Promise<') && !func.isAsync()) {
        // Check if body contains .then() chains
        const body = func.getBody();
        if (body && body.getText().includes('.then(')) {
          // Make function async
          func.setIsAsync(true);

          // TODO: Complex transformation of promise chains to await
          // This is a simplified version
          modified = true;
          this.log(sourceFile, `Made function ${func.getName()} async`);
        }
      }
    });

    return modified;
  }

  /**
   * Rule: Standardize enums
   */
  private standardizeEnums(sourceFile: SourceFile): boolean {
    let modified = false;

    // Find const objects that should be enums
    sourceFile.getVariableDeclarations().forEach(varDecl => {
      const name = varDecl.getName();
      const initializer = varDecl.getInitializer();

      // Check if it's a const object with all string values
      if (
        name.match(/^[A-Z_]+$/) && // ALL_CAPS name
        initializer &&
        Node.isObjectLiteralExpression(initializer)
      ) {
        const properties = initializer.getProperties();
        const isEnumLike = properties.every(prop => {
          if (Node.isPropertyAssignment(prop)) {
            const value = prop.getInitializer();
            return value && Node.isStringLiteral(value);
          }
          return false;
        });

        if (isEnumLike) {
          // Convert to enum
          const enumName = this.toPascalCase(name);
          const enumMembers = properties.map(prop => {
            if (Node.isPropertyAssignment(prop)) {
              const key = prop.getName();
              const value = prop.getInitializer()?.getText() || `'${key}'`;
              return `  ${key} = ${value}`;
            }
            return '';
          }).filter(Boolean).join(',\n');

          const enumCode = `export enum ${enumName} {\n${enumMembers}\n}`;

          // Replace the const with enum
          const statement = varDecl.getVariableStatement();
          if (statement) {
            statement.replaceWithText(enumCode);
            modified = true;
            this.log(sourceFile, `Converted const ${name} to enum ${enumName}`);
          }
        }
      }
    });

    return modified;
  }

  /**
   * Rule: Standardize service lifecycle
   */
  private standardizeServiceLifecycle(sourceFile: SourceFile): boolean {
    let modified = false;

    sourceFile.getClasses().forEach(classDecl => {
      const className = classDecl.getName();

      // Check if it's a service class
      if (className && className.endsWith('Service')) {
        const extendsClause = classDecl.getExtends();

        // If not extending BaseService
        if (!extendsClause || extendsClause.getText() !== 'BaseService') {
          // Check if it has start/stop methods
          const hasStart = classDecl.getMethod('start');
          const hasStop = classDecl.getMethod('stop');

          if (hasStart || hasStop) {
            // Make it extend BaseService
            classDecl.setExtends('BaseService');
            this.ensureImport(sourceFile, 'BaseService', '@/services/base');

            // Convert start/stop to onStart/onStop
            if (hasStart) {
              hasStart.rename('onStart');
              hasStart.setScope('protected');
            }

            if (hasStop) {
              hasStop.rename('onStop');
              hasStop.setScope('protected');
            }

            // Add constructor if missing
            if (!classDecl.getConstructors().length) {
              classDecl.insertConstructor(0, {
                statements: `super('${className}');`
              });
            }

            modified = true;
            this.log(sourceFile, `Standardized service: ${className}`);
          }
        }
      }
    });

    return modified;
  }

  /**
   * Rule: Standardize imports
   */
  private standardizeImports(sourceFile: SourceFile): boolean {
    const imports = sourceFile.getImportDeclarations();
    if (imports.length === 0) return false;

    // Group imports
    const nodeImports: string[] = [];
    const externalImports: string[] = [];
    const internalImports: string[] = [];
    const relativeImports: string[] = [];

    imports.forEach(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const importText = imp.getText();

      if (moduleSpecifier.startsWith('node:') || ['fs', 'path', 'crypto'].includes(moduleSpecifier)) {
        nodeImports.push(importText);
      } else if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('@/')) {
        externalImports.push(importText);
      } else if (moduleSpecifier.startsWith('@/')) {
        internalImports.push(importText);
      } else {
        relativeImports.push(importText);
      }
    });

    // Sort each group
    nodeImports.sort();
    externalImports.sort();
    internalImports.sort();
    relativeImports.sort();

    // Build new import section
    const newImports = [
      ...nodeImports,
      ...(nodeImports.length && externalImports.length ? [''] : []),
      ...externalImports,
      ...(externalImports.length && internalImports.length ? [''] : []),
      ...internalImports,
      ...(internalImports.length && relativeImports.length ? [''] : []),
      ...relativeImports
    ].join('\n');

    // Get the current imports text
    const firstImport = imports[0];
    const lastImport = imports[imports.length - 1];
    const currentImportsText = sourceFile.getText().substring(
      firstImport.getStart(),
      lastImport.getEnd()
    );

    // Only modify if order changed
    if (currentImportsText !== newImports) {
      // Remove all imports
      imports.forEach(imp => imp.remove());

      // Add new imports at the top
      sourceFile.insertText(0, newImports + '\n\n');

      this.log(sourceFile, 'Reordered imports');
      return true;
    }

    return false;
  }

  /**
   * Rule: Fix naming conventions
   */
  private standardizeNaming(sourceFile: SourceFile): boolean {
    let modified = false;

    // Fix interface names (remove I prefix)
    sourceFile.getInterfaces().forEach(iface => {
      const name = iface.getName();
      if (name.startsWith('I') && name[1] === name[1].toUpperCase()) {
        const newName = name.substring(1);
        iface.rename(newName);
        modified = true;
        this.log(sourceFile, `Renamed interface ${name} to ${newName}`);
      }
    });

    // Fix service names (ensure Service suffix)
    sourceFile.getClasses().forEach(classDecl => {
      const name = classDecl.getName();
      if (name && name.toLowerCase().includes('service') && !name.endsWith('Service')) {
        const newName = name.replace(/[Ss]ervice/, '') + 'Service';
        classDecl.rename(newName);
        modified = true;
        this.log(sourceFile, `Renamed class ${name} to ${newName}`);
      }
    });

    return modified;
  }

  /**
   * Rule: Use optional chaining
   */
  private standardizeOptionalChaining(sourceFile: SourceFile): boolean {
    let modified = false;

    // Find patterns like: obj && obj.prop && obj.prop.nested
    sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach(binExpr => {
      const operator = binExpr.getOperatorToken().getText();

      if (operator === '&&') {
        const left = binExpr.getLeft();
        const right = binExpr.getRight();

        // Check if it's a null check pattern
        if (Node.isIdentifier(left) && Node.isPropertyAccessExpression(right)) {
          const rightObj = right.getExpression();
          if (Node.isIdentifier(rightObj) && rightObj.getText() === left.getText()) {
            // Replace with optional chaining
            const replacement = `${left.getText()}?.${right.getName()}`;
            binExpr.replaceWithText(replacement);
            modified = true;
            this.log(sourceFile, `Applied optional chaining: ${replacement}`);
          }
        }
      }
    });

    return modified;
  }

  /**
   * Rule: Standardize type assertions
   */
  private standardizeTypeAssertions(sourceFile: SourceFile): boolean {
    let modified = false;

    // Find <Type> assertions and replace with 'as Type'
    sourceFile.getDescendantsOfKind(SyntaxKind.TypeAssertionExpression).forEach(assertion => {
      const type = assertion.getType().getText();
      const expression = assertion.getExpression().getText();

      assertion.replaceWithText(`${expression} as ${type}`);
      modified = true;
      this.log(sourceFile, `Replaced <${type}> with 'as ${type}'`);
    });

    return modified;
  }

  /**
   * Utility methods
   */

  private shouldProcessFile(sourceFile: SourceFile): boolean {
    const filePath = sourceFile.getFilePath();
    return !filePath.includes('node_modules') &&
      !filePath.includes('.test.') &&
      !filePath.includes('.spec.') &&
      !filePath.endsWith('.d.ts');
  }

  private ensureImport(sourceFile: SourceFile, namedImport: string, moduleSpecifier: string) {
    const existingImport = sourceFile.getImportDeclaration(
      imp => imp.getModuleSpecifierValue() === moduleSpecifier
    );

    if (existingImport) {
      // Check if already imports this name
      const hasImport = existingImport.getNamedImports().some(
        imp => imp.getName() === namedImport
      );

      if (!hasImport) {
        existingImport.addNamedImport(namedImport);
      }
    } else {
      // Add new import at the top
      sourceFile.insertImportDeclaration(0, {
        namedImports: [namedImport],
        moduleSpecifier
      });
    }
  }

  private toPascalCase(str: string): string {
    return str.split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  private log(sourceFile: SourceFile, message: string) {
    const logEntry = `[${sourceFile.getFilePath()}] ${message}`;
    this.changesLog.push(logEntry);
  }

  private saveChangesLog() {
    if (this.changesLog.length > 0) {
      const logContent = `# Pattern Standardization Log

Generated: ${new Date().toISOString()}

## Changes Applied:

${this.changesLog.map(log => `- ${log}`).join('\n')}

## Summary:
- Total changes: ${this.changesLog.length}
`;

      fs.writeFileSync('standardization-log.md', logContent);
    }
  }

  /**
   * Generate a report of patterns that need manual review
   */
  async generateReviewReport() {
    const report: any = {
      complexPromiseChains: [],
      nonStandardServices: [],
      mixedErrorHandling: [],
      inconsistentNaming: []
    };

    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      if (!this.shouldProcessFile(sourceFile)) continue;

      // Find complex promise chains that need manual review
      sourceFile.getFunctions().forEach(func => {
        const body = func.getBody();
        if (body) {
          const text = body.getText();
          const thenCount = (text.match(/\.then\(/g) || []).length;
          if (thenCount > 2) {
            report.complexPromiseChains.push({
              file: sourceFile.getFilePath(),
              function: func.getName() || 'anonymous',
              thenCount
            });
          }
        }
      });

      // Find services not following standard pattern
      sourceFile.getClasses().forEach(classDecl => {
        const name = classDecl.getName();
        if (name && name.includes('Service')) {
          const hasStandardMethods =
            classDecl.getMethod('onStart') ||
            classDecl.getMethod('onStop');

          if (!hasStandardMethods) {
            report.nonStandardServices.push({
              file: sourceFile.getFilePath(),
              service: name
            });
          }
        }
      });
    }

    // Save report
    const reportContent = `# Manual Review Required

Generated: ${new Date().toISOString()}

## Complex Promise Chains (${report.complexPromiseChains.length})
These functions have complex promise chains that should be manually converted to async/await:

${report.complexPromiseChains.map((item: any) =>
      `- ${item.file} - ${item.function}() has ${item.thenCount} .then() calls`
    ).join('\n')}

## Non-Standard Services (${report.nonStandardServices.length})
These services don't follow the standard lifecycle pattern:

${report.nonStandardServices.map((item: any) =>
      `- ${item.file} - ${item.service}`
    ).join('\n')}

## Next Steps

1. Review each item in this report
2. Apply manual refactoring where needed
3. Re-run standardization after manual fixes
`;

    fs.writeFileSync('manual-review-required.md', reportContent);
    console.log('\n📋 Review report saved to manual-review-required.md');
  }
}

// CLI interface
if (require.main === module) {
  const standardizer = new PatternStandardizer();
  const command = process.argv[2];

  switch (command) {
    case 'run':
      standardizer.standardizeProject()
        .then(() => console.log('\n✅ Done!'))
        .catch(error => {
          console.error('❌ Standardization failed:', error);
          process.exit(1);
        });
      break;

    case 'review':
      standardizer.generateReviewReport()
        .catch(error => {
          console.error('❌ Failed to generate review report:', error);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage: pattern-standardizer.ts <command>

Commands:
  run     - Apply all standardization rules
  review  - Generate report of patterns needing manual review
      `);
  }
}
