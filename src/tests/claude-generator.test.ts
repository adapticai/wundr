/**
 * Test suite for the Claude Generator system
 */

import { describe, it, expect, beforeEach, afterEach } from 'jest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectDetector } from '../claude-generator/project-detector.js';
import { QualityAnalyzer } from '../claude-generator/quality-analyzer.js';
import { RepositoryAuditor } from '../claude-generator/repository-auditor.js';
import { ClaudeConfigGenerator } from '../claude-generator/claude-config-generator.js';
import { TemplateEngine } from '../claude-generator/template-engine.js';

describe('Claude Generator System', () => {
  let testDir: string;
  
  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `claude-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('ProjectDetector', () => {
    it('should detect React project type', async () => {
      // Setup React project
      const packageJson = {
        name: 'test-react-app',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      mkdirSync(join(testDir, 'src/components'), { recursive: true });
      
      const detector = new ProjectDetector(testDir);
      const projectType = await detector.detectProjectType();
      
      expect(projectType).toBe('react');
    });

    it('should detect Next.js project type', async () => {
      const packageJson = {
        name: 'test-nextjs-app',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      mkdirSync(join(testDir, 'pages'), { recursive: true });
      
      const detector = new ProjectDetector(testDir);
      const projectType = await detector.detectProjectType();
      
      expect(projectType).toBe('nextjs');
    });

    it('should detect monorepo structure', async () => {
      const packageJson = {
        name: 'test-monorepo',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*'],
        devDependencies: {
          turbo: '^2.0.0'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      mkdirSync(join(testDir, 'packages/core'), { recursive: true });
      mkdirSync(join(testDir, 'packages/ui'), { recursive: true });
      
      const detector = new ProjectDetector(testDir);
      const projectType = await detector.detectProjectType();
      
      expect(projectType).toBe('monorepo');
    });

    it('should detect CLI project type', async () => {
      const packageJson = {
        name: 'test-cli',
        version: '1.0.0',
        bin: {
          'test-cli': './bin/cli.js'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      mkdirSync(join(testDir, 'bin'), { recursive: true });
      
      const detector = new ProjectDetector(testDir);
      const projectType = await detector.detectProjectType();
      
      expect(projectType).toBe('cli');
    });

    it('should analyze project structure correctly', async () => {
      const packageJson = {
        name: 'test-structure',
        version: '1.0.0',
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0',
          eslint: '^8.0.0'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDir, 'tsconfig.json'), '{}');
      writeFileSync(join(testDir, 'README.md'), '# Test Project');
      mkdirSync(join(testDir, 'src'), { recursive: true });
      mkdirSync(join(testDir, 'tests'), { recursive: true });
      writeFileSync(join(testDir, 'src/index.test.ts'), 'test');
      
      const detector = new ProjectDetector(testDir);
      const structure = await detector.analyzeStructure();
      
      expect(structure.hasPackageJson).toBe(true);
      expect(structure.hasTsConfig).toBe(true);
      expect(structure.hasTests).toBe(true);
      expect(structure.hasDocumentation).toBe(true);
      expect(structure.directories).toContain('src');
      expect(structure.directories).toContain('tests');
    });
  });

  describe('QualityAnalyzer', () => {
    it('should detect linting configuration', async () => {
      const packageJson = {
        name: 'test-quality',
        version: '1.0.0',
        devDependencies: {
          eslint: '^8.0.0',
          '@typescript-eslint/eslint-plugin': '^6.0.0',
          'eslint-config-prettier': '^9.0.0'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDir, '.eslintrc.json'), JSON.stringify({
        extends: ['@typescript-eslint/recommended', 'prettier']
      }));
      
      const analyzer = new QualityAnalyzer(testDir);
      const structure = { hasTests: false, hasTsConfig: false };
      const quality = await analyzer.analyzeQualityStandards(packageJson, structure);
      
      expect(quality.linting.enabled).toBe(true);
      expect(quality.linting.configs).toContain('ESLint');
      expect(quality.linting.configs).toContain('@typescript-eslint/eslint-plugin');
    });

    it('should detect TypeScript configuration', async () => {
      const packageJson = {
        name: 'test-typescript',
        version: '1.0.0',
        devDependencies: {
          typescript: '^5.0.0'
        }
      };
      
      const tsConfig = {
        compilerOptions: {
          strict: true,
          noImplicitAny: true,
          strictNullChecks: true
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));
      
      const analyzer = new QualityAnalyzer(testDir);
      const structure = { hasTests: false, hasTsConfig: true };
      const quality = await analyzer.analyzeQualityStandards(packageJson, structure);
      
      expect(quality.typeChecking.enabled).toBe(true);
      expect(quality.typeChecking.strict).toBe(true);
    });

    it('should detect testing frameworks', async () => {
      const packageJson = {
        name: 'test-testing',
        version: '1.0.0',
        devDependencies: {
          jest: '^29.0.0',
          '@testing-library/react': '^14.0.0',
          cypress: '^13.0.0'
        },
        jest: {
          coverageThreshold: {
            global: {
              lines: 80
            }
          }
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDir, 'src/component.test.tsx'), 'test');
      
      const analyzer = new QualityAnalyzer(testDir);
      const structure = { hasTests: true, hasTsConfig: false };
      const quality = await analyzer.analyzeQualityStandards(packageJson, structure);
      
      expect(quality.testing.enabled).toBe(true);
      expect(quality.testing.frameworks).toContain('Jest');
      expect(quality.testing.frameworks).toContain('React Testing Library');
      expect(quality.testing.frameworks).toContain('Cypress');
      expect(quality.testing.coverage.enabled).toBe(true);
      expect(quality.testing.coverage.threshold).toBe(80);
    });
  });

  describe('RepositoryAuditor', () => {
    it('should generate audit results with scoring', async () => {
      // Create a well-configured project
      const packageJson = {
        name: 'test-audit',
        version: '1.0.0',
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0',
          eslint: '^8.0.0',
          prettier: '^3.0.0',
          husky: '^9.0.0'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDir, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}');
      writeFileSync(join(testDir, 'README.md'), '# Test Project');
      writeFileSync(join(testDir, '.gitignore'), 'node_modules/');
      writeFileSync(join(testDir, 'src/index.test.ts'), 'test');
      
      const structure = {
        hasPackageJson: true,
        hasTsConfig: true,
        hasTests: true,
        hasDocumentation: true,
        hasCI: false,
        hasDocker: false,
        frameworks: [],
        buildTools: [],
        testFrameworks: ['Jest'],
        directories: ['src'],
        fileTypes: { ts: 1, md: 1 }
      };
      
      const quality = {
        linting: { enabled: true, configs: ['ESLint'], rules: [] },
        typeChecking: { enabled: true, strict: true, configs: ['TypeScript'] },
        testing: { enabled: true, frameworks: ['Jest'], coverage: { enabled: true } },
        formatting: { enabled: true, tools: ['Prettier'] },
        preCommitHooks: { enabled: true, hooks: ['Husky'] }
      };
      
      const auditor = new RepositoryAuditor(testDir);
      const result = await auditor.auditRepository(structure, quality, packageJson);
      
      expect(result.score).toBeGreaterThan(80);
      expect(result.issues).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should identify security issues', async () => {
      // Create project with security issues
      const packageJson = {
        name: 'test-security',
        version: '1.0.0',
        dependencies: {
          'event-stream': '^4.0.0' // Known vulnerable package
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDir, 'config.js'), 'const API_KEY = "sk_test_123456789";');
      
      const structure = {
        hasPackageJson: true,
        hasTsConfig: false,
        hasTests: false,
        hasDocumentation: false,
        hasCI: false,
        hasDocker: false,
        frameworks: [],
        buildTools: [],
        testFrameworks: [],
        directories: [],
        fileTypes: { js: 1 }
      };
      
      const quality = {
        linting: { enabled: false, configs: [], rules: [] },
        typeChecking: { enabled: false, strict: false, configs: [] },
        testing: { enabled: false, frameworks: [], coverage: { enabled: false } },
        formatting: { enabled: false, tools: [] },
        preCommitHooks: { enabled: false, hooks: [] }
      };
      
      const auditor = new RepositoryAuditor(testDir);
      const result = await auditor.auditRepository(structure, quality, packageJson);
      
      const securityIssues = result.issues.filter(issue => issue.category === 'security');
      expect(securityIssues.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(50);
    });
  });

  describe('ClaudeConfigGenerator', () => {
    it('should generate complete configuration for React project', async () => {
      const packageJson = {
        name: 'test-react-config',
        version: '1.0.0',
        description: 'Test React application for Claude Code',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        },
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0',
          eslint: '^8.0.0'
        },
        scripts: {
          build: 'react-scripts build',
          test: 'jest',
          lint: 'eslint src/'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDir, 'tsconfig.json'), '{}');
      mkdirSync(join(testDir, 'src/components'), { recursive: true });
      
      const generator = new ClaudeConfigGenerator(testDir);
      const config = await generator.generateConfig();
      
      expect(config.projectType).toBe('react');
      expect(config.projectMetadata.name).toBe('test-react-config');
      expect(config.projectMetadata.description).toBe('Test React application for Claude Code');
      expect(config.agentConfiguration.specializedAgents.react).toContain('ui-designer');
      expect(config.mcpTools.enabled).toBe(true);
    });

    it('should generate CLAUDE.md content', async () => {
      const packageJson = {
        name: 'test-claude-md',
        version: '1.0.0',
        description: 'Test project for CLAUDE.md generation',
        scripts: {
          build: 'tsc',
          test: 'jest',
          lint: 'eslint .'
        }
      };
      
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      
      const generator = new ClaudeConfigGenerator(testDir);
      const claudeContent = await generator.generateClaudeMarkdown();
      
      expect(claudeContent).toContain('# Claude Code Configuration');
      expect(claudeContent).toContain('test-claude-md');
      expect(claudeContent).toContain('VERIFICATION PROTOCOL');
      expect(claudeContent).toContain('Agent Configuration');
      expect(claudeContent).toContain('MCP Tools Integration');
      expect(claudeContent).toContain('npm run build');
      expect(claudeContent).toContain('npm run test');
      expect(claudeContent).toContain('npm run lint');
    });
  });

  describe('TemplateEngine', () => {
    it('should generate properly formatted CLAUDE.md content', () => {
      const mockContext = {
        project: {
          name: 'test-template-project',
          description: 'Test project for template engine',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT'
        },
        type: 'typescript' as const,
        structure: {
          hasPackageJson: true,
          hasTsConfig: true,
          hasTests: true,
          hasDocumentation: true,
          hasCI: false,
          hasDocker: false,
          frameworks: ['TypeScript'],
          buildTools: ['tsc'],
          testFrameworks: ['Jest'],
          directories: ['src', 'tests'],
          fileTypes: { ts: 10, md: 2 }
        },
        quality: {
          linting: { enabled: true, configs: ['ESLint'], rules: [] },
          typeChecking: { enabled: true, strict: true, configs: ['TypeScript'] },
          testing: { enabled: true, frameworks: ['Jest'], coverage: { enabled: true, threshold: 80 } },
          formatting: { enabled: true, tools: ['Prettier'] },
          preCommitHooks: { enabled: true, hooks: ['Husky'] }
        },
        agents: {
          agents: ['coder', 'reviewer', 'tester'],
          swarmTopology: 'mesh' as const,
          maxAgents: 6,
          specializedAgents: {
            typescript: ['type-specialist', 'compiler-expert']
          }
        },
        mcp: {
          enabled: true,
          tools: [
            {
              name: 'drift_detection',
              description: 'Monitor code quality drift',
              config: {}
            }
          ],
          autoConfiguration: true
        },
        buildCommands: ['npm run build'],
        testCommands: ['npm run test'],
        lintCommands: ['npm run lint'],
        customCommands: ['npm run custom']
      };
      
      const engine = new TemplateEngine();
      const content = engine.generateClaudeConfig(mockContext);
      
      expect(content).toContain('# Claude Code Configuration - test-template-project');
      expect(content).toContain('**Type**: TypeScript Project');
      expect(content).toContain('Test project for template engine');
      expect(content).toContain('**Version**: 1.0.0');
      expect(content).toContain('**Author**: Test Author');
      expect(content).toContain('**License**: MIT');
      expect(content).toContain('VERIFICATION PROTOCOL');
      expect(content).toContain('CONCURRENT EXECUTION');
      expect(content).toContain('Agent Configuration');
      expect(content).toContain('MCP Tools Integration');
      expect(content).toContain('drift_detection');
      expect(content).toContain('npm run build');
      expect(content).toContain('TypeScript: ✅ Enabled');
    });

    it('should handle different project types correctly', () => {
      const baseContext = {
        project: { name: 'test', description: 'test', version: '1.0.0' },
        structure: {
          hasPackageJson: true, hasTsConfig: false, hasTests: false,
          hasDocumentation: false, hasCI: false, hasDocker: false,
          frameworks: [], buildTools: [], testFrameworks: [],
          directories: [], fileTypes: {}
        },
        quality: {
          linting: { enabled: false, configs: [], rules: [] },
          typeChecking: { enabled: false, strict: false, configs: [] },
          testing: { enabled: false, frameworks: [], coverage: { enabled: false } },
          formatting: { enabled: false, tools: [] },
          preCommitHooks: { enabled: false, hooks: [] }
        },
        agents: { agents: [], swarmTopology: 'mesh' as const, maxAgents: 6, specializedAgents: {} },
        mcp: { enabled: true, tools: [], autoConfiguration: true },
        buildCommands: [], testCommands: [], lintCommands: [], customCommands: []
      };
      
      const engine = new TemplateEngine();
      
      // Test React project
      const reactContent = engine.generateClaudeConfig({
        ...baseContext,
        type: 'react'
      });
      expect(reactContent).toContain('**Type**: React Application');
      expect(reactContent).toContain('Component-based architecture');
      
      // Test monorepo project
      const monorepoContent = engine.generateClaudeConfig({
        ...baseContext,
        type: 'monorepo'
      });
      expect(monorepoContent).toContain('**Type**: Monorepo');
      expect(monorepoContent).toContain('Multiple packages managed together');
      
      // Test CLI project
      const cliContent = engine.generateClaudeConfig({
        ...baseContext,
        type: 'cli'
      });
      expect(cliContent).toContain('**Type**: Command Line Interface');
      expect(cliContent).toContain('Interactive terminal commands');
    });
  });
});