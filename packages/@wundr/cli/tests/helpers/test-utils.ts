import fs from 'fs-extra';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ConfigManager } from '../../src/utils/config-manager';
import { WundrConfig } from '../../src/types';

export class TestHelper {
  private testDir: string;
  private originalCwd: string;

  constructor() {
    this.testDir = path.join(process.env.WUNDR_TEST_DIR || '/tmp', `test-${Date.now()}`);
    this.originalCwd = process.cwd();
  }

  async setup(): Promise<void> {
    await fs.ensureDir(this.testDir);
    process.chdir(this.testDir);
    
    // Create mock project structure
    await this.createMockProject();
  }

  async cleanup(): Promise<void> {
    process.chdir(this.originalCwd);
    if (await fs.pathExists(this.testDir)) {
      await fs.remove(this.testDir);
    }
  }

  async createMockProject(): Promise<void> {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        test: 'jest',
        build: 'tsc',
        lint: 'eslint .'
      },
      devDependencies: {
        'jest': '^29.0.0',
        'typescript': '^5.0.0',
        'eslint': '^8.0.0'
      }
    };

    await fs.writeJson(path.join(this.testDir, 'package.json'), packageJson);
    await fs.ensureDir(path.join(this.testDir, 'src'));
    await fs.ensureDir(path.join(this.testDir, 'tests'));
    
    // Create sample source files
    await fs.writeFile(
      path.join(this.testDir, 'src/index.ts'),
      'export const hello = () => "Hello, World!";'
    );
    
    await fs.writeFile(
      path.join(this.testDir, 'src/utils.ts'),
      'export const add = (a: number, b: number) => a + b;'
    );
  }

  async createWundrConfig(config: Partial<WundrConfig> = {}): Promise<string> {
    const defaultConfig: WundrConfig = {
      version: '1.0.0',
      defaultMode: 'cli',
      plugins: [],
      integrations: {},
      ai: {
        provider: 'mock',
        model: 'test-model'
      },
      analysis: {
        patterns: ['src/**/*'],
        excludes: ['node_modules/**'],
        maxDepth: 10
      },
      governance: {
        rules: [],
        severity: 'warning'
      }
    };

    const finalConfig = { ...defaultConfig, ...config };
    const configPath = path.join(this.testDir, '.wundr', 'config.json');
    
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, finalConfig);
    
    return configPath;
  }

  async runCommand(command: string, args: string[] = [], options: any = {}): Promise<CommandResult> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: this.testDir,
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code: code || 0,
          stdout,
          stderr,
          success: code === 0
        });
      });

      child.on('error', (error) => {
        resolve({
          code: 1,
          stdout,
          stderr: error.message,
          success: false,
          error
        });
      });
    });
  }

  async createBatchJob(name: string, commands: string[]): Promise<string> {
    const batchJob = {
      name,
      description: `Test batch job: ${name}`,
      commands: commands.map(cmd => ({ command: cmd })),
      parallel: false,
      continueOnError: false
    };

    const batchPath = path.join(this.testDir, '.wundr', 'batch', `${name}.yaml`);
    await fs.ensureDir(path.dirname(batchPath));
    
    const YAML = await import('yaml');
    await fs.writeFile(batchPath, YAML.stringify(batchJob));
    
    return batchPath;
  }

  async createWatchConfig(name: string, patterns: string[], commands: string[]): Promise<string> {
    const watchConfig = {
      patterns,
      commands: commands.map(cmd => ({
        trigger: 'change' as const,
        command: cmd
      })),
      debounce: 100
    };

    const watchPath = path.join(this.testDir, '.wundr', 'watch', `${name}.yaml`);
    await fs.ensureDir(path.dirname(watchPath));
    
    const YAML = await import('yaml');
    await fs.writeFile(watchPath, YAML.stringify(watchConfig));
    
    return watchPath;
  }

  async createPlugin(name: string, commands: any[] = []): Promise<string> {
    const pluginDir = path.join(this.testDir, '.wundr', 'plugins', name);
    await fs.ensureDir(pluginDir);

    const packageJson = {
      name,
      version: '1.0.0',
      main: 'index.js'
    };

    const pluginCode = `
      module.exports = class TestPlugin {
        constructor() {
          this.name = '${name}';
          this.version = '1.0.0';
          this.description = 'Test plugin';
          this.commands = ${JSON.stringify(commands)};
        }

        async activate(context) {
          console.log('Plugin ${name} activated');
        }

        async deactivate() {
          console.log('Plugin ${name} deactivated');
        }
      };
    `;

    await fs.writeJson(path.join(pluginDir, 'package.json'), packageJson);
    await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);

    return pluginDir;
  }

  getTestDir(): string {
    return this.testDir;
  }

  async waitFor(condition: () => Promise<boolean>, timeout: number = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Condition not met within timeout');
  }
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  success: boolean;
  error?: Error;
}

export const createMockConfig = (overrides: Partial<WundrConfig> = {}): WundrConfig => ({
  version: '1.0.0',
  defaultMode: 'cli',
  plugins: [],
  integrations: {},
  ai: {
    provider: 'mock',
    model: 'test-model'
  },
  analysis: {
    patterns: ['src/**/*'],
    excludes: ['node_modules/**'],
    maxDepth: 10
  },
  governance: {
    rules: [],
    severity: 'warning'
  },
  ...overrides
});

export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  setLevel: jest.fn()
};

export const mockSpinner = {
  start: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  stop: jest.fn(),
  text: ''
};