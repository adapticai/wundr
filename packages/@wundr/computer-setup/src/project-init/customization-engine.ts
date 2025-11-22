import * as path from 'path';

import chalk from 'chalk';
import * as fs from 'fs-extra';

import { Logger } from '../utils/logger.js';

import type { TemplateContext } from '../templates/template-manager.js';

const logger = new Logger({ name: 'customization-engine' });

export interface CustomizationRule {
  id: string;
  name: string;
  description: string;
  condition: (context: TemplateContext) => boolean;
  apply: (content: string, context: TemplateContext) => string;
  priority: number;
}

export interface CustomizationProcedure {
  projectType: string;
  rules: CustomizationRule[];
  filePatterns?: string[];
  excludePatterns?: string[];
}

/**
 * Template customization engine for project-specific adaptations
 */
export class CustomizationEngine {
  private rules: Map<string, CustomizationRule[]>;
  private procedures: Map<string, CustomizationProcedure>;

  constructor() {
    this.rules = new Map();
    this.procedures = new Map();
    this.initializeRules();
    this.initializeProcedures();
  }

  /**
   * Customize content based on template context
   */
  async customize(
    content: string,
    context: TemplateContext,
    filePath?: string,
  ): Promise<string> {
    let customized = content;

    // Apply project type specific rules
    const projectRules = this.rules.get(context.project.type) || [];
    const globalRules = this.rules.get('*') || [];
    const allRules = [...globalRules, ...projectRules].sort(
      (a, b) => b.priority - a.priority,
    );

    for (const rule of allRules) {
      if (rule.condition(context)) {
        customized = rule.apply(customized, context);
      }
    }

    // Apply file-specific customizations
    if (filePath) {
      customized = await this.applyFileSpecificCustomization(
        customized,
        filePath,
        context,
      );
    }

    return customized;
  }

  /**
   * Customize entire project structure
   */
  async customizeProject(
    projectPath: string,
    context: TemplateContext,
  ): Promise<void> {
    logger.info(chalk.blue('Customizing project for type: ' + context.project.type));

    const procedure = this.procedures.get(context.project.type);
    if (!procedure) {
      logger.warn(chalk.yellow('No specific customization procedure found, using defaults'));
      return;
    }

    // Find all files to customize
    const files = await this.findFilesToCustomize(projectPath, procedure);

    for (const file of files) {
      await this.customizeFile(file, context, procedure);
    }
  }

