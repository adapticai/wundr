# API Reference

This document provides a comprehensive API reference for the new-starter package when used programmatically.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Core Classes](#core-classes)
- [Commands](#commands)
- [Configuration API](#configuration-api)
- [Utilities](#utilities)
- [Types and Interfaces](#types-and-interfaces)
- [Events](#events)
- [Error Handling](#error-handling)

## Installation

```bash
npm install @adapticai/new-starter
```

## Basic Usage

### As a Module

```typescript
import { SetupCommand, ValidateCommand, ConfigCommand } from '@adapticai/new-starter';

// Run setup programmatically
const setup = new SetupCommand({
  email: 'user@example.com',
  githubUsername: 'username',
  name: 'Full Name',
  rootDir: '~/Development',
  skipPrompts: true
});

await setup.execute();
```

### As a CLI Library

```typescript
import { cli } from '@adapticai/new-starter';

// Execute CLI commands programmatically
await cli.parseAsync(['setup', '--skip-prompts']);
```

## Core Classes

### SetupCommand

Main class for environment setup.

```typescript
class SetupCommand {
  constructor(options?: SetupOptions);
  execute(): Promise<void>;
  validateOptions(): void;
  runSetupScripts(): Promise<void>;
  static fromConfig(configPath?: string): SetupCommand;
}
```

#### Constructor Options

```typescript
interface SetupOptions {
  email?: string;           // Email address
  githubUsername?: string;   // GitHub username
  githubEmail?: string;      // GitHub email (defaults to email)
  name?: string;             // Full name
  company?: string;          // Company name
  rootDir?: string;          // Root directory for development (default: ~/Development)
  skipPrompts?: boolean;     // Skip interactive prompts
  verbose?: boolean;         // Enable verbose output
  only?: string;             // Comma-separated list of tools to install
  exclude?: string;          // Comma-separated list of tools to exclude
}
```

#### Methods

##### execute()
Runs the complete setup process.

```typescript
const setup = new SetupCommand(options);
await setup.execute();
```

##### validateOptions()
Validates the provided options.

```typescript
setup.validateOptions(); // Throws if invalid
```

##### runSetupScripts()
Executes individual setup scripts.

```typescript
await setup.runSetupScripts();
```

##### fromConfig() (static)
Creates instance from config file.

```typescript
const setup = SetupCommand.fromConfig('~/.new-starter/config.json');
await setup.execute();
```

### ValidateCommand

Validates the development environment.

```typescript
class ValidateCommand {
  constructor(options?: ValidateOptions);
  execute(): Promise<ValidationResult>;
  checkTool(tool: string): Promise<ToolCheck>;
  fixIssues(): Promise<void>;
}
```

#### Constructor Options

```typescript
interface ValidateOptions {
  fix?: boolean;        // Auto-fix issues
  verbose?: boolean;    // Verbose output
  tools?: string[];     // Specific tools to validate
}
```

#### Methods

##### execute()
Runs validation checks.

```typescript
const validator = new ValidateCommand({ fix: true });
const result = await validator.execute();
console.log(result.passed ? 'All checks passed' : 'Issues found');
```

##### checkTool()
Checks a specific tool.

```typescript
const check = await validator.checkTool('node');
if (!check.installed) {
  console.log(`${check.tool} is not installed`);
}
```

##### fixIssues()
Attempts to fix detected issues.

```typescript
await validator.fixIssues();
```

### ConfigCommand

Manages configuration settings.

```typescript
class ConfigCommand {
  constructor(options?: ConfigOptions);
  execute(): Promise<void>;
  get(key: string): any;
  set(key: string, value: any): void;
  list(): Config;
  reset(): void;
  save(): Promise<void>;
  load(): Config;
}
```

#### Constructor Options

```typescript
interface ConfigOptions {
  get?: string;     // Key to retrieve
  set?: string;     // Key=value to set
  list?: boolean;   // List all configuration
  reset?: boolean;  // Reset to defaults
  configPath?: string; // Custom config path
}
```

#### Methods

##### get()
Retrieves a configuration value.

```typescript
const config = new ConfigCommand();
const rootDir = config.get('rootDir');
```

##### set()
Sets a configuration value.

```typescript
config.set('rootDir', '~/MyWorkspace');
await config.save();
```

##### list()
Returns all configuration.

```typescript
const allConfig = config.list();
console.log(allConfig);
```

##### reset()
Resets to default configuration.

```typescript
config.reset();
await config.save();
```

## Commands

### run()

Execute shell commands with proper environment.

```typescript
import { run } from '@adapticai/new-starter/utils';

await run('npm install', {
  cwd: '/path/to/project',
  env: { NODE_ENV: 'production' }
});
```

### spawn()

Spawn child processes.

```typescript
import { spawn } from '@adapticai/new-starter/utils';

const child = spawn('npm', ['install'], {
  stdio: 'inherit',
  cwd: '/path/to/project'
});

child.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
});
```

## Configuration API

### loadConfig()

Load configuration from file.

```typescript
import { loadConfig } from '@adapticai/new-starter/config';

const config = await loadConfig('~/.new-starter/config.json');
```

### saveConfig()

Save configuration to file.

```typescript
import { saveConfig } from '@adapticai/new-starter/config';

await saveConfig(config, '~/.new-starter/config.json');
```

### mergeConfig()

Merge configurations.

```typescript
import { mergeConfig } from '@adapticai/new-starter/config';

const merged = mergeConfig(defaultConfig, userConfig);
```

### validateConfig()

Validate configuration object.

```typescript
import { validateConfig } from '@adapticai/new-starter/config';

const errors = validateConfig(config);
if (errors.length > 0) {
  console.error('Invalid configuration:', errors);
}
```

## Utilities

### Logger

Logging utility with levels.

```typescript
import { Logger } from '@adapticai/new-starter/utils';

const logger = new Logger({ verbose: true });

logger.info('Information message');
logger.success('Success message');
logger.warning('Warning message');
logger.error('Error message');
logger.debug('Debug message'); // Only shown in verbose mode
```

### FileSystem

File system utilities.

```typescript
import { FileSystem } from '@adapticai/new-starter/utils';

// Check if file exists
const exists = await FileSystem.exists('/path/to/file');

// Create directory recursively
await FileSystem.mkdirp('/path/to/nested/dir');

// Copy file or directory
await FileSystem.copy('/source', '/destination');

// Read JSON file
const data = await FileSystem.readJSON('/path/to/file.json');

// Write JSON file
await FileSystem.writeJSON('/path/to/file.json', data);
```

### Template

Template rendering utilities.

```typescript
import { Template } from '@adapticai/new-starter/utils';

// Render template string
const rendered = Template.render('Hello {{name}}!', { name: 'World' });

// Render template file
const content = await Template.renderFile('/path/to/template.txt', {
  name: 'John',
  email: 'john@example.com'
});
```

### Shell

Shell command utilities.

```typescript
import { Shell } from '@adapticai/new-starter/utils';

// Execute command
const { stdout, stderr, code } = await Shell.exec('ls -la');

// Check if command exists
const hasGit = await Shell.which('git');

// Get environment variable
const home = Shell.env('HOME');

// Expand tilde in path
const fullPath = Shell.expandPath('~/Development');
```

## Types and Interfaces

### Config

Main configuration interface.

```typescript
interface Config {
  email?: string;
  githubUsername?: string;
  githubEmail?: string;
  name?: string;
  company?: string;
  rootDir: string;
  skipPrompts: boolean;
  verbose: boolean;
  tools: string[];
}
```

### Tool

Tool definition interface.

```typescript
interface Tool {
  name: string;
  displayName: string;
  description: string;
  required: boolean;
  dependencies?: string[];
  script: string;
  check?: () => Promise<boolean>;
  install?: () => Promise<void>;
}
```

### ValidationResult

Validation result interface.

```typescript
interface ValidationResult {
  passed: boolean;
  checks: ToolCheck[];
  errors: string[];
  warnings: string[];
}
```

### ToolCheck

Individual tool check result.

```typescript
interface ToolCheck {
  tool: string;
  installed: boolean;
  version?: string;
  error?: string;
  fixable?: boolean;
}
```

### SetupResult

Setup execution result.

```typescript
interface SetupResult {
  success: boolean;
  installedTools: string[];
  failedTools: string[];
  errors: Error[];
  duration: number;
}
```

## Events

### SetupCommand Events

```typescript
setup.on('start', (tools: string[]) => {
  console.log(`Starting setup for: ${tools.join(', ')}`);
});

setup.on('tool:start', (tool: string) => {
  console.log(`Installing ${tool}...`);
});

setup.on('tool:complete', (tool: string) => {
  console.log(`${tool} installed successfully`);
});

setup.on('tool:error', (tool: string, error: Error) => {
  console.error(`Failed to install ${tool}:`, error);
});

setup.on('complete', (result: SetupResult) => {
  console.log('Setup complete:', result);
});
```

### ValidateCommand Events

```typescript
validator.on('check:start', (tool: string) => {
  console.log(`Checking ${tool}...`);
});

validator.on('check:pass', (tool: string) => {
  console.log(`✓ ${tool}`);
});

validator.on('check:fail', (tool: string, error: string) => {
  console.log(`✗ ${tool}: ${error}`);
});

validator.on('fix:start', (tool: string) => {
  console.log(`Fixing ${tool}...`);
});

validator.on('fix:complete', (tool: string) => {
  console.log(`${tool} fixed`);
});
```

## Error Handling

### Error Types

```typescript
// Configuration error
class ConfigError extends Error {
  constructor(message: string, key?: string);
}

// Setup error
class SetupError extends Error {
  constructor(message: string, tool?: string, cause?: Error);
}

// Validation error
class ValidationError extends Error {
  constructor(message: string, checks?: ToolCheck[]);
}

// Command execution error
class CommandError extends Error {
  constructor(message: string, command?: string, code?: number);
}
```

### Error Handling Examples

```typescript
import {
  SetupCommand,
  ConfigError,
  SetupError,
  ValidationError
} from '@adapticai/new-starter';

try {
  const setup = new SetupCommand(options);
  await setup.execute();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error('Configuration error:', error.message);
  } else if (error instanceof SetupError) {
    console.error(`Setup failed for ${error.tool}:`, error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.checks);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Advanced Usage

### Custom Tool Installation

```typescript
import { Tool, ToolRegistry } from '@adapticai/new-starter';

// Define custom tool
const customTool: Tool = {
  name: 'mytool',
  displayName: 'My Custom Tool',
  description: 'A custom development tool',
  required: false,
  script: 'custom-install.sh',
  check: async () => {
    // Check if tool is installed
    return Shell.which('mytool') !== null;
  },
  install: async () => {
    // Custom installation logic
    await Shell.exec('brew install mytool');
  }
};

// Register tool
ToolRegistry.register(customTool);

// Use in setup
const setup = new SetupCommand({
  only: 'mytool'
});
await setup.execute();
```

### Extending Commands

```typescript
import { SetupCommand } from '@adapticai/new-starter';

class CustomSetupCommand extends SetupCommand {
  async execute(): Promise<void> {
    // Pre-setup tasks
    await this.preSetup();
    
    // Run parent setup
    await super.execute();
    
    // Post-setup tasks
    await this.postSetup();
  }
  
  private async preSetup(): Promise<void> {
    console.log('Running pre-setup tasks...');
    // Custom logic
  }
  
  private async postSetup(): Promise<void> {
    console.log('Running post-setup tasks...');
    // Custom logic
  }
}
```

### Middleware Pattern

```typescript
import { SetupCommand, Middleware } from '@adapticai/new-starter';

// Define middleware
const loggingMiddleware: Middleware = async (context, next) => {
  console.log('Before:', context.tool);
  await next();
  console.log('After:', context.tool);
};

const timingMiddleware: Middleware = async (context, next) => {
  const start = Date.now();
  await next();
  console.log(`${context.tool} took ${Date.now() - start}ms`);
};

// Apply middleware
const setup = new SetupCommand(options);
setup.use(loggingMiddleware);
setup.use(timingMiddleware);
await setup.execute();
```

### Hooks

```typescript
import { hooks } from '@adapticai/new-starter';

// Register hooks
hooks.register('before:setup', async (options) => {
  console.log('About to start setup with:', options);
});

hooks.register('after:tool:install', async (tool) => {
  console.log(`${tool} was installed`);
});

hooks.register('after:setup', async (result) => {
  console.log('Setup completed:', result);
});

// Hooks are automatically called during execution
const setup = new SetupCommand(options);
await setup.execute();
```

## Testing

### Mocking for Tests

```typescript
import { jest } from '@jest/globals';
import { SetupCommand } from '@adapticai/new-starter';

// Mock shell commands
jest.mock('@adapticai/new-starter/utils', () => ({
  Shell: {
    exec: jest.fn().mockResolvedValue({
      stdout: '',
      stderr: '',
      code: 0
    }),
    which: jest.fn().mockResolvedValue('/usr/bin/git')
  }
}));

// Test setup
describe('SetupCommand', () => {
  it('should install tools', async () => {
    const setup = new SetupCommand({
      only: 'git',
      skipPrompts: true
    });
    
    await setup.execute();
    
    expect(Shell.exec).toHaveBeenCalledWith(
      expect.stringContaining('git')
    );
  });
});
```

## Migration Guide

### From v0.x to v1.0

```typescript
// Old API (v0.x)
import newStarter from 'new-starter';
newStarter.setup(options);

// New API (v1.0)
import { SetupCommand } from '@adapticai/new-starter';
const setup = new SetupCommand(options);
await setup.execute();
```

## Performance

### Optimization Tips

1. **Use specific tools**
   ```typescript
   // Faster - only installs needed tools
   new SetupCommand({ only: 'node,docker' });
   
   // Slower - installs everything
   new SetupCommand({});
   ```

2. **Enable caching**
   ```typescript
   process.env.NEW_STARTER_CACHE = 'true';
   ```

3. **Parallel installation**
   ```typescript
   new SetupCommand({ parallel: true });
   ```

## Environment Variables

```bash
# Enable debug output
DEBUG=new-starter:*

# Set cache directory
NEW_STARTER_CACHE_DIR=~/.cache/new-starter

# Disable telemetry
NEW_STARTER_TELEMETRY=false

# Set timeout for operations (ms)
NEW_STARTER_TIMEOUT=300000

# Force color output
FORCE_COLOR=1

# Disable color output
NO_COLOR=1
```

## Support

- **Issues**: https://github.com/adapticai/new-starter/issues
- **Discussions**: https://github.com/adapticai/new-starter/discussions
- **API Docs**: https://adapticai.github.io/new-starter/api