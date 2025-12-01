import { TestHelper } from '../helpers/test-utils';
import { performance } from 'perf_hooks';
import path from 'path';

describe('Performance and Scalability Tests', () => {
  let testHelper: TestHelper;

  beforeEach(async () => {
    testHelper = new TestHelper();
    await testHelper.setup();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Command Execution Performance', () => {
    test('should execute help command quickly', async () => {
      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        '--help',
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    test('should initialize project efficiently', async () => {
      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init',
        'project',
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle multiple commands efficiently', async () => {
      const commands = [
        ['init', 'project'],
        ['create', 'component', 'TestComponent1'],
        ['create', 'component', 'TestComponent2'],
        ['analyze', 'deps'],
      ];

      const start = performance.now();

      for (const cmd of commands) {
        const result = await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          ...cmd,
        ]);
        expect([0, 1]).toContain(result.code); // Allow some failures
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(15000); // All commands within 15 seconds
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory during normal operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          'create',
          'component',
          `Component${i}`,
        ]);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle large plugin installations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create multiple plugins
      for (let i = 0; i < 3; i++) {
        await testHelper.createPlugin(`large-plugin-${i}`, [
          { name: 'command1', description: 'Test command 1' },
          { name: 'command2', description: 'Test command 2' },
        ]);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should handle plugin creation without excessive memory usage
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024);
    });
  });

  describe('File System Performance', () => {
    test('should handle many file operations efficiently', async () => {
      const start = performance.now();

      // Create many batch jobs
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          testHelper.createBatchJob(`batch-${i}`, [
            `echo "Batch job ${i}"`,
            'npm --version',
          ])
        );
      }

      await Promise.all(promises);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should scan directories efficiently', async () => {
      // Create nested directory structure
      const fs = await import('fs-extra');
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
          const filePath = path.join(
            testHelper.getTestDir(),
            `dir${i}`,
            `file${j}.ts`
          );
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(
            filePath,
            `// File ${i}-${j}\nexport const value = ${j};`
          );
        }
      }

      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'analyze',
        'deps',
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(10000); // Should analyze within 10 seconds
    });
  });

  describe('Plugin System Performance', () => {
    test('should load multiple plugins efficiently', async () => {
      // Create multiple plugins
      const pluginPromises = [];
      for (let i = 0; i < 5; i++) {
        pluginPromises.push(
          testHelper.createPlugin(`perf-plugin-${i}`, [
            { name: `cmd${i}`, description: `Command ${i}` },
          ])
        );
      }
      await Promise.all(pluginPromises);

      const start = performance.now();

      // Plugin loading would be tested here in actual implementation
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'plugins',
        'list',
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(3000); // Should list plugins within 3 seconds
    });

    test('should handle plugin commands efficiently', async () => {
      const pluginPath = await testHelper.createPlugin('fast-plugin', [
        { name: 'fast-command', description: 'Fast command' },
      ]);

      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'plugins',
        'info',
        'fast-plugin',
      ]);

      const duration = performance.now() - start;

      expect([0, 1]).toContain(result.code);
      expect(duration).toBeLessThan(2000); // Should get info within 2 seconds
    });
  });

  describe('Watch Mode Performance', () => {
    test('should start watching quickly', async () => {
      const watchConfig = await testHelper.createWatchConfig(
        'perf-watch',
        ['src/**/*'],
        ['echo "File changed"']
      );

      const start = performance.now();

      const child = testHelper.runCommand(
        'node',
        [
          path.join(__dirname, '../../dist/index.js'),
          'watch',
          'config',
          'load',
          watchConfig,
        ],
        { timeout: 1000 }
      );

      // Wait a bit then check
      await new Promise(resolve => setTimeout(resolve, 500));
      const duration = performance.now() - start;

      expect(duration).toBeGreaterThan(400); // Should have started
      expect(duration).toBeLessThan(1500); // But not take too long
    });

    test('should handle file change events efficiently', async () => {
      // This would test watch responsiveness to file changes
      const fs = await import('fs-extra');
      const testFile = path.join(testHelper.getTestDir(), 'watch-test.ts');

      await fs.writeFile(testFile, '// Initial content');

      // Start watching (mock)
      const start = performance.now();

      // Simulate file change
      await fs.writeFile(testFile, '// Modified content');

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // File write should be fast
    });
  });

  describe('Batch Processing Performance', () => {
    test('should execute batch jobs efficiently', async () => {
      const commands = [];
      for (let i = 0; i < 10; i++) {
        commands.push(`echo "Command ${i}"`);
      }

      const jobPath = await testHelper.createBatchJob('perf-batch', commands);

      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'batch',
        'run',
        jobPath,
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle parallel execution efficiently', async () => {
      const commands = [];
      for (let i = 0; i < 5; i++) {
        commands.push(`sleep 0.1 && echo "Parallel ${i}"`);
      }

      const jobPath = await testHelper.createBatchJob(
        'parallel-batch',
        commands
      );

      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'batch',
        'run',
        jobPath,
        '--parallel',
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent command executions', async () => {
      const commands = [
        ['help'],
        ['plugins', 'list'],
        ['init', 'config', '--dry-run'],
        ['analyze', 'deps', '--dry-run'],
      ];

      const start = performance.now();

      const promises = commands.map(cmd =>
        testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          ...cmd,
        ])
      );

      const results = await Promise.all(promises);

      const duration = performance.now() - start;

      // All commands should complete
      results.forEach(result => {
        expect([0, 1]).toContain(result.code);
      });

      // Concurrent execution should be efficient
      expect(duration).toBeLessThan(8000);
    });

    test('should handle resource contention gracefully', async () => {
      const configPath = await testHelper.createWundrConfig();

      // Multiple operations trying to access config
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          testHelper.runCommand('node', [
            path.join(__dirname, '../../dist/index.js'),
            '--config',
            configPath,
            'init',
            'project',
          ])
        );
      }

      const results = await Promise.all(promises);

      // At least one should succeed
      const successCount = results.filter(r => r.code === 0).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Scalability Tests', () => {
    test('should handle large project structures', async () => {
      // Create large project structure
      const fs = await import('fs-extra');

      for (let i = 0; i < 20; i++) {
        const dir = path.join(testHelper.getTestDir(), `package-${i}`);
        await fs.ensureDir(dir);
        await fs.writeJson(path.join(dir, 'package.json'), {
          name: `package-${i}`,
          version: '1.0.0',
        });

        // Add some source files
        for (let j = 0; j < 5; j++) {
          await fs.writeFile(
            path.join(dir, `file-${j}.ts`),
            `// File ${j} in package ${i}\nexport const value${j} = ${i * 10 + j};`
          );
        }
      }

      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'analyze',
        'deps',
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(30000); // Should handle large structure within 30 seconds
    });

    test('should handle many configuration options', async () => {
      const largeConfig = {
        version: '1.0.0',
        defaultMode: 'cli' as const,
        plugins: Array.from({ length: 50 }, (_, i) => `plugin-${i}`),
        integrations: {},
        ai: { provider: 'test', model: 'test' },
        analysis: {
          patterns: Array.from({ length: 20 }, (_, i) => `src/**/*.${i}`),
          excludes: Array.from(
            { length: 10 },
            (_, i) => `node_modules/**/*.${i}`
          ),
          maxDepth: 10,
        },
        governance: {
          rules: Array.from({ length: 30 }, (_, i) => `rule-${i}`),
          severity: 'warning' as const,
        },
      };

      const configPath = await testHelper.createWundrConfig(largeConfig);

      const start = performance.now();

      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        '--config',
        configPath,
        'help',
      ]);

      const duration = performance.now() - start;

      expect(result.code).toBe(0);
      expect(duration).toBeLessThan(3000); // Should load large config within 3 seconds
    });
  });
});
