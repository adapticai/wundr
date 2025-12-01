import { TestHelper, CommandResult } from '../helpers/test-utils';
import { WundrCLI } from '../../src/cli';
import path from 'path';

describe('Command Integration Tests', () => {
  let testHelper: TestHelper;
  let cli: WundrCLI;

  beforeEach(async () => {
    testHelper = new TestHelper();
    await testHelper.setup();
    cli = new WundrCLI();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Init Commands Integration', () => {
    test('should initialize new project', async () => {
      const program = cli.createProgram();

      // Test project initialization
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init',
        'project',
      ]);

      // Would verify .wundr directory creation and config files
      expect(result.code).toBe(0);
    });

    test('should initialize monorepo structure', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init',
        'monorepo',
      ]);

      expect(result.code).toBe(0);
    });

    test('should create configuration file', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init',
        'config',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Create Commands Integration', () => {
    test('should create React component', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'create',
        'component',
        'TestComponent',
        '--type',
        'react',
        '--with-tests',
      ]);

      expect(result.code).toBe(0);
    });

    test('should create service', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'create',
        'service',
        'TestService',
        '--framework',
        'express',
      ]);

      expect(result.code).toBe(0);
    });

    test('should create package in monorepo', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'create',
        'package',
        'test-package',
        '--type',
        'library',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Analyze Commands Integration', () => {
    test('should analyze dependencies', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'analyze',
        'deps',
      ]);

      expect(result.code).toBe(0);
    });

    test('should analyze code quality', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'analyze',
        'quality',
        '--format',
        'json',
      ]);

      expect(result.code).toBe(0);
    });

    test('should perform security analysis', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'analyze',
        'security',
        '--fix',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Governance Commands Integration', () => {
    test('should add governance rules', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'govern',
        'rules',
        'add',
        'no-console',
      ]);

      expect(result.code).toBe(0);
    });

    test('should check governance compliance', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'govern',
        'check',
      ]);

      expect(result.code).toBe(0);
    });

    test('should create quality gate', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'govern',
        'gate',
        'create',
        'default',
        '--conditions',
        'coverage>80,complexity<10',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('AI Commands Integration', () => {
    test('should configure AI provider', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'ai',
        'config',
        'set',
        'provider',
        'claude',
      ]);

      expect(result.code).toBe(0);
    });

    test('should generate code with AI', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'ai',
        'generate',
        'component',
        '--prompt',
        'Create a button component',
      ]);

      expect(result.code).toBe(0);
    });

    test('should review code with AI', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'ai',
        'review',
        'src/index.ts',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Dashboard Commands Integration', () => {
    test('should start dashboard server', async () => {
      const result = await testHelper.runCommand(
        'node',
        [
          path.join(__dirname, '../../dist/index.js'),
          'dashboard',
          'start',
          '--port',
          '3001',
        ],
        { timeout: 5000 }
      );

      // Dashboard start might not complete immediately
      expect([0, null]).toContain(result.code);
    });

    test('should configure dashboard', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'dashboard',
        'config',
        'set',
        'theme',
        'dark',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Watch Commands Integration', () => {
    test('should start file watching', async () => {
      const watchConfig = await testHelper.createWatchConfig(
        'test-watch',
        ['src/**/*'],
        ['npm test']
      );

      const result = await testHelper.runCommand(
        'node',
        [
          path.join(__dirname, '../../dist/index.js'),
          'watch',
          'config',
          'load',
          watchConfig,
        ],
        { timeout: 2000 }
      );

      expect([0, null]).toContain(result.code);
    });

    test('should watch tests', async () => {
      const result = await testHelper.runCommand(
        'node',
        [
          path.join(__dirname, '../../dist/index.js'),
          'watch',
          'test',
          '--framework',
          'jest',
        ],
        { timeout: 2000 }
      );

      expect([0, null]).toContain(result.code);
    });
  });

  describe('Batch Commands Integration', () => {
    test('should run batch job', async () => {
      const jobPath = await testHelper.createBatchJob('test-batch', [
        'echo "Starting batch job"',
        'npm --version',
        'echo "Batch job completed"',
      ]);

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'batch',
        'run',
        jobPath,
      ]);

      expect(result.code).toBe(0);
    });

    test('should validate batch job', async () => {
      const jobPath = await testHelper.createBatchJob('validate-job', [
        'echo "validation test"',
      ]);

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'batch',
        'validate',
        jobPath,
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Chat Commands Integration', () => {
    test('should ask single question', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'chat',
        'ask',
        'What is TypeScript?',
        '--model',
        'mock',
      ]);

      expect(result.code).toBe(0);
    });

    test('should chat with file', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'chat',
        'file',
        'src/index.ts',
        '--action',
        'explain',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Plugin Commands Integration', () => {
    test('should list installed plugins', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'plugins',
        'list',
      ]);

      expect(result.code).toBe(0);
    });

    test('should install plugin', async () => {
      const pluginPath = await testHelper.createPlugin('test-plugin');

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'plugins',
        'install',
        pluginPath,
      ]);

      expect(result.code).toBe(0);
    });

    test('should enable plugin', async () => {
      const pluginPath = await testHelper.createPlugin('enable-plugin');

      await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'plugins',
        'install',
        pluginPath,
      ]);

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'plugins',
        'enable',
        'enable-plugin',
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Command Chaining and Workflows', () => {
    test('should execute complete workflow', async () => {
      // Test a complete workflow: init -> create -> analyze -> govern

      // Initialize project
      let result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init',
        'project',
      ]);
      expect(result.code).toBe(0);

      // Create component
      result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'create',
        'component',
        'WorkflowTest',
      ]);
      expect(result.code).toBe(0);

      // Analyze code
      result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'analyze',
        'quality',
      ]);
      expect(result.code).toBe(0);
    });

    test('should handle command dependencies', async () => {
      // Some commands require others to be run first
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'govern',
        'check',
      ]);

      // Should handle gracefully even if no rules are configured
      expect([0, 1]).toContain(result.code);
    });
  });

  describe('Global Options Integration', () => {
    test('should handle verbose flag', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        '--verbose',
        'init',
        'project',
      ]);

      expect(result.code).toBe(0);
    });

    test('should handle dry-run flag', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        '--dry-run',
        'create',
        'component',
        'DryRunTest',
      ]);

      expect(result.code).toBe(0);
    });

    test('should handle custom config', async () => {
      const configPath = await testHelper.createWundrConfig();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        '--config',
        configPath,
        'init',
        'project',
      ]);

      expect(result.code).toBe(0);
    });

    test('should handle no-color flag', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        '--no-color',
        'help',
      ]);

      expect(result.code).toBe(0);
    });
  });
});
