import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { glob } from 'glob';
import type { PackageJsonData, ProjectType, ProjectStructure } from './types.js';

export class ProjectDetector {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  /**
   * Detect the primary project type based on package.json and file structure
   */
  async detectProjectType(): Promise<ProjectType> {
    const packageData = await this.getPackageJsonData();
    const structure = await this.analyzeStructure();

    // Check for monorepo patterns
    if (this.isMonorepo(structure, packageData)) {
      return 'monorepo';
    }

    // Check for specific frameworks/types
    if (this.isNextJS(packageData)) {
      return 'nextjs';
    }

    if (this.isReact(packageData)) {
      return 'react';
    }

    if (this.isCLI(packageData)) {
      return 'cli';
    }

    if (this.isLibrary(packageData, structure)) {
      return 'library';
    }

    if (this.isFullStack(structure, packageData)) {
      return 'full-stack';
    }

    if (this.isTypeScript(structure, packageData)) {
      return 'typescript';
    }

    if (this.isNodeJS(packageData)) {
      return 'nodejs';
    }

    if (this.isPython(structure)) {
      return 'python';
    }

    return 'unknown';
  }

  /**
   * Analyze the project structure in detail
   */
  async analyzeStructure(): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      hasPackageJson: existsSync(join(this.rootPath, 'package.json')),
      hasTsConfig: existsSync(join(this.rootPath, 'tsconfig.json')),
      hasTests: false,
      hasDocumentation: false,
      hasCI: false,
      hasDocker: false,
      frameworks: [],
      buildTools: [],
      testFrameworks: [],
      directories: [],
      fileTypes: {}
    };

    // Check for common directories
    const commonDirs = ['src', 'lib', 'dist', 'build', 'tests', '__tests__', 'test', 'spec', 
                       'docs', 'documentation', 'examples', 'scripts', 'tools', 'packages',
                       'apps', 'components', 'pages', 'api', 'server', 'client'];
    
    for (const dir of commonDirs) {
      const fullPath = join(this.rootPath, dir);
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        structure.directories.push(dir);
      }
    }

    // Check for specific files
    structure.hasTests = this.hasTestFiles();
    structure.hasDocumentation = this.hasDocumentationFiles();
    structure.hasCI = this.hasCIFiles();
    structure.hasDocker = existsSync(join(this.rootPath, 'Dockerfile')) || 
                          existsSync(join(this.rootPath, 'docker-compose.yml'));

    // Analyze file types
    structure.fileTypes = await this.analyzeFileTypes();

    // Detect frameworks and tools
    const packageData = await this.getPackageJsonData();
    if (packageData) {
      structure.frameworks = this.detectFrameworks(packageData);
      structure.buildTools = this.detectBuildTools(packageData);
      structure.testFrameworks = this.detectTestFrameworks(packageData);
    }

    return structure;
  }

  private async getPackageJsonData(): Promise<PackageJsonData | null> {
    const packagePath = join(this.rootPath, 'package.json');
    if (!existsSync(packagePath)) {
      return null;
    }

    try {
      const content = readFileSync(packagePath, 'utf-8');
      return JSON.parse(content) as PackageJsonData;
    } catch {
      return null;
    }
  }

  private isMonorepo(structure: ProjectStructure, packageData: PackageJsonData | null): boolean {
    // Check for monorepo indicators
    if (structure.directories.includes('packages') || structure.directories.includes('apps')) {
      return true;
    }

    if (packageData) {
      // Check for common monorepo tools
      const monorepoTools = ['lerna', 'turbo', 'nx', '@nrwl/cli', 'rush'];
      const deps = { ...packageData.dependencies, ...packageData.devDependencies };
      
      if (monorepoTools.some(tool => deps[tool])) {
        return true;
      }

      // Check for workspace configuration
      if (packageData.workspaces || packageData.private) {
        return true;
      }
    }

    return false;
  }

  private isNextJS(packageData: PackageJsonData | null): boolean {
    if (!packageData) return false;
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };
    return !!deps.next;
  }

  private isReact(packageData: PackageJsonData | null): boolean {
    if (!packageData) return false;
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };
    return !!deps.react || !!deps['@types/react'];
  }

  private isCLI(packageData: PackageJsonData | null): boolean {
    if (!packageData) return false;
    return !!packageData.bin || packageData.name?.includes('cli');
  }

  private isLibrary(packageData: PackageJsonData | null, structure: ProjectStructure): boolean {
    if (!packageData) return false;
    
    // Check for library indicators
    const hasMain = !!packageData.main;
    const hasTypes = !!packageData.types || !!packageData.typings;
    const hasLibDir = structure.directories.includes('lib');
    const isPublishable = packageData.private !== true;
    
    return hasMain && (hasTypes || hasLibDir) && isPublishable;
  }

  private isFullStack(structure: ProjectStructure, packageData: PackageJsonData | null): boolean {
    const hasClientDir = structure.directories.some(dir => 
      ['client', 'frontend', 'web', 'ui'].includes(dir.toLowerCase())
    );
    const hasServerDir = structure.directories.some(dir => 
      ['server', 'backend', 'api'].includes(dir.toLowerCase())
    );

    if (packageData) {
      const deps = { ...packageData.dependencies, ...packageData.devDependencies };
      const hasServerDeps = ['express', 'fastify', 'koa', 'nestjs'].some(dep => deps[dep]);
      const hasClientDeps = ['react', 'vue', 'angular', 'svelte'].some(dep => deps[dep]);
      
      return (hasClientDir && hasServerDir) || (hasServerDeps && hasClientDeps);
    }

    return hasClientDir && hasServerDir;
  }

  private isTypeScript(structure: ProjectStructure, packageData: PackageJsonData | null): boolean {
    if (structure.hasTsConfig) return true;
    
    if (packageData) {
      const deps = { ...packageData.dependencies, ...packageData.devDependencies };
      return !!deps.typescript || !!deps['@types/node'];
    }

    return false;
  }

  private isNodeJS(packageData: PackageJsonData | null): boolean {
    return !!packageData; // If package.json exists, it's likely a Node.js project
  }

  private isPython(structure: ProjectStructure): boolean {
    const pythonFiles = ['setup.py', 'pyproject.toml', 'requirements.txt', 'Pipfile'];
    return pythonFiles.some(file => existsSync(join(this.rootPath, file)));
  }

  private hasTestFiles(): boolean {
    const testPatterns = [
      '**/*.test.{js,ts,jsx,tsx}',
      '**/*.spec.{js,ts,jsx,tsx}',
      'test/**/*',
      'tests/**/*',
      '__tests__/**/*'
    ];

    return testPatterns.some(pattern => {
      try {
        const files = glob.sync(pattern, { cwd: this.rootPath, absolute: false });
        return files.length > 0;
      } catch {
        return false;
      }
    });
  }

  private hasDocumentationFiles(): boolean {
    const docFiles = ['README.md', 'README.rst', 'docs/', 'documentation/', 'CHANGELOG.md'];
    return docFiles.some(file => existsSync(join(this.rootPath, file)));
  }

  private hasCIFiles(): boolean {
    const ciFiles = ['.github/workflows', '.gitlab-ci.yml', 'azure-pipelines.yml', 
                     '.travis.yml', '.circleci', 'Jenkinsfile'];
    return ciFiles.some(file => existsSync(join(this.rootPath, file)));
  }

  private async analyzeFileTypes(): Promise<Record<string, number>> {
    const fileTypes: Record<string, number> = {};

    try {
      const allFiles = glob.sync('**/*', { 
        cwd: this.rootPath, 
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        nodir: true 
      });

      for (const file of allFiles) {
        const ext = file.split('.').pop()?.toLowerCase();
        if (ext) {
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      }
    } catch {
      // Ignore glob errors
    }

    return fileTypes;
  }

  private detectFrameworks(packageData: PackageJsonData): string[] {
    const frameworks: string[] = [];
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    const frameworkMap = {
      'react': 'React',
      'vue': 'Vue.js',
      '@angular/core': 'Angular',
      'svelte': 'Svelte',
      'next': 'Next.js',
      'nuxt': 'Nuxt.js',
      'gatsby': 'Gatsby',
      'express': 'Express',
      'fastify': 'Fastify',
      'koa': 'Koa',
      '@nestjs/core': 'NestJS',
      'electron': 'Electron',
      'react-native': 'React Native'
    };

    for (const [dep, framework] of Object.entries(frameworkMap)) {
      if (deps[dep]) {
        frameworks.push(framework);
      }
    }

    return frameworks;
  }

  private detectBuildTools(packageData: PackageJsonData): string[] {
    const buildTools: string[] = [];
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    const buildToolMap = {
      'webpack': 'Webpack',
      'vite': 'Vite',
      'rollup': 'Rollup',
      'parcel': 'Parcel',
      'turbo': 'Turbo',
      'lerna': 'Lerna',
      '@nrwl/cli': 'Nx',
      'gulp': 'Gulp',
      'grunt': 'Grunt',
      'esbuild': 'esbuild',
      'snowpack': 'Snowpack'
    };

    for (const [dep, tool] of Object.entries(buildToolMap)) {
      if (deps[dep]) {
        buildTools.push(tool);
      }
    }

    return buildTools;
  }

  private detectTestFrameworks(packageData: PackageJsonData): string[] {
    const testFrameworks: string[] = [];
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    const testFrameworkMap = {
      'jest': 'Jest',
      'vitest': 'Vitest',
      'mocha': 'Mocha',
      'jasmine': 'Jasmine',
      'karma': 'Karma',
      '@testing-library/react': 'React Testing Library',
      '@testing-library/vue': 'Vue Testing Library',
      'cypress': 'Cypress',
      '@playwright/test': 'Playwright',
      'puppeteer': 'Puppeteer'
    };

    for (const [dep, framework] of Object.entries(testFrameworkMap)) {
      if (deps[dep]) {
        testFrameworks.push(framework);
      }
    }

    return testFrameworks;
  }
}