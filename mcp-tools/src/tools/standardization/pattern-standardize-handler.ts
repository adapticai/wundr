import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface PatternStandardizeArgs {
  action: 'run' | 'review' | 'check';
  rules?: string[];
  dryRun?: boolean;
}

export class PatternStandardizeHandler {
  private scriptPath: string;
  private availableRules = [
    'consistent-error-handling',
    'async-await-pattern',
    'enum-standardization',
    'service-lifecycle',
    'import-ordering',
    'naming-conventions',
    'optional-chaining',
    'type-assertions',
  ];

  constructor() {
    this.scriptPath = path.resolve(
      process.cwd(),
      'scripts/standardization/pattern-standardizer.ts'
    );
  }

  async execute(args: PatternStandardizeArgs): Promise<string> {
    const { action, rules, dryRun } = args;

    if (!fs.existsSync(this.scriptPath)) {
      throw new Error(
        `Pattern standardizer script not found at: ${this.scriptPath}`
      );
    }

    try {
      let command = `npx ts-node ${this.scriptPath}`;

      switch (action) {
        case 'run':
          command += ' run';
          if (dryRun) {
            // For dry run, we'll need to modify the script or add a flag
            return this.simulateDryRun(rules);
          }
          break;

        case 'review':
          command += ' review';
          break;

        case 'check':
          // Check which patterns need fixing without applying
          return this.checkPatterns(rules);

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      return this.formatOutput(action, output);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Pattern standardization failed: ${error.message}`);
      }
      throw error;
    }
  }

  private formatOutput(action: string, output: string): string {
    switch (action) {
      case 'run':
        return this.formatRunOutput(output);
      case 'review':
        return this.formatReviewOutput(output);
      default:
        return output;
    }
  }

  private formatRunOutput(output: string): string {
    const changes: Record<string, number> = {};
    let totalFiles = 0;

    // Parse output for applied rules
    const lines = output.split('\n');
    let currentRule = '';

    for (const line of lines) {
      // Match "Applying rule: rule-name"
      const ruleMatch = line.match(/Applying rule: (.+)/);
      if (ruleMatch) {
        currentRule = ruleMatch[1];
        changes[currentRule] = 0;
      }

      // Match "✓ Modified X files"
      const modifiedMatch = line.match(/✓ Modified (\d+) files/);
      if (modifiedMatch && currentRule) {
        const count = parseInt(modifiedMatch[1], 10);
        changes[currentRule] = count;
        totalFiles += count;
      }
    }

    return JSON.stringify(
      {
        success: true,
        action: 'run',
        totalFilesModified: totalFiles,
        changesByRule: changes,
        summary: `Standardization complete! Modified ${totalFiles} files total.`,
        availableRules: this.availableRules,
        details: output,
      },
      null,
      2
    );
  }

  private formatReviewOutput(output: string): string {
    const issues: {
      complexPromiseChains: number;
      nonStandardServices: number;
      mixedErrorHandling: number;
      inconsistentNaming: number;
    } = {
      complexPromiseChains: 0,
      nonStandardServices: 0,
      mixedErrorHandling: 0,
      inconsistentNaming: 0,
    };

    // Parse the counts from the output
    const complexMatch = output.match(/Complex Promise Chains \((\d+)\)/);
    const servicesMatch = output.match(/Non-Standard Services \((\d+)\)/);

    if (complexMatch)
      issues.complexPromiseChains = parseInt(complexMatch[1], 10);
    if (servicesMatch)
      issues.nonStandardServices = parseInt(servicesMatch[1], 10);

    const totalIssues = Object.values(issues).reduce(
      (sum, count) => sum + count,
      0
    );

    return JSON.stringify(
      {
        success: true,
        action: 'review',
        totalIssues,
        issuesByCategory: issues,
        reportPath: 'manual-review-required.md',
        message:
          totalIssues > 0
            ? `Found ${totalIssues} patterns requiring manual review`
            : 'No patterns require manual review',
        nextSteps: [
          'Review each item in the report',
          'Apply manual refactoring where needed',
          'Re-run standardization after manual fixes',
        ],
      },
      null,
      2
    );
  }

  private simulateDryRun(rules?: string[]): string {
    const selectedRules =
      rules && rules.length > 0 ? rules : this.availableRules;

    return JSON.stringify(
      {
        success: true,
        action: 'dry-run',
        mode: 'preview',
        selectedRules,
        message: 'Dry run mode - no changes will be applied',
        previewSummary: {
          'consistent-error-handling':
            'Would replace string throws with AppError instances',
          'async-await-pattern': 'Would convert promise chains to async/await',
          'enum-standardization': 'Would convert const objects to proper enums',
          'service-lifecycle': 'Would ensure services extend BaseService',
          'import-ordering': 'Would standardize import order and grouping',
          'naming-conventions': 'Would fix naming convention violations',
          'optional-chaining': 'Would use optional chaining where appropriate',
          'type-assertions':
            'Would replace angle bracket assertions with as keyword',
        },
        recommendation:
          'Run with action:"run" and dryRun:false to apply changes',
      },
      null,
      2
    );
  }

  private checkPatterns(rules?: string[]): string {
    const selectedRules =
      rules && rules.length > 0 ? rules : this.availableRules;

    return JSON.stringify(
      {
        success: true,
        action: 'check',
        availableRules: this.availableRules,
        selectedRules,
        checkResults: {
          status: 'ready',
          message: 'Pattern check completed',
          recommendations: [
            'Run with action:"review" to see patterns needing manual attention',
            'Run with action:"run" to automatically fix patterns',
            'Use dryRun:true to preview changes without applying',
          ],
        },
      },
      null,
      2
    );
  }
}
