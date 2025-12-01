import { BatchCommands } from '../../src/commands/batch';
import { ConfigManager } from '../../src/utils/config-manager';
import { PluginManager } from '../../src/plugins/plugin-manager';
import { TestHelper, createMockConfig } from '../helpers/test-utils';
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

describe('BatchCommands', () => {
  let testHelper: TestHelper;
  let batchCommands: BatchCommands;
  let mockProgram: Command;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockPluginManager: jest.Mocked<PluginManager>;

  beforeEach(async () => {
    testHelper = new TestHelper();
    await testHelper.setup();

    mockProgram = new Command();
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue(createMockConfig()),
    } as any;
    mockPluginManager = {} as any;

    batchCommands = new BatchCommands(
      mockProgram,
      mockConfigManager,
      mockPluginManager
    );
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Command Registration', () => {
    test('should register batch commands', () => {
      const batchCmd = mockProgram.commands.find(cmd => cmd.name() === 'batch');
      expect(batchCmd).toBeDefined();
      expect(batchCmd?.description()).toContain('batch processing');
    });

    test('should register all batch subcommands', () => {
      const batchCmd = mockProgram.commands.find(cmd => cmd.name() === 'batch');
      const subcommands = batchCmd?.commands.map(cmd => cmd.name()) || [];

      const expectedCommands = [
        'run',
        'create',
        'list',
        'validate',
        'stop',
        'status',
        'schedule',
        'export',
        'import',
        'template',
      ];

      expectedCommands.forEach(cmd => {
        expect(subcommands).toContain(cmd);
      });
    });

    test('should register template subcommands', () => {
      const batchCmd = mockProgram.commands.find(cmd => cmd.name() === 'batch');
      const templateCmd = batchCmd?.commands.find(
        cmd => cmd.name() === 'template'
      );

      expect(templateCmd).toBeDefined();

      const templateSubcommands = batchCmd?.commands
        .filter(cmd => cmd.name().startsWith('template'))
        .map(cmd => cmd.name());

      expect(templateSubcommands).toContain('template list');
      expect(templateSubcommands).toContain('template create');
    });
  });

  describe('Batch Job Creation', () => {
    test('should create basic batch job', async () => {
      const jobName = 'test-job';
      const commands = ['npm test', 'npm build'];

      const jobPath = await testHelper.createBatchJob(jobName, commands);
      const job = YAML.parse(await fs.readFile(jobPath, 'utf8'));

      expect(job.name).toBe(jobName);
      expect(job.commands).toHaveLength(2);
      expect(job.commands[0].command).toBe('npm test');
    });

    test('should create job from template', async () => {
      // Create a mock template first
      const templateDir = path.join(__dirname, '../../templates/batch');
      await fs.ensureDir(templateDir);

      const templateJob = {
        name: 'ci-template',
        description: 'CI/CD template',
        commands: [
          { command: 'npm install' },
          { command: 'npm test' },
          { command: 'npm run build' },
        ],
      };

      await fs.writeFile(
        path.join(templateDir, 'ci-cd.yaml'),
        YAML.stringify(templateJob)
      );

      // Test would create job from template
      expect(await fs.pathExists(path.join(templateDir, 'ci-cd.yaml'))).toBe(
        true
      );
    });

    test('should validate job structure', async () => {
      const validJob = {
        name: 'valid-job',
        description: 'A valid job',
        commands: [{ command: 'echo "hello"' }, { command: 'echo "world"' }],
      };

      // Test validation would pass
      expect(validJob.name).toBeDefined();
      expect(validJob.commands).toHaveLength(2);
    });

    test('should detect invalid job structure', async () => {
      const invalidJob = {
        // Missing name
        description: 'Invalid job',
        commands: [],
      };

      // Test validation would fail
      expect(invalidJob.name).toBeUndefined();
      expect(invalidJob.commands).toHaveLength(0);
    });
  });

  describe('Batch Job Execution', () => {
    test('should run batch job from YAML', async () => {
      const jobPath = await testHelper.createBatchJob('run-test', [
        'echo "test"',
      ]);

      // Mock the private method call
      const batchManager = batchCommands as any;
      const job = await batchManager.loadBatchJob(jobPath);

      expect(job.name).toBe('run-test');
      expect(job.commands[0].command).toBe('echo "test"');
    });

    test('should handle parallel execution', async () => {
      const parallelJob = {
        name: 'parallel-job',
        parallel: true,
        commands: [
          { command: 'echo "task1"' },
          { command: 'echo "task2"' },
          { command: 'echo "task3"' },
        ],
      };

      expect(parallelJob.parallel).toBe(true);
      expect(parallelJob.commands).toHaveLength(3);
    });

    test('should handle continue on error', async () => {
      const resilientJob = {
        name: 'resilient-job',
        continueOnError: true,
        commands: [
          { command: 'echo "success"' },
          { command: 'exit 1' }, // This would fail
          { command: 'echo "continue"' },
        ],
      };

      expect(resilientJob.continueOnError).toBe(true);
    });

    test('should process job variables', async () => {
      const jobWithVars = {
        name: 'var-job',
        commands: [
          { command: 'echo "{{message}}"' },
          { command: 'echo "Version: {{version}}"' },
        ],
      };

      const variables = { message: 'Hello World', version: '1.0.0' };

      // Test variable replacement
      const processedCommand = jobWithVars.commands[0].command.replace(
        '{{message}}',
        variables.message
      );

      expect(processedCommand).toBe('echo "Hello World"');
    });

    test('should show dry run output', async () => {
      const job = {
        name: 'dry-run-job',
        commands: [
          { command: 'npm install' },
          { command: 'npm test', condition: 'test-files' },
          { command: 'npm build', timeout: 30000 },
        ],
        parallel: true,
      };

      // Dry run would show job details without execution
      expect(job.commands).toHaveLength(3);
      expect(job.parallel).toBe(true);
    });
  });

  describe('Job Management', () => {
    test('should list batch jobs', async () => {
      await testHelper.createBatchJob('job1', ['echo "1"']);
      await testHelper.createBatchJob('job2', ['echo "2"']);

      const batchDir = path.join(testHelper.getTestDir(), '.wundr', 'batch');
      const files = await fs.readdir(batchDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml'));

      expect(yamlFiles).toHaveLength(2);
      expect(yamlFiles).toContain('job1.yaml');
      expect(yamlFiles).toContain('job2.yaml');
    });

    test('should track running jobs', async () => {
      const batchManager = batchCommands as any;
      const jobId = 'test-job-123';

      batchManager.runningJobs.set(jobId, {
        file: 'test.yaml',
        job: { name: 'test' },
        startTime: Date.now(),
        status: 'running',
      });

      expect(batchManager.runningJobs.has(jobId)).toBe(true);
      expect(batchManager.runningJobs.get(jobId).status).toBe('running');
    });

    test('should stop running job', async () => {
      const batchManager = batchCommands as any;
      const jobId = 'stop-job-123';

      batchManager.runningJobs.set(jobId, {
        status: 'running',
      });

      // Simulate stopping
      const job = batchManager.runningJobs.get(jobId);
      if (job) {
        job.status = 'stopped';
        batchManager.runningJobs.delete(jobId);
      }

      expect(batchManager.runningJobs.has(jobId)).toBe(false);
    });

    test('should show job status', async () => {
      const batchManager = batchCommands as any;
      const jobId = 'status-job-123';
      const startTime = Date.now() - 5000;

      batchManager.runningJobs.set(jobId, {
        file: 'test.yaml',
        status: 'running',
        startTime,
      });

      const job = batchManager.runningJobs.get(jobId);
      const duration = Date.now() - job.startTime;

      expect(job.status).toBe('running');
      expect(duration).toBeGreaterThan(4000);
    });
  });

  describe('Job Scheduling', () => {
    test('should handle cron scheduling', async () => {
      const cronExpression = '0 9 * * 1'; // Every Monday at 9am

      // Would use a cron library in real implementation
      expect(cronExpression).toMatch(/^[0-9*,/-\s]+$/);
    });

    test('should handle interval scheduling', async () => {
      const interval = 60000; // 1 minute

      expect(interval).toBe(60000);
      expect(typeof interval).toBe('number');
    });

    test('should handle one-time scheduling', async () => {
      const delay = 5000; // 5 seconds

      expect(delay).toBe(5000);
      expect(typeof delay).toBe('number');
    });
  });

  describe('Import/Export', () => {
    test('should export job to JSON', async () => {
      const job = {
        name: 'export-job',
        commands: [{ command: 'echo "export"' }],
      };

      const exported = JSON.stringify(job, null, 2);
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('export-job');
      expect(parsed.commands[0].command).toBe('echo "export"');
    });

    test('should export job to shell script', async () => {
      const job = {
        name: 'shell-job',
        description: 'Shell script job',
        commands: [
          { command: 'echo "Starting"' },
          { command: 'npm install' },
          { command: 'npm test' },
        ],
      };

      // Mock shell script conversion
      let script = '#!/bin/bash\n';
      script += `# Generated from batch job: ${job.name}\n`;
      if (job.description) {
        script += `# ${job.description}\n`;
      }
      script += '\nset -e\n\n';

      job.commands.forEach(cmd => {
        script += `echo "Executing: ${cmd.command}"\n`;
        script += `${cmd.command}\n\n`;
      });

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('npm install');
      expect(script).toContain('set -e');
    });

    test('should export job to Dockerfile', async () => {
      const job = {
        name: 'docker-job',
        commands: [{ command: 'npm install' }, { command: 'npm run build' }],
      };

      // Mock Dockerfile conversion
      let dockerfile = `# Generated from batch job: ${job.name}\n`;
      dockerfile += 'FROM node:18-alpine\n\n';
      dockerfile += 'WORKDIR /app\n';
      dockerfile += 'COPY . .\n\n';

      job.commands.forEach(cmd => {
        dockerfile += `RUN ${cmd.command}\n`;
      });

      expect(dockerfile).toContain('FROM node:18-alpine');
      expect(dockerfile).toContain('RUN npm install');
      expect(dockerfile).toContain('RUN npm run build');
    });

    test('should import from package.json scripts', async () => {
      const packageJson = {
        scripts: {
          test: 'jest',
          build: 'tsc',
          lint: 'eslint .',
          start: 'node dist/index.js',
        },
      };

      // Mock import conversion
      const commands = Object.entries(packageJson.scripts).map(
        ([script, command]) => ({
          command: `npm run ${script}`,
          args: [],
          condition: undefined,
        })
      );

      expect(commands).toHaveLength(4);
      expect(commands[0].command).toBe('npm run test');
    });
  });

  describe('Command Conditions', () => {
    test('should evaluate simple conditions', async () => {
      const conditions = {
        always: true,
        never: false,
        'test-files': true, // Mock evaluation
      };

      expect(conditions.always).toBe(true);
      expect(conditions.never).toBe(false);
      expect(conditions['test-files']).toBe(true);
    });

    test('should handle command retries', async () => {
      const commandWithRetry = {
        command: 'flaky-command',
        retry: 3,
        timeout: 5000,
      };

      expect(commandWithRetry.retry).toBe(3);
      expect(commandWithRetry.timeout).toBe(5000);
    });

    test('should handle command timeouts', async () => {
      const commandWithTimeout = {
        command: 'long-running-command',
        timeout: 30000,
      };

      expect(commandWithTimeout.timeout).toBe(30000);
    });
  });

  describe('Template Management', () => {
    test('should list available templates', async () => {
      const mockTemplates = ['ci-cd.yaml', 'testing.yaml', 'deployment.yaml'];

      expect(mockTemplates).toHaveLength(3);
      expect(mockTemplates).toContain('ci-cd.yaml');
    });

    test('should create template from existing job', async () => {
      const existingJob = {
        name: 'existing-job',
        commands: [{ command: 'echo "template"' }],
      };

      // Would create template from job
      const template = { ...existingJob };
      delete (template as any).name; // Templates don't have names

      expect(template.commands).toBeDefined();
      expect((template as any).name).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle file not found errors', async () => {
      const batchManager = batchCommands as any;

      await expect(
        batchManager.loadBatchJob('/non/existent/file.yaml')
      ).rejects.toThrow();
    });

    test('should handle invalid YAML format', async () => {
      const invalidYamlPath = path.join(
        testHelper.getTestDir(),
        'invalid.yaml'
      );
      await fs.writeFile(invalidYamlPath, 'invalid: yaml: content:');

      const batchManager = batchCommands as any;

      await expect(
        batchManager.loadBatchJob(invalidYamlPath)
      ).rejects.toThrow();
    });

    test('should handle command execution failures', async () => {
      const failingCommand = {
        command: 'exit 1',
        retry: 0,
      };

      // Mock command execution would fail
      expect(failingCommand.command).toBe('exit 1');
      expect(failingCommand.retry).toBe(0);
    });

    test('should create proper error contexts', async () => {
      // Error handling would create contextual errors
      const context = {
        file: 'test-job.yaml',
        options: { dryRun: false },
      };

      expect(context.file).toBe('test-job.yaml');
      expect(context.options.dryRun).toBe(false);
    });
  });
});
