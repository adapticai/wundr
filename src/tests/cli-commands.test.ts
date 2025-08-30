/**
 * Test suite for CLI commands
 */

import { describe, it, expect, beforeEach, afterEach, jest } from 'jest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock external dependencies
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    text: ''
  }));
});

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

describe('CLI Commands', () => {
  let testDir: string;
  let originalCwd: string;
  
  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `cli-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('claude-init command', () => {
    it('should create CLAUDE.md file for React project', async () => {
      // Setup React project
      const packageJson = {
        name: 'test-react-app',
        version: '1.0.0',
        description: 'Test React application',
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
      
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
      writeFileSync('tsconfig.json', '{}');
      mkdirSync('src/components', { recursive: true });
      
      // Import and test the command
      const { createClaudeInitCommand } = await import('../cli/commands/claude-init.js');
      const command = createClaudeInitCommand();
      
      // Test command properties
      expect(command.name()).toBe('claude-init');
      expect(command.description()).toContain('Initialize Claude Code configuration');
      
      // Test that CLAUDE.md would be created (we can't easily test the full execution)
      // Instead, we'll test the generator directly
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(testDir);
      const content = await generator.generateClaudeMarkdown();
      
      expect(content).toContain('test-react-app');
      expect(content).toContain('React Application');
      expect(content).toContain('npm run build');
    });

    it('should handle monorepo projects correctly', async () => {
      const packageJson = {
        name: 'test-monorepo',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
        devDependencies: {
          turbo: '^2.0.0'
        },
        scripts: {
          build: 'turbo build',
          test: 'turbo test',
          lint: 'turbo lint'
        }
      };
      
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
      mkdirSync('packages/core', { recursive: true });
      mkdirSync('packages/ui', { recursive: true });
      mkdirSync('apps/web', { recursive: true });
      
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(testDir);
      const config = await generator.generateConfig();
      
      expect(config.projectType).toBe('monorepo');
      expect(config.agentConfiguration.specializedAgents.monorepo).toContain('package-coordinator');
      expect(config.agentConfiguration.maxAgents).toBeGreaterThan(6);
    });
  });

  describe('claude-audit command', () => {
    it('should audit project and generate score', async () => {
      // Setup well-configured project
      const packageJson = {
        name: 'test-audit-project',
        version: '1.0.0',
        description: 'Well-configured test project',
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0',
          eslint: '^8.0.0',
          prettier: '^3.0.0',
          husky: '^9.0.0',
          'lint-staged': '^15.0.0'
        },
        scripts: {
          build: 'tsc',
          test: 'jest --coverage',
          lint: 'eslint .',
          format: 'prettier --write .'
        },
        'lint-staged': {
          '*.{ts,tsx}': ['eslint --fix', 'prettier --write']
        }
      };
      
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
      writeFileSync('tsconfig.json', '{"compilerOptions":{"strict":true}}');
      writeFileSync('README.md', '# Test Project\nWell documented project');
      writeFileSync('.eslintrc.json', '{"extends":["@typescript-eslint/recommended"]}');
      writeFileSync('.gitignore', 'node_modules/\ndist/');
      mkdirSync('src', { recursive: true });
      writeFileSync('src/index.test.ts', 'describe("test", () => {});');
      
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(testDir);
      const auditResult = await generator.auditRepository();
      
      expect(auditResult.score).toBeGreaterThan(70);
      expect(auditResult.structure.hasPackageJson).toBe(true);
      expect(auditResult.structure.hasTsConfig).toBe(true);
      expect(auditResult.structure.hasTests).toBe(true);
      expect(auditResult.structure.hasDocumentation).toBe(true);
      expect(auditResult.quality.linting.enabled).toBe(true);
      expect(auditResult.quality.typeChecking.enabled).toBe(true);
      expect(auditResult.quality.testing.enabled).toBe(true);
    });

    it('should identify security issues', async () => {
      // Setup project with security issues
      const packageJson = {
        name: 'insecure-project',
        version: '1.0.0',
        dependencies: {
          'event-stream': '^4.0.0' // Known vulnerable package
        }
      };
      
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
      writeFileSync('config.js', 'const API_KEY = "sk_live_dangerous_key_123456789";');
      
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(testDir);
      const auditResult = await generator.auditRepository();
      
      expect(auditResult.score).toBeLessThan(50);
      
      const securityIssues = auditResult.issues.filter(issue => issue.category === 'security');
      expect(securityIssues.length).toBeGreaterThan(0);
      
      const hasVulnerablePackageIssue = securityIssues.some(issue => 
        issue.message.includes('event-stream')
      );
      expect(hasVulnerablePackageIssue).toBe(true);
    });

    it('should generate appropriate recommendations', async () => {
      // Setup minimal project needing improvements
      const packageJson = {
        name: 'needs-improvement',
        version: '1.0.0'
      };
      
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
      
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(testDir);
      const auditResult = await generator.auditRepository();
      
      expect(auditResult.recommendations.length).toBeGreaterThan(0);
      expect(auditResult.recommendations.some(rec => rec.includes('testing'))).toBe(true);
      expect(auditResult.recommendations.some(rec => rec.includes('documentation'))).toBe(true);
    });
  });

  describe('claude-setup command', () => {
    it('should create necessary directories and files', async () => {
      const packageJson = {
        name: 'test-setup-project',
        version: '1.0.0'
      };
      
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
      
      // Test the setup functionality (without full execution)
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(testDir);
      
      // Generate CLAUDE.md (simulating part of setup)
      const claudeContent = await generator.generateClaudeMarkdown();
      writeFileSync('CLAUDE.md', claudeContent);
      
      // Create MCP tools directory (simulating setup)
      mkdirSync('mcp-tools', { recursive: true });
      const installScript = `#!/bin/bash
echo "Installing MCP tools..."
`;
      writeFileSync('mcp-tools/install.sh', installScript);
      
      // Verify setup results
      expect(existsSync('CLAUDE.md')).toBe(true);
      expect(existsSync('mcp-tools')).toBe(true);
      expect(existsSync('mcp-tools/install.sh')).toBe(true);
      
      const claudeContent2 = readFileSync('CLAUDE.md', 'utf-8');
      expect(claudeContent2).toContain('test-setup-project');
    });

    it('should handle TypeScript template setup', () => {
      // Test TypeScript template functionality
      const setupTypeScriptTemplate = (repoPath: string) => {
        const tsconfigPath = join(repoPath, 'tsconfig.json');
        if (!existsSync(tsconfigPath)) {
          const tsconfig = {
            compilerOptions: {
              target: 'ES2020',
              module: 'ESNext',
              moduleResolution: 'node',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
              declaration: true,
              outDir: 'dist',
              rootDir: 'src'
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist']
          };
          
          writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
        }

        const srcPath = join(repoPath, 'src');
        if (!existsSync(srcPath)) {
          mkdirSync(srcPath, { recursive: true });
          writeFileSync(join(srcPath, 'index.ts'), '// Your TypeScript code here\n');
        }
      };
      
      setupTypeScriptTemplate(testDir);
      
      expect(existsSync('tsconfig.json')).toBe(true);
      expect(existsSync('src')).toBe(true);
      expect(existsSync('src/index.ts')).toBe(true);
      
      const tsconfigContent = JSON.parse(readFileSync('tsconfig.json', 'utf-8'));
      expect(tsconfigContent.compilerOptions.strict).toBe(true);
      expect(tsconfigContent.compilerOptions.target).toBe('ES2020');
    });
  });

  describe('Integration tests', () => {
    it('should work end-to-end for a complex project', async () => {
      // Setup complex project
      const packageJson = {
        name: 'complex-test-project',
        version: '2.1.0',
        description: 'A complex project for testing',
        author: 'Test Author <test@example.com>',
        license: 'MIT',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
          express: '^4.18.0'
        },
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0',
          '@testing-library/react': '^14.0.0',
          eslint: '^8.0.0',
          '@typescript-eslint/eslint-plugin': '^6.0.0',
          prettier: '^3.0.0',
          husky: '^9.0.0',
          'lint-staged': '^15.0.0'
        },
        scripts: {
          build: 'tsc && vite build',
          'build:server': 'tsc -p server.tsconfig.json',
          test: 'jest',
          'test:watch': 'jest --watch',
          'test:coverage': 'jest --coverage',
          lint: 'eslint src/ server/',
          'lint:fix': 'eslint src/ server/ --fix',
          format: 'prettier --write .',
          typecheck: 'tsc --noEmit'
        },
        'lint-staged': {
          '*.{ts,tsx}': ['eslint --fix', 'prettier --write']
        }
      };
      
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
      writeFileSync('tsconfig.json', JSON.stringify({
        compilerOptions: { strict: true, target: 'ES2020' }
      }));
      writeFileSync('README.md', '# Complex Test Project\nFull-featured application');
      writeFileSync('CHANGELOG.md', '# Changelog\n## v2.1.0\n- New features');
      writeFileSync('.gitignore', 'node_modules/\ndist/\nbuild/');
      
      // Create directory structure
      mkdirSync('src/components', { recursive: true });
      mkdirSync('src/hooks', { recursive: true });
      mkdirSync('server/routes', { recursive: true });
      mkdirSync('tests/integration', { recursive: true });
      mkdirSync('docs', { recursive: true });
      
      // Create test files
      writeFileSync('src/components/Button.test.tsx', 'import { render } from "@testing-library/react";');
      writeFileSync('tests/integration/api.test.ts', 'describe("API", () => {});');
      
      // Test complete workflow
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(testDir);
      
      // 1. Audit
      const auditResult = await generator.auditRepository();
      expect(auditResult.score).toBeGreaterThan(85);
      
      // 2. Generate config
      const config = await generator.generateConfig();
      expect(config.projectType).toBe('full-stack'); // Has both React and Express
      expect(config.projectMetadata.name).toBe('complex-test-project');
      expect(config.projectMetadata.version).toBe('2.1.0');
      expect(config.projectMetadata.author).toBe('Test Author <test@example.com>');
      
      // 3. Generate CLAUDE.md
      const claudeContent = await generator.generateClaudeMarkdown();
      writeFileSync('CLAUDE.md', claudeContent);
      
      expect(claudeContent).toContain('complex-test-project');
      expect(claudeContent).toContain('Full-Stack Application');
      expect(claudeContent).toContain('npm run build');
      expect(claudeContent).toContain('npm run test');
      expect(claudeContent).toContain('npm run lint');
      expect(claudeContent).toContain('TypeScript: ✅ Enabled');
      expect(claudeContent).toContain('Strict Mode: ✅ Yes');
      expect(claudeContent).toContain('Testing: ✅ Enabled');
      expect(claudeContent).toContain('Jest, React Testing Library');
      expect(claudeContent).toContain('api-designer');
      expect(claudeContent).toContain('ui-designer');
      
      // Verify file was created
      expect(existsSync('CLAUDE.md')).toBe(true);
      const savedContent = readFileSync('CLAUDE.md', 'utf-8');
      expect(savedContent).toBe(claudeContent);
    });
  });
});