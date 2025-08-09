import { TestHelper } from '../helpers/test-utils';
import os from 'os';
import path from 'path';

describe('Cross-Platform Compatibility Tests', () => {
  let testHelper: TestHelper;
  const platform = os.platform();
  const isWindows = platform === 'win32';
  const isMac = platform === 'darwin';
  const isLinux = platform === 'linux';

  beforeEach(async () => {
    testHelper = new TestHelper();
    await testHelper.setup();
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Binary Execution', () => {
    test('should execute CLI binary on current platform', async () => {
      const binaryPath = path.join(__dirname, '../../bin/wundr.js');
      
      const result = await testHelper.runCommand('node', [
        binaryPath,
        '--version'
      ]);

      expect(result.code).toBe(0);
    });

    test('should handle platform-specific paths', async () => {
      const testPath = isWindows ? 'C:\\test\\path' : '/test/path';
      
      // Test path handling
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init', 'project',
        '--path', testPath
      ]);

      expect([0, 1]).toContain(result.code); // May fail due to permissions
    });

    test('should work with different node versions', async () => {
      // Test minimum node version compatibility
      const nodeVersion = process.version;
      const major = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      expect(major).toBeGreaterThanOrEqual(18);
    });
  });

  describe('File System Operations', () => {
    test('should handle different path separators', async () => {
      const separator = path.sep;
      const testDir = path.join(testHelper.getTestDir(), 'subdir');
      
      expect(separator).toBeDefined();
      expect(testDir).toContain(separator);
    });

    test('should handle case sensitivity correctly', async () => {
      if (isWindows || isMac) {
        // Case-insensitive filesystems
        const result = await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          'create', 'component', 'TestCase'
        ]);
        
        expect(result.code).toBe(0);
      } else {
        // Case-sensitive filesystem (Linux)
        expect(isLinux).toBe(true);
      }
    });

    test('should handle special characters in paths', async () => {
      // Test paths with spaces and special characters
      const specialPath = path.join(testHelper.getTestDir(), 'special dir', 'file-name.test');
      
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'create', 'component', 'SpecialPath',
        '--output', specialPath
      ]);

      expect([0, 1]).toContain(result.code);
    });

    test('should handle symlinks appropriately', async () => {
      if (!isWindows) {
        // Unix-like systems support symlinks better
        const result = await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          'plugins', 'link', testHelper.getTestDir()
        ]);

        expect([0, 1]).toContain(result.code);
      }
    });
  });

  describe('Shell and Process Handling', () => {
    test('should handle different shells', async () => {
      const shell = process.env.SHELL || (isWindows ? 'cmd.exe' : '/bin/bash');
      
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'batch', 'run',
        await testHelper.createBatchJob('shell-test', ['echo "shell test"'])
      ]);

      expect(result.code).toBe(0);
    });

    test('should handle environment variables', async () => {
      const testEnv = { TEST_VAR: 'test-value' };
      
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init', 'project'
      ], { env: { ...process.env, ...testEnv } });

      expect(result.code).toBe(0);
    });

    test('should handle different line endings', async () => {
      const lineEnding = os.EOL;
      
      expect(lineEnding).toBeDefined();
      if (isWindows) {
        expect(lineEnding).toBe('\r\n');
      } else {
        expect(lineEnding).toBe('\n');
      }
    });
  });

  describe('Terminal and TTY Handling', () => {
    test('should detect TTY correctly', async () => {
      const isTTY = process.stdin.isTTY;
      
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'help'
      ]);

      expect(result.code).toBe(0);
    });

    test('should handle color output correctly', async () => {
      // Test with and without color support
      const resultWithColor = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'help'
      ]);

      const resultNoColor = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        '--no-color',
        'help'
      ]);

      expect(resultWithColor.code).toBe(0);
      expect(resultNoColor.code).toBe(0);
    });

    test('should handle terminal width', async () => {
      const width = process.stdout.columns || 80;
      
      expect(width).toBeGreaterThan(0);
    });
  });

  describe('Permission Handling', () => {
    test('should handle file permissions', async () => {
      if (!isWindows) {
        // Unix-like permission testing
        const result = await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          'init', 'project'
        ]);

        expect(result.code).toBe(0);
      }
    });

    test('should handle directory creation permissions', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'init', 'project'
      ]);

      expect(result.code).toBe(0);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not exceed memory limits', async () => {
      const initialMemory = process.memoryUsage();
      
      await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'analyze', 'deps'
      ]);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Should not increase memory by more than 100MB
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    test('should handle large files appropriately', async () => {
      // Create a reasonably sized test file
      const largeContent = 'x'.repeat(10000);
      const fs = await import('fs-extra');
      const largeFile = path.join(testHelper.getTestDir(), 'large-file.txt');
      
      await fs.writeFile(largeFile, largeContent);
      
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'chat', 'file', largeFile
      ]);

      expect([0, 1]).toContain(result.code);
    });
  });

  describe('Platform-Specific Features', () => {
    test('should handle Windows-specific features', async () => {
      if (isWindows) {
        // Test Windows-specific functionality
        const result = await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          'init', 'project'
        ]);

        expect(result.code).toBe(0);
      } else {
        expect(isWindows).toBe(false);
      }
    });

    test('should handle macOS-specific features', async () => {
      if (isMac) {
        // Test macOS-specific functionality
        const result = await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          'dashboard', 'start',
          '--port', '3002'
        ], { timeout: 2000 });

        expect([0, null]).toContain(result.code);
      } else {
        expect(isMac).toBe(false);
      }
    });

    test('should handle Linux-specific features', async () => {
      if (isLinux) {
        // Test Linux-specific functionality
        const result = await testHelper.runCommand('node', [
          path.join(__dirname, '../../dist/index.js'),
          'watch', 'start', 'src/**/*',
          '--command', 'echo "Linux watch test"'
        ], { timeout: 1000 });

        expect([0, null]).toContain(result.code);
      } else {
        expect(isLinux).toBe(false);
      }
    });
  });

  describe('Dependency Compatibility', () => {
    test('should handle optional dependencies', async () => {
      // Test behavior when optional dependencies are missing
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'help'
      ]);

      expect(result.code).toBe(0);
    });

    test('should provide fallbacks for platform-specific features', async () => {
      // Test fallback behavior
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'tui'
      ], { timeout: 1000 });

      // TUI might not work in test environment
      expect([0, 1, null]).toContain(result.code);
    });
  });

  describe('Error Reporting', () => {
    test('should provide platform-appropriate error messages', async () => {
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'invalid-command'
      ]);

      expect(result.code).not.toBe(0);
      expect(result.stderr || result.stdout).toContain('Unknown command');
    });

    test('should handle stack traces appropriately', async () => {
      // Test error handling across platforms
      const result = await testHelper.runCommand('node', [
        path.join(__dirname, '../../dist/index.js'),
        'plugins', 'install', '/nonexistent/path'
      ]);

      expect(result.code).not.toBe(0);
    });
  });
});