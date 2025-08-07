import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

test.describe('Wundr CLI E2E Tests', () => {
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
    test('should display help information', async () => {
      const { stdout } = await execAsync('node ./bin/wundr.js --help');
      
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('Options:');
    });

    test('should display version information', async () => {
      const { stdout } = await execAsync('node ./bin/wundr.js --version');
      
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('should handle invalid commands gracefully', async () => {
      try {
        await execAsync('node ./bin/wundr.js invalid-command');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stderr).toContain('Unknown command');
      }
    });
  });

  test.describe('Analysis Commands', () => {
    test('should perform project analysis', async ({ page }) => {
      // Create a sample project structure
      await createSampleProject(tempDir);
      
      const { stdout } = await execAsync(`node ./bin/wundr.js analyze --path ${tempDir}`);
      
      expect(stdout).toContain('Analysis complete');
      expect(stdout).toContain('Files analyzed:');
      expect(stdout).toContain('Issues found:');
    });

    test('should detect circular dependencies', async () => {
      // Create project with circular dependencies
      await createProjectWithCircularDeps(tempDir);
      
      const { stdout } = await execAsync(`node ./bin/wundr.js analyze --circular --path ${tempDir}`);
      
      expect(stdout).toContain('Circular dependencies detected');
      expect(stdout).toContain('dependency cycle');
    });

    test('should identify duplicate code', async () => {
      // Create project with duplicate code
      await createProjectWithDuplicates(tempDir);
      
      const { stdout } = await execAsync(`node ./bin/wundr.js analyze --duplicates --path ${tempDir}`);
      
      expect(stdout).toContain('Duplicate code detected');
      expect(stdout).toContain('similarity');
    });

    test('should generate analysis reports', async () => {
      await createSampleProject(tempDir);
      
      const { stdout } = await execAsync(`node ./bin/wundr.js analyze --report --output ${tempDir}/report.json --path ${tempDir}`);
      
      expect(stdout).toContain('Report generated');
      
      // Verify report file exists and has valid content
      const reportPath = path.join(tempDir, 'report.json');
      const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
      expect(reportExists).toBe(true);
      
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('files');
    });
  });

  test.describe('Consolidation Commands', () => {
    test('should perform safe consolidation', async () => {
      await createProjectWithDuplicates(tempDir);
      
      const { stdout } = await execAsync(`node ./bin/wundr.js consolidate --dry-run --path ${tempDir}`);
      
      expect(stdout).toContain('Consolidation preview');
      expect(stdout).toContain('Operations to perform:');
      expect(stdout).toContain('Files to modify:');
    });

    test('should apply consolidation with backup', async () => {
      await createProjectWithDuplicates(tempDir);
      
      const { stdout } = await execAsync(`node ./bin/wundr.js consolidate --backup --path ${tempDir}`);
      
      expect(stdout).toContain('Consolidation complete');
      expect(stdout).toContain('Backup created');
      
      // Verify backup directory exists
      const backupExists = await fs.access(path.join(tempDir, '.wundr-backup')).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should handle consolidation errors gracefully', async () => {
      // Create a project with file permission issues
      await createSampleProject(tempDir);
      const readOnlyFile = path.join(tempDir, 'readonly.ts');
      await fs.writeFile(readOnlyFile, 'export const test = "readonly";');
      await fs.chmod(readOnlyFile, 0o444); // Read-only
      
      try {
        await execAsync(`node ./bin/wundr.js consolidate --path ${tempDir}`);
      } catch (error: any) {
        expect(error.stderr).toContain('Permission denied');
        expect(error.code).toBe(1);
      }
    });
  });

  test.describe('Configuration Management', () => {
    test('should initialize configuration', async () => {
      const { stdout } = await execAsync(`node ./bin/wundr.js init --path ${tempDir}`);
      
      expect(stdout).toContain('Configuration initialized');
      
      // Verify config file exists
      const configPath = path.join(tempDir, 'wundr.config.json');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);
      
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('rules');
      expect(config).toHaveProperty('ignore');
    });

    test('should validate configuration', async () => {
      // Create invalid config
      const invalidConfigPath = path.join(tempDir, 'wundr.config.json');
      await fs.writeFile(invalidConfigPath, '{"invalid": "config"}');
      
      try {
        await execAsync(`node ./bin/wundr.js validate --config ${invalidConfigPath}`);
      } catch (error: any) {
        expect(error.stderr).toContain('Configuration validation failed');
        expect(error.code).toBe(1);
      }
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should handle large projects efficiently', async () => {
      // Create a large project structure
      await createLargeProject(tempDir, 100); // 100 files
      
      const startTime = Date.now();
      const { stdout } = await execAsync(`node ./bin/wundr.js analyze --path ${tempDir}`);
      const duration = Date.now() - startTime;
      
      expect(stdout).toContain('Analysis complete');
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    test('should handle memory constraints', async () => {
      // Test with limited memory (requires Node.js --max-old-space-size flag)
      await createLargeProject(tempDir, 50);
      
      // This test verifies the CLI doesn't crash with memory issues
      const { stdout } = await execAsync(`node --max-old-space-size=512 ./bin/wundr.js analyze --path ${tempDir}`);
      
      expect(stdout).toContain('Analysis complete');
    });

    test('should recover from interruptions', async () => {
      await createSampleProject(tempDir);
      
      // Start a long-running operation and simulate interruption
      const childProcess = exec(`node ./bin/wundr.js analyze --path ${tempDir} --verbose`);
      
      // Wait a bit, then kill the process
      await new Promise(resolve => setTimeout(resolve, 1000));
      childProcess.kill('SIGINT');
      
      // Verify the CLI handles the interruption gracefully
      const exitCode = await new Promise((resolve) => {
        childProcess.on('exit', resolve);
      });
      
      expect(exitCode).toBe(130); // SIGINT exit code
    });
  });

  // Helper functions for creating test projects
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

  async function createProjectWithCircularDeps(dir: string) {
    const files = [
      { path: 'src/a.ts', content: 'import { b } from "./b"; export const a = b + 1;' },
      { path: 'src/b.ts', content: 'import { c } from "./c"; export const b = c + 1;' },
      { path: 'src/c.ts', content: 'import { a } from "./a"; export const c = a + 1;' },
      { path: 'package.json', content: '{"name": "circular-deps", "version": "1.0.0"}' }
    ];

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  async function createProjectWithDuplicates(dir: string) {
    const duplicateCode = 'function validateEmail(email: string): boolean { return /^[^@]+@[^@]+\\.[^@]+$/.test(email); }';
    
    const files = [
      { path: 'src/user.ts', content: `${duplicateCode}\nexport class User { validate(email: string) { return validateEmail(email); } }` },
      { path: 'src/auth.ts', content: `${duplicateCode}\nexport class Auth { isValidEmail(email: string) { return validateEmail(email); } }` },
      { path: 'src/form.ts', content: `${duplicateCode}\nexport class Form { checkEmail(email: string) { return validateEmail(email); } }` },
      { path: 'package.json', content: '{"name": "duplicate-code", "version": "1.0.0"}' }
    ];

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  async function createLargeProject(dir: string, fileCount: number) {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    
    for (let i = 0; i < fileCount; i++) {
      const content = `
        export class Module${i} {
          private value = ${i};
          
          public getValue(): number {
            return this.value;
          }
          
          public process(): string {
            return \`Processing module \${this.value}\`;
          }
        }
      `;
      
      await fs.writeFile(path.join(dir, `src/module${i}.ts`), content);
    }
    
    await fs.writeFile(path.join(dir, 'package.json'), '{"name": "large-project", "version": "1.0.0"}');
  }
});