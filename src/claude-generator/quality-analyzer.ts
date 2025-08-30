import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PackageJsonData, QualityStandards, ProjectStructure } from './types.js';

export class QualityAnalyzer {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Analyze quality standards and tooling configuration
   */
  async analyzeQualityStandards(
    packageData: PackageJsonData | null,
    structure: ProjectStructure
  ): Promise<QualityStandards> {
    const standards: QualityStandards = {
      linting: await this.analyzeLinting(packageData),
      typeChecking: await this.analyzeTypeChecking(packageData, structure),
      testing: await this.analyzeTesting(packageData, structure),
      formatting: await this.analyzeFormatting(packageData),
      preCommitHooks: await this.analyzePreCommitHooks(packageData)
    };

    return standards;
  }

  private async analyzeLinting(packageData: PackageJsonData | null): Promise<QualityStandards['linting']> {
    const linting: QualityStandards['linting'] = {
      enabled: false,
      configs: [],
      rules: []
    };

    if (!packageData) return linting;

    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    // Check for ESLint
    if (deps.eslint) {
      linting.enabled = true;
      linting.configs.push('ESLint');

      // Check for specific ESLint configs
      const eslintConfigs = [
        '@typescript-eslint/eslint-plugin',
        'eslint-config-airbnb',
        'eslint-config-standard',
        'eslint-config-prettier',
        'eslint-plugin-react',
        'eslint-plugin-vue',
        '@next/eslint-config-next',
        'eslint-config-next'
      ];

      for (const config of eslintConfigs) {
        if (deps[config]) {
          linting.configs.push(config);
        }
      }

      // Read ESLint rules if config exists
      const eslintConfigFiles = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml'];
      for (const configFile of eslintConfigFiles) {
        if (existsSync(join(this.rootPath, configFile))) {
          try {
            // This is a simplified approach - in practice, you'd want to parse the config properly
            linting.rules.push(`Configuration found in ${configFile}`);
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }

    // Check for other linters
    if (deps.tslint) {
      linting.enabled = true;
      linting.configs.push('TSLint (deprecated)');
    }

    return linting;
  }

  private async analyzeTypeChecking(
    packageData: PackageJsonData | null,
    structure: ProjectStructure
  ): Promise<QualityStandards['typeChecking']> {
    const typeChecking: QualityStandards['typeChecking'] = {
      enabled: false,
      strict: false,
      configs: []
    };

    if (!packageData) return typeChecking;

    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    // Check for TypeScript
    if (deps.typescript || structure.hasTsConfig) {
      typeChecking.enabled = true;
      typeChecking.configs.push('TypeScript');

      // Read tsconfig.json to check for strict mode
      if (existsSync(join(this.rootPath, 'tsconfig.json'))) {
        try {
          const tsConfig = JSON.parse(readFileSync(join(this.rootPath, 'tsconfig.json'), 'utf-8'));
          if (tsConfig.compilerOptions?.strict === true) {
            typeChecking.strict = true;
          }
          
          // Check for other strict options
          const strictOptions = ['strictNullChecks', 'strictFunctionTypes', 'noImplicitAny', 'noImplicitReturns'];
          const hasStrictOptions = strictOptions.some(option => 
            tsConfig.compilerOptions?.[option] === true
          );
          
          if (hasStrictOptions) {
            typeChecking.strict = true;
          }

          typeChecking.configs.push('tsconfig.json');
        } catch {
          // Ignore parsing errors
        }
      }
    }

    // Check for Flow
    if (deps['flow-bin']) {
      typeChecking.enabled = true;
      typeChecking.configs.push('Flow');
    }

    return typeChecking;
  }

  private async analyzeTesting(
    packageData: PackageJsonData | null,
    structure: ProjectStructure
  ): Promise<QualityStandards['testing']> {
    const testing: QualityStandards['testing'] = {
      enabled: false,
      frameworks: [],
      coverage: {
        enabled: false,
        threshold: undefined
      }
    };

    if (!packageData) return testing;

    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    // Check for test frameworks
    const testFrameworks = {
      'jest': 'Jest',
      'vitest': 'Vitest',
      'mocha': 'Mocha',
      'jasmine': 'Jasmine',
      '@testing-library/react': 'React Testing Library',
      '@testing-library/vue': 'Vue Testing Library',
      'cypress': 'Cypress',
      '@playwright/test': 'Playwright',
      'puppeteer': 'Puppeteer'
    };

    for (const [dep, framework] of Object.entries(testFrameworks)) {
      if (deps[dep]) {
        testing.enabled = true;
        testing.frameworks.push(framework);
      }
    }

    // Check for coverage tools
    const coverageTools = ['jest', 'nyc', 'c8', 'vitest'];
    testing.coverage.enabled = coverageTools.some(tool => deps[tool]);

    // Check Jest configuration for coverage threshold
    if (deps.jest && packageData.jest?.coverageThreshold?.global?.lines) {
      testing.coverage.threshold = packageData.jest.coverageThreshold.global.lines;
    }

    // Check if there are actual test files
    if (testing.enabled && !structure.hasTests) {
      testing.enabled = false; // Has testing frameworks but no test files
    }

    return testing;
  }

  private async analyzeFormatting(packageData: PackageJsonData | null): Promise<QualityStandards['formatting']> {
    const formatting: QualityStandards['formatting'] = {
      enabled: false,
      tools: []
    };

    if (!packageData) return formatting;

    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    // Check for formatting tools
    if (deps.prettier) {
      formatting.enabled = true;
      formatting.tools.push('Prettier');
    }

    if (deps.eslint && deps['eslint-plugin-prettier']) {
      formatting.tools.push('ESLint + Prettier');
    }

    if (deps['standard']) {
      formatting.enabled = true;
      formatting.tools.push('JavaScript Standard Style');
    }

    return formatting;
  }

  private async analyzePreCommitHooks(packageData: PackageJsonData | null): Promise<QualityStandards['preCommitHooks']> {
    const preCommitHooks: QualityStandards['preCommitHooks'] = {
      enabled: false,
      hooks: []
    };

    if (!packageData) return preCommitHooks;

    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    // Check for pre-commit hook tools
    if (deps.husky) {
      preCommitHooks.enabled = true;
      preCommitHooks.hooks.push('Husky');
    }

    if (deps['lint-staged']) {
      preCommitHooks.hooks.push('lint-staged');
    }

    if (deps['pre-commit']) {
      preCommitHooks.enabled = true;
      preCommitHooks.hooks.push('pre-commit');
    }

    // Check for lint-staged configuration
    if (packageData['lint-staged']) {
      preCommitHooks.hooks.push('lint-staged configuration');
    }

    return preCommitHooks;
  }
}