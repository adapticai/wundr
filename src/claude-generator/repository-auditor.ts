import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import type { AuditResult, ProjectStructure, QualityStandards, PackageJsonData } from './types.js';

export class RepositoryAuditor {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Comprehensive repository audit with scoring and recommendations
   */
  async auditRepository(
    structure: ProjectStructure,
    quality: QualityStandards,
    packageData: PackageJsonData | null
  ): Promise<AuditResult> {
    const issues: AuditResult['issues'] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Security audit
    const securityIssues = await this.auditSecurity(packageData);
    issues.push(...securityIssues);
    score -= securityIssues.length * 10;

    // Quality audit
    const qualityIssues = await this.auditQuality(quality, structure);
    issues.push(...qualityIssues);
    score -= qualityIssues.length * 5;

    // Structure audit
    const structureIssues = await this.auditStructure(structure);
    issues.push(...structureIssues);
    score -= structureIssues.length * 3;

    // Documentation audit
    const docIssues = await this.auditDocumentation(structure);
    issues.push(...docIssues);
    score -= docIssues.length * 2;

    // Performance audit
    const perfIssues = await this.auditPerformance(packageData, structure);
    issues.push(...perfIssues);
    score -= perfIssues.length * 5;

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(issues, structure, quality));

    return {
      score: Math.max(0, score),
      issues,
      recommendations,
      structure,
      quality
    };
  }

  private async auditSecurity(packageData: PackageJsonData | null): Promise<AuditResult['issues']> {
    const issues: AuditResult['issues'] = [];

    if (!packageData) {
      issues.push({
        severity: 'error',
        category: 'security',
        message: 'No package.json found - cannot audit dependencies',
        fix: 'Initialize project with npm init or create package.json'
      });
      return issues;
    }

    // Check for known vulnerable packages
    const vulnerablePackages = [
      'event-stream',
      'flatmap-stream',
      'lodash@<4.17.11',
      'bootstrap@<4.3.1'
    ];

    const allDeps = {
      ...packageData.dependencies,
      ...packageData.devDependencies
    };

    for (const [pkg, version] of Object.entries(allDeps)) {
      if (vulnerablePackages.some(vuln => vuln.includes(pkg))) {
        issues.push({
          severity: 'error',
          category: 'security',
          message: `Potentially vulnerable package: ${pkg}@${version}`,
          fix: 'Update to latest secure version or find alternative'
        });
      }
    }

    // Check for missing security files
    const securityFiles = ['.env.example', '.gitignore'];
    for (const file of securityFiles) {
      if (!existsSync(join(this.rootPath, file))) {
        issues.push({
          severity: 'warning',
          category: 'security',
          message: `Missing ${file} file`,
          fix: `Create ${file} with appropriate content`
        });
      }
    }

    // Check for exposed secrets
    try {
      const files = glob.sync('**/*', {
        cwd: this.rootPath,
        ignore: ['node_modules/**', '.git/**'],
        nodir: true
      });

      for (const file of files.slice(0, 50)) { // Limit to first 50 files for performance
        if (this.containsSecrets(join(this.rootPath, file))) {
          issues.push({
            severity: 'error',
            category: 'security',
            message: `Potential secrets found in ${file}`,
            fix: 'Remove secrets and use environment variables'
          });
        }
      }
    } catch {
      // Ignore glob errors
    }

    return issues;
  }

  private async auditQuality(quality: QualityStandards, structure: ProjectStructure): Promise<AuditResult['issues']> {
    const issues: AuditResult['issues'] = [];

    // Linting
    if (!quality.linting.enabled) {
      issues.push({
        severity: 'warning',
        category: 'quality',
        message: 'No linting configuration found',
        fix: 'Set up ESLint with appropriate configuration'
      });
    }

    // Type checking
    if (structure.hasTsConfig && !quality.typeChecking.enabled) {
      issues.push({
        severity: 'warning',
        category: 'quality',
        message: 'TypeScript config found but type checking not properly configured',
        fix: 'Ensure TypeScript is in dependencies and configure properly'
      });
    }

    if (quality.typeChecking.enabled && !quality.typeChecking.strict) {
      issues.push({
        severity: 'info',
        category: 'quality',
        message: 'TypeScript strict mode not enabled',
        fix: 'Enable strict mode in tsconfig.json for better type safety'
      });
    }

    // Testing
    if (!quality.testing.enabled) {
      issues.push({
        severity: 'warning',
        category: 'quality',
        message: 'No testing framework configured',
        fix: 'Set up Jest, Vitest, or another testing framework'
      });
    } else if (!structure.hasTests) {
      issues.push({
        severity: 'warning',
        category: 'quality',
        message: 'Testing framework configured but no test files found',
        fix: 'Write tests for your code'
      });
    }

    if (quality.testing.enabled && !quality.testing.coverage.enabled) {
      issues.push({
        severity: 'info',
        category: 'quality',
        message: 'Code coverage not enabled',
        fix: 'Enable code coverage reporting in your test configuration'
      });
    }

    // Formatting
    if (!quality.formatting.enabled) {
      issues.push({
        severity: 'info',
        category: 'quality',
        message: 'No code formatting tool configured',
        fix: 'Set up Prettier or another formatting tool'
      });
    }

    // Pre-commit hooks
    if (!quality.preCommitHooks.enabled) {
      issues.push({
        severity: 'info',
        category: 'quality',
        message: 'No pre-commit hooks configured',
        fix: 'Set up Husky with lint-staged for automated quality checks'
      });
    }

    return issues;
  }

  private async auditStructure(structure: ProjectStructure): Promise<AuditResult['issues']> {
    const issues: AuditResult['issues'] = [];

    // Check for basic structure
    if (!structure.hasPackageJson) {
      issues.push({
        severity: 'error',
        category: 'structure',
        message: 'No package.json found',
        fix: 'Initialize project with npm init'
      });
    }

    // Check for source directory
    const hasSourceDir = structure.directories.some(dir => 
      ['src', 'lib', 'source'].includes(dir)
    );

    if (!hasSourceDir) {
      issues.push({
        severity: 'info',
        category: 'structure',
        message: 'No dedicated source directory found',
        fix: 'Create src/ directory and organize source files'
      });
    }

    // Check for build artifacts in wrong places
    const buildArtifacts = ['dist', 'build', 'out'];
    for (const artifact of buildArtifacts) {
      if (structure.directories.includes(artifact)) {
        // This is actually good, but we should check if it's in .gitignore
        const gitignorePath = join(this.rootPath, '.gitignore');
        if (existsSync(gitignorePath)) {
          const gitignore = readFileSync(gitignorePath, 'utf-8');
          if (!gitignore.includes(artifact)) {
            issues.push({
              severity: 'warning',
              category: 'structure',
              message: `Build directory ${artifact} not in .gitignore`,
              fix: `Add ${artifact}/ to .gitignore`
            });
          }
        }
      }
    }

    return issues;
  }

  private async auditDocumentation(structure: ProjectStructure): Promise<AuditResult['issues']> {
    const issues: AuditResult['issues'] = [];

    if (!structure.hasDocumentation) {
      issues.push({
        severity: 'warning',
        category: 'documentation',
        message: 'No README.md or documentation found',
        fix: 'Create README.md with project description and usage instructions'
      });
    }

    // Check for CHANGELOG
    if (!existsSync(join(this.rootPath, 'CHANGELOG.md'))) {
      issues.push({
        severity: 'info',
        category: 'documentation',
        message: 'No CHANGELOG.md found',
        fix: 'Create CHANGELOG.md to track version changes'
      });
    }

    // Check for LICENSE
    if (!existsSync(join(this.rootPath, 'LICENSE'))) {
      issues.push({
        severity: 'info',
        category: 'documentation',
        message: 'No LICENSE file found',
        fix: 'Add appropriate LICENSE file for your project'
      });
    }

    return issues;
  }

  private async auditPerformance(
    packageData: PackageJsonData | null,
    structure: ProjectStructure
  ): Promise<AuditResult['issues']> {
    const issues: AuditResult['issues'] = [];

    if (!packageData) return issues;

    // Check for large dependencies
    const heavyPackages = [
      'lodash',
      'moment',
      'rxjs',
      'babel-polyfill'
    ];

    const deps = { ...packageData.dependencies, ...packageData.devDependencies };
    for (const pkg of heavyPackages) {
      if (deps[pkg]) {
        let fix = '';
        switch (pkg) {
          case 'lodash':
            fix = 'Consider using lodash-es or individual lodash functions';
            break;
          case 'moment':
            fix = 'Consider using date-fns or dayjs instead';
            break;
          default:
            fix = 'Evaluate if this large dependency is necessary';
        }

        issues.push({
          severity: 'info',
          category: 'performance',
          message: `Heavy dependency detected: ${pkg}`,
          fix
        });
      }
    }

    // Check for bundle size optimization
    const hasBundleAnalyzer = deps['webpack-bundle-analyzer'] || 
                              deps['@next/bundle-analyzer'] ||
                              deps['vite-bundle-analyzer'];

    if (!hasBundleAnalyzer && structure.buildTools.length > 0) {
      issues.push({
        severity: 'info',
        category: 'performance',
        message: 'No bundle analyzer configured',
        fix: 'Add bundle analyzer to monitor and optimize bundle size'
      });
    }

    return issues;
  }

  private containsSecrets(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const secretPatterns = [
        /api[_-]?key/i,
        /secret[_-]?key/i,
        /password\s*=/i,
        /token\s*=/i,
        /[A-Za-z0-9]{32,}/,  // Long strings that might be tokens
        /sk_[a-zA-Z0-9]{20,}/, // Stripe keys
        /pk_[a-zA-Z0-9]{20,}/, // Stripe public keys
      ];

      return secretPatterns.some(pattern => pattern.test(content));
    } catch {
      return false;
    }
  }

  private generateRecommendations(
    issues: AuditResult['issues'],
    structure: ProjectStructure,
    quality: QualityStandards
  ): string[] {
    const recommendations: string[] = [];

    // Priority recommendations based on issues
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (errorCount > 0) {
      recommendations.push('🚨 Fix critical errors immediately - project may not function properly');
    }

    if (warningCount > 0) {
      recommendations.push('⚠️ Address warnings to improve project quality and maintainability');
    }

    // Specific recommendations
    if (!quality.testing.enabled) {
      recommendations.push('📝 Set up comprehensive testing with Jest or Vitest');
    }

    if (!quality.linting.enabled) {
      recommendations.push('🔍 Configure ESLint for consistent code quality');
    }

    if (!quality.typeChecking.enabled && structure.hasTsConfig) {
      recommendations.push('🛡️ Enable TypeScript strict mode for better type safety');
    }

    if (!quality.preCommitHooks.enabled) {
      recommendations.push('🪝 Set up pre-commit hooks with Husky for automated quality checks');
    }

    if (!structure.hasDocumentation) {
      recommendations.push('📚 Create comprehensive documentation starting with README.md');
    }

    return recommendations;
  }
}