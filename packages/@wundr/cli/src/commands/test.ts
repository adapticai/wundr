import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';

export interface TestOptions {
  type?: 'ui' | 'api' | 'unit' | 'all';
  browser?: 'chromium' | 'firefox' | 'webkit';
  headed?: boolean;
  baseUrl?: string;
  config?: string;
  report?: boolean;
  watch?: boolean;
}

export class TestCommand {
  private testConfigPath: string;
  private testsPath: string;

  constructor() {
    // Tests are bundled with the CLI package
    this.testsPath = path.join(__dirname, '../../test-suites');
    this.testConfigPath = path.join(process.cwd(), 'wundr-test.config.js');
  }

  async run(options: TestOptions): Promise<void> {
    const spinner = ora('Preparing test environment...').start();

    try {
      // Check if tests are available
      if (!(await fs.pathExists(this.testsPath))) {
        spinner.fail('Test suites not found. Please reinstall @wundr/cli');
        return;
      }

      // Load or create config
      const config = await this.loadConfig(options);

      // Setup test environment
      await this.setupTestEnvironment(config);

      spinner.succeed('Test environment ready');

      // Run tests based on type
      switch (options.type) {
        case 'ui':
          await this.runUITests(config, options);
          break;
        case 'api':
          await this.runAPITests(config, options);
          break;
        case 'unit':
          await this.runUnitTests(config, options);
          break;
        default:
          await this.runAllTests(config, options);
      }
    } catch (error) {
      spinner.fail('Test execution failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async loadConfig(options: TestOptions): Promise<any> {
    let config = {
      baseUrl:
        options.baseUrl || process.env.TEST_BASE_URL || 'http://localhost:3000',
      testDir: this.testsPath,
      outputDir: path.join(process.cwd(), 'test-results'),
      timeout: 30000,
      retries: 2,
      workers: 4,
      use: {
        headless: !options.headed,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'on-first-retry',
      },
    };

    // Check for custom config
    if (options.config) {
      const customConfigPath = path.resolve(options.config);
      if (await fs.pathExists(customConfigPath)) {
        const customConfig = require(customConfigPath);
        config = { ...config, ...customConfig };
      }
    } else if (await fs.pathExists(this.testConfigPath)) {
      const projectConfig = require(this.testConfigPath);
      config = { ...config, ...projectConfig };
    }

    return config;
  }

  private async setupTestEnvironment(config: any): Promise<void> {
    // Create output directory
    await fs.ensureDir(config.outputDir);

    // Copy test files to temp location if needed
    const tempTestDir = path.join(config.outputDir, '.test-suites');
    await fs.copy(this.testsPath, tempTestDir, { overwrite: true });

    // Generate Playwright config
    const playwrightConfig = `
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '${tempTestDir}',
  outputDir: '${config.outputDir}',
  timeout: ${config.timeout},
  retries: ${config.retries},
  workers: ${config.workers},
  reporter: [
    ['html', { outputFolder: '${path.join(config.outputDir, 'html-report')}' }],
    ['json', { outputFile: '${path.join(config.outputDir, 'results.json')}' }],
    ['list']
  ],
  use: {
    baseURL: '${config.baseUrl}',
    ...${JSON.stringify(config.use, null, 2)}
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
`;

    await fs.writeFile(
      path.join(config.outputDir, 'playwright.config.ts'),
      playwrightConfig
    );
  }

  private async runUITests(config: any, options: TestOptions): Promise<void> {
    console.log(chalk.blue('\n🧪 Running UI Tests...'));

    const args = [
      'playwright',
      'test',
      '--config',
      path.join(config.outputDir, 'playwright.config.ts'),
    ];

    if (options.browser) {
      args.push('--project', options.browser);
    }

    if (options.watch) {
      args.push('--ui');
    }

    await this.runCommand('npx', args);

    if (options.report) {
      console.log(chalk.green('\n📊 Opening test report...'));
      await this.runCommand('npx', [
        'playwright',
        'show-report',
        path.join(config.outputDir, 'html-report'),
      ]);
    }
  }

  private async runAPITests(config: any, options: TestOptions): Promise<void> {
    console.log(chalk.blue('\n🔌 Running API Tests...'));

    const testFiles = await fs.readdir(path.join(config.testDir, 'api'));
    const apiTests = testFiles.filter(f => f.endsWith('.spec.ts'));

    for (const testFile of apiTests) {
      console.log(chalk.gray(`  Running ${testFile}...`));
      await this.runCommand('npx', [
        'playwright',
        'test',
        path.join(config.testDir, 'api', testFile),
        '--config',
        path.join(config.outputDir, 'playwright.config.ts'),
      ]);
    }
  }

  private async runUnitTests(config: any, options: TestOptions): Promise<void> {
    console.log(chalk.blue('\n🔬 Running Unit Tests...'));

    // Check for Jest or Vitest
    const packageJson = await fs.readJson(
      path.join(process.cwd(), 'package.json')
    );

    if (packageJson.scripts?.test) {
      await this.runCommand('npm', ['run', 'test']);
    } else {
      console.log(chalk.yellow('No unit tests configured in package.json'));
    }
  }

  private async runAllTests(config: any, options: TestOptions): Promise<void> {
    console.log(chalk.blue('\n🚀 Running All Tests...'));

    await this.runUnitTests(config, options);
    await this.runAPITests(config, options);
    await this.runUITests(config, options);
  }

  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
      });

      child.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }
}

export function createTestCommand(): Command {
  const command = new Command('test')
    .description('Run tests against your application')
    .option(
      '-t, --type <type>',
      'Type of tests to run (ui, api, unit, all)',
      'all'
    )
    .option(
      '-b, --browser <browser>',
      'Browser to use (chromium, firefox, webkit)'
    )
    .option('--headed', 'Run tests in headed mode')
    .option('--base-url <url>', 'Base URL for the application')
    .option('-c, --config <path>', 'Path to custom test configuration')
    .option('-r, --report', 'Open HTML report after tests')
    .option('-w, --watch', 'Run tests in watch mode')
    .action(async options => {
      const testCommand = new TestCommand();
      await testCommand.run(options);
    });

  // Add init subcommand
  command
    .command('init')
    .description('Initialize test configuration for your project')
    .action(async () => {
      const { TestInitCommand } = await import('./test-init');
      const initCommand = new TestInitCommand();
      await initCommand.run();
    });

  return command;
}
