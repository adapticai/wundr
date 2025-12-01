import path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';
import inquirer from 'inquirer';

export class TestInitCommand {
  async run(): Promise<void> {
    console.log(chalk.blue('\n🧪 Initializing Wundr Test Configuration\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseURL',
        message: "What is your application's base URL?",
        default: 'http://localhost:3000',
      },
      {
        type: 'input',
        name: 'apiURL',
        message: 'What is your API base URL?',
        default: 'http://localhost:3000/api',
      },
      {
        type: 'checkbox',
        name: 'testSuites',
        message: 'Which test suites would you like to enable?',
        choices: [
          { name: 'Smoke Tests', value: 'smoke', checked: true },
          {
            name: 'Accessibility Tests',
            value: 'accessibility',
            checked: true,
          },
          { name: 'API Tests', value: 'api', checked: true },
          { name: 'Performance Tests', value: 'performance', checked: false },
          { name: 'Security Tests', value: 'security', checked: false },
        ],
      },
      {
        type: 'checkbox',
        name: 'browsers',
        message: 'Which browsers should we test?',
        choices: [
          { name: 'Chromium', value: 'chromium', checked: true },
          { name: 'Firefox', value: 'firefox', checked: false },
          { name: 'Safari (WebKit)', value: 'webkit', checked: false },
          { name: 'Mobile', value: 'mobile', checked: true },
        ],
      },
      {
        type: 'confirm',
        name: 'headless',
        message: 'Run tests in headless mode?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'ci',
        message: 'Would you like to add CI/CD configuration?',
        default: true,
      },
    ]);

    // Generate configuration
    const config = this.generateConfig(answers);

    // Write configuration file
    const configPath = path.join(process.cwd(), 'wundr-test.config.js');
    await fs.writeFile(configPath, config);

    console.log(
      chalk.green('\n✅ Test configuration created: wundr-test.config.js')
    );

    // Add package.json scripts
    await this.updatePackageJson();

    // Generate CI configuration if requested
    if (answers.ci) {
      await this.generateCIConfig(answers);
    }

    // Show next steps
    console.log(chalk.cyan('\n📋 Next Steps:'));
    console.log('  1. Install Playwright: npm install -D @playwright/test');
    console.log('  2. Run tests: npm run test:wundr');
    console.log('  3. View report: npm run test:report');
    console.log('  4. Customize wundr-test.config.js as needed');
  }

  private generateConfig(answers: any): string {
    const testSuites = answers.testSuites.reduce((acc: any, suite: string) => {
      acc[suite] = true;
      return acc;
    }, {});

    const projects = answers.browsers
      .map((browser: string) => {
        if (browser === 'mobile') {
          return `    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      }
    }`;
        }
        return `    {
      name: '${browser}',
      use: { 
        browserName: '${browser}',
        viewport: { width: 1280, height: 720 }
      }
    }`;
      })
      .join(',\n');

    return `/**
 * Wundr Test Configuration
 * Generated on ${new Date().toISOString()}
 */

module.exports = {
  // Base URL of your application
  baseURL: '${answers.baseURL}',
  
  // Test execution settings
  timeout: 30000,
  retries: 2,
  workers: 4,
  
  // Browser settings
  headless: ${answers.headless},
  slowMo: 0,
  
  // Screenshot and video settings
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
  
  // API configuration
  api: {
    baseURL: '${answers.apiURL}',
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 10000
  },
  
  // Enabled test suites
  testSuites: ${JSON.stringify(testSuites, null, 4)},
  
  // Projects/browsers to test
  projects: [
${projects}
  ]
};`;
  }

  private async updatePackageJson(): Promise<void> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);

      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts['test:wundr'] = 'wundr test';
      packageJson.scripts['test:wundr:ui'] = 'wundr test --type ui';
      packageJson.scripts['test:wundr:api'] = 'wundr test --type api';
      packageJson.scripts['test:wundr:headed'] = 'wundr test --headed';
      packageJson.scripts['test:report'] = 'wundr test --report';

      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

      console.log(chalk.green('✅ Added test scripts to package.json'));
    }
  }

  private async generateCIConfig(answers: any): Promise<void> {
    const githubWorkflow = `name: Wundr Tests

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Install Playwright
      run: npx playwright install --with-deps
      
    - name: Run Wundr tests
      run: npm run test:wundr
      env:
        TEST_BASE_URL: '${answers.baseURL}'
        
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: test-results/
        retention-days: 30`;

    const githubDir = path.join(process.cwd(), '.github', 'workflows');
    await fs.ensureDir(githubDir);
    await fs.writeFile(path.join(githubDir, 'wundr-tests.yml'), githubWorkflow);

    console.log(
      chalk.green(
        '✅ Created GitHub Actions workflow: .github/workflows/wundr-tests.yml'
      )
    );
  }
}

export function createTestInitCommand(): Command {
  const command = new Command('test-init')
    .description('Initialize Wundr test configuration for your project')
    .action(async () => {
      const initCommand = new TestInitCommand();
      await initCommand.run();
    });

  return command;
}