  /**
   * Customize a single file
   */
  private async customizeFile(
    filePath: string,
    context: TemplateContext,
    _procedure: CustomizationProcedure,
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const customized = await this.customize(content, context, filePath);

      if (content !== customized) {
        await fs.writeFile(filePath, customized);
        logger.info(chalk.green(`  ✓ Customized: ${path.basename(filePath)}`));
      }
    } catch (_error) {
      logger.error(chalk.red(`  ✗ Failed to customize: ${filePath}`));
    }
  }

  /**
   * Apply file-specific customization
   */
  private async applyFileSpecificCustomization(
    content: string,
    filePath: string,
    context: TemplateContext,
  ): Promise<string> {
    const ext = path.extname(filePath);
    const basename = path.basename(filePath);

    // TypeScript/JavaScript specific
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      content = this.customizeTypeScriptFile(content, context);
    }

    // Package.json specific
    if (basename === 'package.json') {
      content = this.customizePackageJson(content, context);
    }

    // Markdown specific
    if (ext === '.md') {
      content = this.customizeMarkdown(content, context);
    }

    // YAML/Config specific
    if (['.yaml', '.yml', '.json'].includes(ext)) {
      content = this.customizeConfig(content, context);
    }

    return content;
  }

  /**
   * Customize TypeScript/JavaScript files
   */
  private customizeTypeScriptFile(content: string, context: TemplateContext): string {
    let customized = content;

    // Add project-specific imports
    if (context.project.type === 'react' || context.project.type === 'vue') {
      customized = this.addFrontendImports(customized);
    }

    // Add backend-specific imports
    if (context.project.type === 'node') {
      customized = this.addBackendImports(customized);
    }

    // Update file headers
    customized = this.updateFileHeader(customized, context);

    return customized;
  }

  /**
   * Customize package.json
   */
  private customizePackageJson(content: string, context: TemplateContext): string {
    try {
      const pkg = JSON.parse(content);

      // Update project metadata
      pkg.name = context.project.name;
      pkg.description = context.project.description;
      pkg.version = context.project.version;
      pkg.author = context.project.author;
      pkg.license = context.project.license;

      // Add project-type specific scripts
      pkg.scripts = {
        ...pkg.scripts,
        ...this.getProjectTypeScripts(context.project.type),
      };

      // Add project-type specific dependencies
      const deps = this.getProjectTypeDependencies(context.project.type);
      if (deps.dependencies) {
        pkg.dependencies = { ...pkg.dependencies, ...deps.dependencies };
      }
      if (deps.devDependencies) {
        pkg.devDependencies = { ...pkg.devDependencies, ...deps.devDependencies };
      }

      return JSON.stringify(pkg, null, 2);
    } catch (_error) {
      logger.error(chalk.red('Failed to parse package.json'));
      return content;
    }
  }

  /**
   * Customize markdown files
   */
  private customizeMarkdown(content: string, context: TemplateContext): string {
    let customized = content;

    // Replace project placeholders
    customized = customized
      .replace(/\{\{PROJECT_NAME\}\}/g, context.project.name)
      .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, context.project.description)
      .replace(/\{\{PROJECT_TYPE\}\}/g, context.project.type)
      .replace(/\{\{AUTHOR\}\}/g, context.project.author)
      .replace(/\{\{ORGANIZATION\}\}/g, context.project.organization || '');

    // Add project-type specific sections
    customized = this.addProjectTypeSections(customized, context);

    return customized;
  }

  /**
   * Customize configuration files
   */
  private customizeConfig(content: string, context: TemplateContext): string {
    let customized = content;

    // Replace configuration placeholders
    customized = customized
      .replace(/"{{PROJECT_NAME}}"/g, `"${context.project.name}"`)
      .replace(/"{{NODE_VERSION}}"/g, `"${context.platform.nodeVersion}"`)
      .replace(/"{{PACKAGE_MANAGER}}"/g, `"${context.project.packageManager}"`);

    return customized;
  }

  /**
   * Find files to customize based on procedure
   */
  private async findFilesToCustomize(
    projectPath: string,
    procedure: CustomizationProcedure,
  ): Promise<string[]> {
    const files: string[] = [];
    const patterns = procedure.filePatterns || ['**/*'];
    const excludePatterns = procedure.excludePatterns || [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
    ];

    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);

        // Check exclude patterns
        if (excludePatterns.some(pattern =>
          relativePath.includes(pattern.replace('**/', '')),
        )) {
          continue;
        }

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else {
          // Check if file matches patterns
          if (patterns.some(pattern => {
            const ext = path.extname(entry.name);
            return pattern === '**/*' ||
                   pattern.includes(ext) ||
                   entry.name.includes(pattern.replace('**/', ''));
          })) {
            files.push(fullPath);
          }
        }
      }
    }

    await scan(projectPath);
    return files;
  }

  /**
   * Initialize customization rules
   */
  private initializeRules(): void {
    // Global rules (apply to all project types)
    this.rules.set('*', [
      {
        id: 'update-metadata',
        name: 'Update Project Metadata',
        description: 'Replace project metadata placeholders',
        condition: () => true,
        apply: (content, context) => {
          return content
            .replace(/\{\{PROJECT_NAME\}\}/g, context.project.name)
            .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, context.project.description)
            .replace(/\{\{AUTHOR\}\}/g, context.project.author)
            .replace(/\{\{VERSION\}\}/g, context.project.version);
        },
        priority: 100,
      },
      {
        id: 'update-dates',
        name: 'Update Dates',
        description: 'Replace date placeholders',
        condition: () => true,
        apply: (content) => {
          const now = new Date();
          return content
            .replace(/\{\{CURRENT_YEAR\}\}/g, now.getFullYear().toString())
            .replace(/\{\{CURRENT_DATE\}\}/g, now.toISOString().split('T')[0]);
        },
        priority: 90,
      },
    ]);

    // React-specific rules
    this.rules.set('react', [
      {
        id: 'add-react-imports',
        name: 'Add React Imports',
        description: 'Add common React imports',
        condition: (context) => context.project.type === 'react',
        apply: (content) => {
          if (content.includes('export') && !content.includes('import React')) {
            return `import React from 'react';\n${content}`;
          }
          return content;
        },
        priority: 80,
      },
    ]);

    // Node.js specific rules
    this.rules.set('node', [
      {
        id: 'add-node-shebang',
        name: 'Add Node.js Shebang',
        description: 'Add shebang to executable files',
        condition: (context) => context.project.type === 'node',
        apply: (content, _context) => {
          if (content.includes('#!/usr/bin/env node')) {
            return content;
          }
          if (content.includes('async function main()')) {
            return `#!/usr/bin/env node\n${content}`;
          }
          return content;
        },
        priority: 70,
      },
    ]);

    // TypeScript specific rules
    const tsRule: CustomizationRule = {
      id: 'add-ts-strict',
      name: 'Enable TypeScript Strict Mode',
      description: 'Add strict type checking',
      condition: (context) => Boolean(context.customVariables?.TYPESCRIPT_PROJECT),
      apply: (content) => {
        if (content.includes('"compilerOptions"') && !content.includes('"strict"')) {
          return content.replace(
            /"compilerOptions"\s*:\s*\{/,
            '"compilerOptions": {\n    "strict": true,',
          );
        }
        return content;
      },
      priority: 60,
    };

    // Add TypeScript rule to multiple project types
    ['node', 'react', 'vue'].forEach(type => {
      const existing = this.rules.get(type) || [];
      this.rules.set(type, [...existing, tsRule]);
    });
  }

  /**
   * Initialize customization procedures
   */
  private initializeProcedures(): void {
    // React procedure
    this.procedures.set('react', {
      projectType: 'react',
      rules: this.rules.get('react') || [],
      filePatterns: ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js', '**/*.json', '**/*.md'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });

    // Node.js procedure
    this.procedures.set('node', {
      projectType: 'node',
      rules: this.rules.get('node') || [],
      filePatterns: ['**/*.ts', '**/*.js', '**/*.json', '**/*.md'],
      excludePatterns: ['**/node_modules/**', '**/dist/**'],
    });

    // Monorepo procedure
    this.procedures.set('monorepo', {
      projectType: 'monorepo',
      rules: this.rules.get('*') || [],
      filePatterns: ['**/*.json', '**/*.md', '**/*.yaml', '**/*.yml'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });
  }

  /**
   * Helper methods for customization
   */
  private addFrontendImports(content: string): string {
    // Add common frontend imports if not present
    return content;
  }

  private addBackendImports(content: string): string {
    // Add common backend imports if not present
    return content;
  }

  private updateFileHeader(content: string, context: TemplateContext): string {
    const header = `/**
 * ${context.project.name}
 * ${context.project.description}
 *
 * @author ${context.project.author}
 * @license ${context.project.license}
 */

`;

    if (!content.startsWith('/**')) {
      return header + content;
    }

    return content;
  }

  private getProjectTypeScripts(projectType: string): Record<string, string> {
    const scriptsMap: Record<string, Record<string, string>> = {
      react: {
        'dev': 'vite',
        'build': 'vite build',
        'preview': 'vite preview',
        'test': 'vitest',
        'lint': 'eslint src --ext ts,tsx',
        'typecheck': 'tsc --noEmit',
      },
      node: {
        'dev': 'tsx watch src/index.ts',
        'build': 'tsc',
        'start': 'node dist/index.js',
        'test': 'jest',
        'lint': 'eslint src --ext ts',
        'typecheck': 'tsc --noEmit',
      },
      monorepo: {
        'build': 'turbo run build',
        'test': 'turbo run test',
        'lint': 'turbo run lint',
        'dev': 'turbo run dev',
        'clean': 'turbo run clean',
      },
    };

    return scriptsMap[projectType] || {};
  }

  private getProjectTypeDependencies(projectType: string): {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } {
    const depsMap: Record<string, { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }> = {
      react: {
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.0.0',
          'vite': '^4.4.0',
        },
      },
      node: {
        dependencies: {
          'express': '^4.18.0',
        },
        devDependencies: {
          '@types/express': '^4.17.0',
        },
      },
    };

    return depsMap[projectType] || {};
  }

  private addProjectTypeSections(content: string, context: TemplateContext): string {
    const sections: Record<string, string> = {
      react: `
## Development

\`\`\`bash
npm run dev
\`\`\`

## Building

\`\`\`bash
npm run build
\`\`\`
`,
      node: `
## API Endpoints

See \`docs/API.md\` for complete API documentation.

## Development

\`\`\`bash
npm run dev
\`\`\`
`,
      monorepo: `
## Workspace Structure

\`\`\`
packages/
  - app/
  - shared/
  - utils/
\`\`\`
`,
    };

    const section = sections[context.project.type];
    if (section && !content.includes('## Development')) {
      return content + '\n' + section;
    }

    return content;
  }
}

export default CustomizationEngine;
