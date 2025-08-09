import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

test.describe('Wundr CLI Simple E2E Tests', () => {
  let tempDir: string;

  test.beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = path.join(process.cwd(), 'temp-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  test.afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test.describe('CLI Basic Functionality', () => {
    test('should display version information', async () => {
      const { stdout } = await execAsync('node ./bin/wundr-simple.js --version');
      
      expect(stdout.trim()).toMatch(/^1\.\d+\.\d+$/);
    });

    test('should display help information', async () => {
      const { stdout } = await execAsync('node ./bin/wundr-simple.js help');
      
      expect(stdout).toContain('Wundr CLI Help:');
      expect(stdout).toContain('version');
      expect(stdout).toContain('help');
      expect(stdout).toContain('analyze');
    });

    test('should handle analyze command', async () => {
      const { stdout } = await execAsync(`node ./bin/wundr-simple.js analyze --path ${tempDir}`);
      
      expect(stdout).toContain('Analyzing project at:');
      expect(stdout).toContain('Analysis complete');
    });

    test('should handle no arguments gracefully', async () => {
      try {
        const { stdout } = await execAsync('node ./bin/wundr-simple.js', { timeout: 5000 });
        
        // Should show help when no args provided
        expect(stdout).toContain('Usage:');
      } catch (error: any) {
        // Command might exit with code 0 or 1, both are acceptable for help display
        expect(error.code).toBeLessThanOrEqual(1);
        if (error.stdout) {
          expect(error.stdout).toContain('Usage:');
        }
      }
    });
  });

  test.describe('File System Operations', () => {
    test('should handle valid directory paths', async () => {
      // Create a sample project structure
      await createSampleProject(tempDir);
      
      const { stdout } = await execAsync(`node ./bin/wundr-simple.js analyze --path ${tempDir}`);
      
      expect(stdout).toContain('Analyzing project at:');
      expect(stdout).toContain(tempDir);
    });

    test('should handle non-existent paths gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent-folder');
      
      // This should not crash the CLI
      const { stdout } = await execAsync(`node ./bin/wundr-simple.js analyze --path ${nonExistentPath}`);
      
      expect(stdout).toContain('Analyzing project at:');
    });
  });

  // Helper function to create a sample project
  async function createSampleProject(dir: string) {
    const files = [
      { path: 'src/index.ts', content: 'export { default } from "./main";' },
      { path: 'src/main.ts', content: 'import { helper } from "./utils"; export default helper;' },
      { path: 'src/utils.ts', content: 'export const helper = () => "hello";' },
      { path: 'package.json', content: '{"name": "test-project", "version": "1.0.0"}' }
    ];

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }
});