import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Cross-Component Integration E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let tempDir: string;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Create temporary directory for CLI operations
    tempDir = path.join(process.cwd(), 'temp-integration-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  test.afterEach(async () => {
    await context.close();
    
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test.describe('CLI to Dashboard Integration', () => {
    test('should analyze project via CLI and display results in dashboard', async () => {
      // 1. Create test project structure
      await createComplexTestProject(tempDir);
      
      // 2. Run CLI analysis
      const { stdout: analysisOutput } = await execAsync(
        `node ./bin/wundr.js analyze --report --output ${tempDir}/analysis.json --path ${tempDir}`
      );
      
      expect(analysisOutput).toContain('Analysis complete');
      expect(analysisOutput).toContain('Report generated');
      
      // 3. Verify analysis file was created
      const analysisPath = path.join(tempDir, 'analysis.json');
      const analysisExists = await fs.access(analysisPath).then(() => true).catch(() => false);
      expect(analysisExists).toBe(true);
      
      // 4. Load analysis in dashboard
      await page.goto('/dashboard/upload');
      
      // Upload analysis file
      const fileInput = page.locator('input[type="file"][accept=".json"]');
      await fileInput.setInputFiles(analysisPath);
      await page.click('button:has-text("Upload Analysis")');
      
      // 5. Verify dashboard displays CLI analysis results
      await expect(page.locator('.analysis-imported')).toBeVisible({ timeout: 10000 });
      await page.goto('/dashboard/analysis');
      
      // Verify key metrics match CLI output
      await expect(page.locator('[data-testid="files-count"]')).toContainText(/\d+/);
      await expect(page.locator('[data-testid="issues-count"]')).toContainText(/\d+/);
      
      // Verify issue details are accessible
      await page.click('.issue-item:first-child .issue-title');
      await expect(page.locator('.issue-modal')).toBeVisible();
      await expect(page.locator('.issue-location')).toContainText('src/');
    });

    test('should sync CLI configuration with dashboard settings', async () => {
      // 1. Initialize configuration via CLI
      await execAsync(`node ./bin/wundr.js init --path ${tempDir}`);
      
      const configPath = path.join(tempDir, 'wundr.config.json');
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(configExists).toBe(true);
      
      // 2. Load configuration in dashboard
      await page.goto('/dashboard/settings');
      
      const configFileInput = page.locator('input[type="file"][accept=".json"]');
      await configFileInput.setInputFiles(configPath);
      await page.click('button:has-text("Import Configuration")');
      
      // 3. Verify settings are loaded
      await expect(page.locator('.config-imported')).toBeVisible();
      
      // 4. Modify settings in dashboard
      await page.fill('input[name="max-file-size"]', '5000');
      await page.selectOption('select[name="analysis-depth"]', 'deep');
      await page.click('button:has-text("Save Settings")');
      
      // 5. Export updated configuration
      await page.click('button:has-text("Export Configuration")');
      
      // Wait for download
      const download = await page.waitForEvent('download');
      const downloadPath = path.join(tempDir, 'exported-config.json');
      await download.saveAs(downloadPath);
      
      // 6. Verify CLI uses updated configuration
      const { stdout } = await execAsync(
        `node ./bin/wundr.js analyze --config ${downloadPath} --path ${tempDir}`
      );
      
      expect(stdout).toContain('Using configuration:');
      expect(stdout).toContain('max-file-size: 5000');
    });

    test('should handle real-time CLI progress in dashboard', async () => {
      await createLargeTestProject(tempDir, 200); // Large project for progress tracking
      
      // 1. Start dashboard monitoring
      await page.goto('/dashboard/monitoring');
      
      // 2. Enable CLI monitoring mode
      await page.click('button:has-text("Enable CLI Monitor")');
      await expect(page.locator('.cli-monitor-active')).toBeVisible();
      
      // 3. Start long-running CLI analysis in background
      const childProcess = exec(
        `node ./bin/wundr.js analyze --verbose --progress --path ${tempDir}`,
        { cwd: process.cwd() }
      );
      
      // 4. Monitor progress updates in dashboard
      await expect(page.locator('.cli-progress-bar')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.progress-percentage')).toContainText(/%/);
      
      // 5. Wait for completion
      await new Promise((resolve, reject) => {
        childProcess.on('exit', resolve);
        childProcess.on('error', reject);
      });
      
      // 6. Verify completion notification
      await expect(page.locator('.cli-analysis-complete')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.completion-summary')).toContainText('Files analyzed:');
    });
  });

  test.describe('Dashboard to CLI Export Integration', () => {
    test('should export dashboard analysis for CLI processing', async () => {
      // 1. Set up dashboard with analysis data
      await page.goto('/dashboard/analysis');
      
      // Mock analysis data load
      await page.evaluate(() => {
        (window as any).mockAnalysisData = {
          files: 50,
          issues: 25,
          duplicates: 8,
          circularDeps: 3,
          details: [
            { file: 'src/utils.ts', line: 15, type: 'duplicate', severity: 'medium' },
            { file: 'src/main.ts', line: 8, type: 'circular-dep', severity: 'high' }
          ]
        };
      });
      
      // 2. Export analysis data
      await page.click('button:has-text("Export Analysis")');
      await page.selectOption('select[name="export-format"]', 'cli-compatible');
      await page.click('button:has-text("Download Export")');
      
      const download = await page.waitForEvent('download');
      const exportPath = path.join(tempDir, 'dashboard-export.json');
      await download.saveAs(exportPath);
      
      // 3. Verify CLI can process exported data
      const { stdout } = await execAsync(
        `node ./bin/wundr.js consolidate --import ${exportPath} --dry-run --path ${tempDir}`
      );
      
      expect(stdout).toContain('Imported analysis data');
      expect(stdout).toContain('Issues to address: 25');
      expect(stdout).toContain('Duplicates to consolidate: 8');
    });

    test('should generate CLI commands from dashboard interactions', async () => {
      // 1. Navigate to dashboard command generator
      await page.goto('/dashboard/tools/cli-generator');
      
      // 2. Configure analysis options through UI
      await page.check('input[name="include-duplicates"]');
      await page.check('input[name="include-circular"]');
      await page.selectOption('select[name="output-format"]', 'detailed');
      await page.fill('input[name="target-path"]', '/path/to/project');
      
      // 3. Generate CLI command
      await page.click('button:has-text("Generate Command")');
      
      // 4. Verify generated command
      const generatedCommand = await page.locator('.generated-command').textContent();
      expect(generatedCommand).toContain('node ./bin/wundr.js analyze');
      expect(generatedCommand).toContain('--duplicates');
      expect(generatedCommand).toContain('--circular');
      expect(generatedCommand).toContain('--format detailed');
      expect(generatedCommand).toContain('--path /path/to/project');
      
      // 5. Test copy functionality
      await page.click('button:has-text("Copy Command")');
      
      // 6. Verify command execution (mock)
      await page.click('button:has-text("Test Command")');
      await expect(page.locator('.command-validation')).toContainText('Command syntax valid');
    });
  });

  test.describe('Plugin System Integration', () => {
    test('should load and execute plugins across CLI and dashboard', async () => {
      // 1. Create a test plugin
      const pluginCode = `
        module.exports = {
          name: 'test-integration-plugin',
          version: '1.0.0',
          analyze: (files) => ({
            customMetric: files.length * 2,
            pluginResults: ['Plugin executed successfully']
          }),
          dashboard: {
            component: 'CustomMetricDisplay',
            routes: ['/plugin/test-integration']
          }
        };
      `;
      
      const pluginPath = path.join(tempDir, 'test-plugin.js');
      await fs.writeFile(pluginPath, pluginCode);
      
      // 2. Install plugin via CLI
      const { stdout: installOutput } = await execAsync(
        `node ./bin/wundr.js plugin install --path ${pluginPath}`
      );
      
      expect(installOutput).toContain('Plugin installed: test-integration-plugin');
      
      // 3. Run analysis with plugin via CLI
      await createSampleProject(tempDir);
      const { stdout: analysisOutput } = await execAsync(
        `node ./bin/wundr.js analyze --plugins test-integration-plugin --path ${tempDir}`
      );
      
      expect(analysisOutput).toContain('customMetric:');
      expect(analysisOutput).toContain('Plugin executed successfully');
      
      // 4. Verify plugin appears in dashboard
      await page.goto('/dashboard/plugins');
      await expect(page.locator('.plugin-item')).toContainText('test-integration-plugin');
      await expect(page.locator('.plugin-status')).toContainText('Active');
      
      // 5. Access plugin dashboard route
      await page.goto('/dashboard/plugin/test-integration');
      await expect(page.locator('.custom-metric-display')).toBeVisible();
    });

    test('should handle plugin errors gracefully across systems', async () => {
      // 1. Create faulty plugin
      const faultyPluginCode = `
        module.exports = {
          name: 'faulty-plugin',
          analyze: () => {
            throw new Error('Plugin intentional error');
          }
        };
      `;
      
      const faultyPluginPath = path.join(tempDir, 'faulty-plugin.js');
      await fs.writeFile(faultyPluginPath, faultyPluginCode);
      
      // 2. Test CLI error handling
      try {
        await execAsync(`node ./bin/wundr.js plugin install --path ${faultyPluginPath}`);
      } catch (error: any) {
        expect(error.stderr).toContain('Plugin installation failed');
      }
      
      // 3. Verify dashboard shows plugin error status
      await page.goto('/dashboard/plugins');
      await page.click('button:has-text("Install Plugin")');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(faultyPluginPath);
      await page.click('button:has-text("Upload Plugin")');
      
      await expect(page.locator('.plugin-error')).toBeVisible();
      await expect(page.locator('.plugin-error')).toContainText('Plugin intentional error');
    });
  });

  test.describe('Data Synchronization', () => {
    test('should maintain data consistency between CLI and dashboard', async () => {
      await createComplexTestProject(tempDir);
      
      // 1. Generate baseline analysis via CLI
      await execAsync(
        `node ./bin/wundr.js analyze --baseline --output ${tempDir}/baseline.json --path ${tempDir}`
      );
      
      // 2. Import baseline into dashboard
      await page.goto('/dashboard/baselines');
      
      const baselineFileInput = page.locator('input[type="file"][accept=".json"]');
      await baselineFileInput.setInputFiles(path.join(tempDir, 'baseline.json'));
      await page.click('button:has-text("Import Baseline")');
      
      await expect(page.locator('.baseline-imported')).toBeVisible();
      
      // 3. Modify project and re-analyze via CLI
      await fs.writeFile(
        path.join(tempDir, 'src/new-feature.ts'),
        'export const newFeature = () => console.log("new feature");'
      );
      
      await execAsync(
        `node ./bin/wundr.js analyze --compare-baseline --baseline ${tempDir}/baseline.json --path ${tempDir}`
      );
      
      // 4. Sync changes to dashboard
      await page.goto('/dashboard/analysis');
      await page.click('button:has-text("Sync with CLI")');
      
      // 5. Verify dashboard shows updated analysis
      await expect(page.locator('.sync-complete')).toBeVisible();
      await expect(page.locator('[data-testid="files-count"]')).toContainText(/\d+/);
      
      // 6. Verify baseline comparison is available
      await page.goto('/dashboard/baselines/compare');
      await expect(page.locator('.baseline-diff')).toBeVisible();
      await expect(page.locator('.new-files')).toContainText('new-feature.ts');
    });

    test('should handle concurrent updates from CLI and dashboard', async () => {
      await createSampleProject(tempDir);
      
      // 1. Start dashboard session
      await page.goto('/dashboard/analysis');
      await page.click('button:has-text("Start Live Analysis")');
      
      // 2. Simultaneously run CLI analysis
      const cliProcess = exec(
        `node ./bin/wundr.js analyze --live --path ${tempDir}`,
        { cwd: process.cwd() }
      );
      
      // 3. Verify dashboard handles concurrent access
      await expect(page.locator('.concurrent-session-warning')).toBeVisible({ timeout: 5000 });
      
      // 4. Choose resolution strategy
      await page.click('button:has-text("Merge Results")');
      
      // 5. Wait for CLI completion
      await new Promise((resolve, reject) => {
        cliProcess.on('exit', resolve);
        cliProcess.on('error', reject);
      });
      
      // 6. Verify merged results
      await expect(page.locator('.results-merged')).toBeVisible();
      await expect(page.locator('.merge-summary')).toContainText('Sources: CLI + Dashboard');
    });
  });

  // Helper functions
  async function createSampleProject(dir: string) {
    const files = [
      { path: 'src/index.ts', content: 'export { default } from "./main";' },
      { path: 'src/main.ts', content: 'import { helper } from "./utils"; export default helper;' },
      { path: 'src/utils.ts', content: 'export const helper = () => "hello world";' },
      { path: 'package.json', content: '{"name": "integration-test", "version": "1.0.0"}' }
    ];

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  async function createComplexTestProject(dir: string) {
    const files = [
      // Main application files
      { path: 'src/app.ts', content: 'import { UserService } from "./services/user"; import { AuthModule } from "./modules/auth"; export class App {}' },
      { path: 'src/main.ts', content: 'import { App } from "./app"; const app = new App(); app.start();' },
      
      // Services with circular dependencies
      { path: 'src/services/user.ts', content: 'import { AuthService } from "./auth"; export class UserService { auth = new AuthService(); }' },
      { path: 'src/services/auth.ts', content: 'import { UserService } from "./user"; export class AuthService { user: UserService; }' },
      
      // Duplicate code patterns
      { path: 'src/utils/validation.ts', content: 'export function validateEmail(email: string): boolean { return /^[^@]+@[^@]+\\.[^@]+$/.test(email); }' },
      { path: 'src/modules/auth.ts', content: 'function validateEmail(email: string): boolean { return /^[^@]+@[^@]+\\.[^@]+$/.test(email); } export class AuthModule {}' },
      { path: 'src/components/form.ts', content: 'const validateEmail = (email: string): boolean => /^[^@]+@[^@]+\\.[^@]+$/.test(email); export class FormComponent {}' },
      
      // Configuration and metadata
      { path: 'package.json', content: '{"name": "complex-integration-project", "version": "2.1.0", "dependencies": {"react": "^18.0.0"}}' },
      { path: 'tsconfig.json', content: '{"compilerOptions": {"target": "es2020", "module": "commonjs", "strict": true}}' },
    ];

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  async function createLargeTestProject(dir: string, fileCount: number) {
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    
    for (let i = 0; i < fileCount; i++) {
      const content = `
        export class Component${i} {
          private id = ${i};
          private dependencies: string[] = ${JSON.stringify(Array.from({ length: i % 5 }, (_, j) => `dep${j}`))};
          
          public process(): Promise<string> {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(\`Component \${this.id} processed\`);
              }, 10);
            });
          }
          
          public getDependencies(): string[] {
            return this.dependencies;
          }
        }
        
        export default Component${i};
      `;
      
      await fs.writeFile(path.join(dir, `src/component${i}.ts`), content);
    }
    
    // Create index file that imports all components
    const indexContent = Array.from({ length: fileCount }, (_, i) => 
      `export { default as Component${i} } from './component${i}';`
    ).join('\n');
    
    await fs.writeFile(path.join(dir, 'src/index.ts'), indexContent);
    await fs.writeFile(path.join(dir, 'package.json'), '{"name": "large-integration-project", "version": "1.0.0"}');
  }
});