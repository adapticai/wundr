#!/usr/bin/env node
// scripts/standardization/auto-fix-patterns.ts

import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

interface FixRule {
  name: string;
  description: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  filePattern?: RegExp;
  examples: Array<{ before: string; after: string }>;
}

interface AutoFixReport {
  timestamp: string;
  rulesApplied: number;
  filesModified: number;
  totalFixes: number;
  fixes: Array<{
    file: string;
    rule: string;
    line: number;
    before: string;
    after: string;
  }>;
}

export class AutoFixPatterns {
  private project: Project;
  private fixRules: FixRule[] = [];
  private report: AutoFixReport;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: './tsconfig.json',
      addFilesFromTsConfig: true
    });

    this.report = {
      timestamp: new Date().toISOString(),
      rulesApplied: 0,
      filesModified: 0,
      totalFixes: 0,
      fixes: []
    };

    this.initializeRules();
  }

  /**
   * Initialize auto-fix rules
   */
  private initializeRules() {
    this.fixRules = [
      {
        name: 'console-log-removal',
        description: 'Remove console.log statements (except in tests)',
        pattern: /console\.log\([^)]*\);?/g,
        replacement: '',
        filePattern: /^(?!.*\.(test|spec)\.ts).*\.ts$/,
        examples: [
          {
            before: 'console.log("debug info");',
            after: ''
          }
        ]
      },
      {
        name: 'fix-var-declarations',
        description: 'Replace var with const/let',
        pattern: /\bvar\s+(\w+)/g,
        replacement: 'const $1',
        examples: [
          {
            before: 'var result = getData();',
            after: 'const result = getData();'
          }
        ]
      },
      {
        name: 'fix-double-equals',
        description: 'Replace == with === and != with !==',
        pattern: /([^=!])([=!])=([^=])/g,
        replacement: (match, before, operator, after) => {
          return `${before}${operator}==${after}`;
        },
        examples: [
          {
            before: 'if (value == null)',
            after: 'if (value === null)'
          },
          {
            before: 'if (value != undefined)',
            after: 'if (value !== undefined)'
          }
        ]
      },
      {
        name: 'fix-require-imports',
        description: 'Convert require() to ES6 imports',
        pattern: /const\s+(\w+)\s*=\s*require\(['"`]([^'"`]+)['"`]\);?/g,
        replacement: "import $1 from '$2';",
        examples: [
          {
            before: "const fs = require('fs');",
            after: "import fs from 'fs';"
          }
        ]
      },
      {
        name: 'fix-function-declarations',
        description: 'Convert function declarations to arrow functions for consistency',
        pattern: /function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
        replacement: 'const $1 = ($2) => {',
        filePattern: /\.(ts|js)$/,
        examples: [
          {
            before: 'function helper(param) {',
            after: 'const helper = (param) => {'
          }
        ]
      },
      {
        name: 'fix-string-concatenation',
        description: 'Replace string concatenation with template literals',
        pattern: /(['"`])((?:[^'"`\\]|\\.)*)(['"`])\s*\+\s*([^+\s][^+]*?)(?=\s*[;,\)])/g,
        replacement: (match, quote1, str1, quote2, rest) => {
          // Simple case - convert basic concatenation
          if (rest.includes("'") || rest.includes('"')) {
            return `\`${str1.replace(/\$\{/g, '\\${')}\${${rest.trim()}}\``;
          }
          return match; // Keep complex cases as-is
        },
        examples: [
          {
            before: '"Hello " + name',
            after: '`Hello ${name}`'
          }
        ]
      },
      {
        name: 'fix-array-join',
        description: 'Simplify array.join() patterns',
        pattern: /\[(.*?)\]\.join\(['"`]([^'"`]*)['"`]\)/g,
        replacement: (match, items, separator) => {
          // Only fix simple cases
          if (items.includes(',') && !items.includes('${')) {
            const itemList = items.split(',').map(s => s.trim());
            if (separator === '') {
              return `\`${itemList.join('')}\``;
            }
          }
          return match;
        },
        examples: [
          {
            before: '["a", "b", "c"].join("")',
            after: '`abc`'
          }
        ]
      },
      {
        name: 'fix-null-checks',
        description: 'Use optional chaining for null checks',
        pattern: /(\w+)\s*&&\s*\1\.(\w+)/g,
        replacement: '$1?.$2',
        examples: [
          {
            before: 'user && user.name',
            after: 'user?.name'
          }
        ]
      },
      {
        name: 'fix-undefined-checks',
        description: 'Simplify undefined checks',
        pattern: /typeof\s+(\w+)\s*!==?\s*['"`]undefined['"`]/g,
        replacement: '$1 !== undefined',
        examples: [
          {
            before: 'typeof value !== "undefined"',
            after: 'value !== undefined'
          }
        ]
      },
      {
        name: 'fix-promise-syntax',
        description: 'Convert Promise constructor to async/await where appropriate',
        pattern: /return\s+new\s+Promise\(\s*\(\s*resolve\s*,\s*reject\s*\)\s*=>\s*{/g,
        replacement: '// TODO: Convert to async/await\n  return new Promise((resolve, reject) => {',
        examples: [
          {
            before: 'return new Promise((resolve, reject) => {',
            after: '// TODO: Convert to async/await\n  return new Promise((resolve, reject) => {'
          }
        ]
      }
    ];
  }

  /**
   * Apply all auto-fix rules to the project
   */
  async applyAutoFixes(): Promise<AutoFixReport> {
    console.log('=' Starting auto-fix patterns...\n');

    const sourceFiles = this.project.getSourceFiles();
    
    for (const rule of this.fixRules) {
      console.log(`Applying rule: ${rule.name}`);
      await this.applyRule(rule, sourceFiles);
    }

    // Save all modified files
    const modifiedFiles = sourceFiles.filter(file => file.getWasSaved() === false);
    
    for (const file of modifiedFiles) {
      await file.save();
      this.report.filesModified++;
    }

    this.report.rulesApplied = this.fixRules.length;

    console.log(`\n Auto-fix complete!`);
    console.log(`  Rules applied: ${this.report.rulesApplied}`);
    console.log(`  Files modified: ${this.report.filesModified}`);
    console.log(`  Total fixes: ${this.report.totalFixes}`);

    return this.report;
  }

  /**
   * Apply a single fix rule
   */
  private async applyRule(rule: FixRule, sourceFiles: SourceFile[]): Promise<void> {
    let fixCount = 0;

    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();

      // Skip files that don't match the pattern
      if (rule.filePattern && !rule.filePattern.test(filePath)) {
        continue;
      }

      // Skip test files for certain rules
      if (rule.name === 'console-log-removal' && /\.(test|spec)\.ts$/.test(filePath)) {
        continue;
      }

      const originalText = sourceFile.getFullText();
      let modifiedText = originalText;
      let hasChanges = false;

      // Apply text-based fixes
      if (typeof rule.replacement === 'string') {
        const newText = originalText.replace(rule.pattern, rule.replacement);
        if (newText !== originalText) {
          modifiedText = newText;
          hasChanges = true;
        }
      } else if (typeof rule.replacement === 'function') {
        const newText = originalText.replace(rule.pattern, rule.replacement);
        if (newText !== originalText) {
          modifiedText = newText;
          hasChanges = true;
        }
      }

      // Count and log changes
      if (hasChanges) {
        const matches = [...originalText.matchAll(new RegExp(rule.pattern, 'gm'))];
        
        matches.forEach(match => {
          const lineNumber = this.getLineNumber(originalText, match.index || 0);
          
          this.report.fixes.push({
            file: filePath,
            rule: rule.name,
            line: lineNumber,
            before: match[0],
            after: typeof rule.replacement === 'string' 
              ? match[0].replace(rule.pattern, rule.replacement)
              : rule.replacement(match[0], ...match.slice(1))
          });
          
          fixCount++;
          this.report.totalFixes++;
        });

        sourceFile.replaceWithText(modifiedText);
      }
    }

    if (fixCount > 0) {
      console.log(`   Applied ${fixCount} fixes`);
    } else {
      console.log(`  - No changes needed`);
    }
  }

  /**
   * Get line number for a given position in text
   */
  private getLineNumber(text: string, position: number): number {
    return text.substring(0, position).split('\n').length;
  }

  /**
   * Apply specific rule by name
   */
  async applySpecificRule(ruleName: string): Promise<void> {
    const rule = this.fixRules.find(r => r.name === ruleName);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleName}`);
    }

    console.log(`=' Applying rule: ${rule.name}`);
    console.log(`Description: ${rule.description}`);

    const sourceFiles = this.project.getSourceFiles();
    await this.applyRule(rule, sourceFiles);

    // Save modified files
    const modifiedFiles = sourceFiles.filter(file => file.getWasSaved() === false);
    for (const file of modifiedFiles) {
      await file.save();
    }

    console.log(` Rule applied successfully`);
  }

  /**
   * Preview fixes without applying them
   */
  async previewFixes(): Promise<void> {
    console.log('= Previewing auto-fix patterns...\n');

    const sourceFiles = this.project.getSourceFiles();
    const preview: Array<{ rule: string; file: string; fixes: number }> = [];

    for (const rule of this.fixRules) {
      let totalFixes = 0;

      for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();

        if (rule.filePattern && !rule.filePattern.test(filePath)) {
          continue;
        }

        const text = sourceFile.getFullText();
        const matches = [...text.matchAll(new RegExp(rule.pattern, 'gm'))];
        
        if (matches.length > 0) {
          totalFixes += matches.length;
          preview.push({
            rule: rule.name,
            file: filePath,
            fixes: matches.length
          });
        }
      }

      if (totalFixes > 0) {
        console.log(`${rule.name}: ${totalFixes} potential fixes`);
      }
    }

    if (preview.length === 0) {
      console.log(' No fixes needed!');
    } else {
      console.log(`\n=Ê Total: ${preview.reduce((sum, p) => sum + p.fixes, 0)} potential fixes across ${preview.length} file-rule combinations`);
    }
  }

  /**
   * Generate fix report
   */
  generateReport(): void {
    const reportContent = `# Auto-Fix Patterns Report

Generated: ${this.report.timestamp}

## Summary
- Rules Applied: ${this.report.rulesApplied}
- Files Modified: ${this.report.filesModified}
- Total Fixes: ${this.report.totalFixes}

## Rules Applied

${this.fixRules.map(rule => `### ${rule.name}
**Description**: ${rule.description}

**Examples**:
${rule.examples.map(ex => `- **Before**: \`${ex.before}\`
- **After**: \`${ex.after}\``).join('\n')}
`).join('\n')}

## Detailed Fixes

${this.report.fixes.map(fix => `### ${fix.file}:${fix.line}
**Rule**: ${fix.rule}
- **Before**: \`${fix.before}\`
- **After**: \`${fix.after}\`
`).join('\n')}

## Next Steps

1. Review the changes made by auto-fix
2. Run tests to ensure nothing is broken
3. Commit the standardized code
4. Consider adding these patterns to your linting rules

## Custom Rules

To add custom fix rules, modify the \`initializeRules()\` method in this script.
Each rule should include:
- Pattern (RegExp)
- Replacement (string or function)
- Examples
- Optional file pattern filter
`;

    fs.writeFileSync('auto-fix-report.md', reportContent);
    console.log('\n=Ä Report saved to auto-fix-report.md');
  }

  /**
   * List available rules
   */
  listRules(): void {
    console.log('=Ë Available Auto-Fix Rules:\n');

    this.fixRules.forEach((rule, index) => {
      console.log(`${index + 1}. **${rule.name}**`);
      console.log(`   ${rule.description}`);
      console.log(`   Examples:`);
      rule.examples.forEach(ex => {
        console.log(`     Before: ${ex.before}`);
        console.log(`     After:  ${ex.after}`);
      });
      console.log('');
    });
  }

  /**
   * Validate that fixes don't break syntax
   */
  async validateFixes(): Promise<boolean> {
    console.log('= Validating fixes...');

    try {
      // Try to compile the project
      const diagnostics = this.project.getPreEmitDiagnostics();
      
      if (diagnostics.length > 0) {
        console.log('L TypeScript errors found after fixes:');
        diagnostics.forEach(diagnostic => {
          const message = diagnostic.getMessageText();
          const file = diagnostic.getSourceFile()?.getFilePath() || 'unknown';
          const line = diagnostic.getLineNumber();
          console.log(`  ${file}:${line} - ${message}`);
        });
        return false;
      }

      console.log(' All fixes validated successfully');
      return true;
    } catch (error) {
      console.error('L Validation failed:', error);
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const autoFix = new AutoFixPatterns();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'apply':
      autoFix.applyAutoFixes()
        .then(report => {
          autoFix.generateReport();
          
          // Validate fixes
          autoFix.validateFixes().then(isValid => {
            if (!isValid) {
              console.warn('  Some fixes may have introduced errors. Please review.');
            }
          });
        })
        .catch(error => {
          console.error('L Auto-fix failed:', error);
          process.exit(1);
        });
      break;

    case 'preview':
      autoFix.previewFixes()
        .catch(error => {
          console.error('L Preview failed:', error);
          process.exit(1);
        });
      break;

    case 'rule':
      if (!arg) {
        console.error('Usage: auto-fix-patterns.ts rule <rule-name>');
        process.exit(1);
      }
      autoFix.applySpecificRule(arg)
        .catch(error => {
          console.error('L Failed to apply rule:', error);
          process.exit(1);
        });
      break;

    case 'list':
      autoFix.listRules();
      break;

    case 'validate':
      autoFix.validateFixes()
        .then(isValid => {
          process.exit(isValid ? 0 : 1);
        });
      break;

    default:
      console.log(`
Usage: auto-fix-patterns.ts <command> [args]

Commands:
  apply               - Apply all auto-fix rules
  preview             - Preview potential fixes without applying
  rule <rule-name>    - Apply a specific rule only
  list                - List all available rules
  validate            - Validate that current code compiles

Examples:
  npm run auto-fix:apply              # Apply all fixes
  npm run auto-fix:preview            # See what would be fixed
  npm run auto-fix:rule console-log-removal  # Apply specific rule
      `);
  }
}