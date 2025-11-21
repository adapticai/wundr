# @wundr.io Package Integration Guide

> Quick-start guide for integrating Wundr packages into your projects

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Common Integration Scenarios](#common-integration-scenarios)
3. [Code Examples by Use Case](#code-examples-by-use-case)
4. [Integration Patterns](#integration-patterns)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## Getting Started

### Quick Installation Matrix

| What You Want To Do      | Install These Packages                                     |
| ------------------------ | ---------------------------------------------------------- |
| Build a CLI tool         | `@wundr.io/core @wundr.io/config`                          |
| Analyze code             | `@wundr.io/analysis-engine`                                |
| Setup developer machines | `@wundr.io/computer-setup @wundr.io/core @wundr.io/config` |
| Create project templates | `@wundr.io/project-templates @wundr.io/core`               |
| Build plugins            | `@wundr.io/plugin-system @wundr.io/core`                   |
| Use full CLI             | `@wundr.io/cli` (includes everything)                      |
| Lightweight scripts      | `@wundr.io/core-simple @wundr.io/cli-simple`               |
| React components         | `@wundr.io/web-client-simple`                              |
| AI integration           | `@wundr.io/ai-integration`                                 |
| Security features        | `@wundr.io/security`                                       |

---

## Common Integration Scenarios

### Scenario 1: Adding Wundr to an Existing Node.js Project

**Goal:** Add Wundr utilities to your existing application

**Steps:**

```bash
# 1. Install core packages
npm install @wundr.io/core @wundr.io/config

# 2. Install dev dependencies
npm install -D @wundr.io/shared-config

# 3. Configure TypeScript (if using)
# Add to tsconfig.json:
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}

# 4. Configure ESLint (if using)
# Add to .eslintrc.js:
module.exports = {
  extends: ['@wundr.io/shared-config/eslint']
};
```

**Example Usage:**

```typescript
// src/index.ts
import { Logger } from '@wundr.io/core';
import { ConfigManager } from '@wundr.io/config';

const logger = new Logger('MyApp');
const config = await new ConfigManager().load();

logger.info('Application started', { config });
```

---

### Scenario 2: Building a Custom CLI Tool

**Goal:** Create a CLI application using Wundr

**Steps:**

```bash
# 1. Install dependencies
npm install @wundr.io/core @wundr.io/config commander inquirer chalk

# 2. Create project structure
mkdir -p src/commands
touch src/index.ts src/commands/hello.ts

# 3. Create bin script
mkdir bin
touch bin/mycli.js
chmod +x bin/mycli.js
```

**Example Implementation:**

```typescript
// bin/mycli.js
#!/usr/bin/env node
require('../dist/index.js');

// src/index.ts
import { Command } from 'commander';
import { Logger } from '@wundr.io/core';
import { ConfigManager } from '@wundr.io/config';
import helloCommand from './commands/hello';

const logger = new Logger('MyCLI');
const program = new Command();

program
  .name('mycli')
  .description('My custom CLI tool')
  .version('1.0.0');

// Add commands
helloCommand(program);

program.parse();

// src/commands/hello.ts
import { Command } from 'commander';
import { Logger } from '@wundr.io/core';

export default function helloCommand(program: Command) {
  const logger = new Logger('hello');

  program
    .command('hello <name>')
    .description('Say hello')
    .action((name: string) => {
      logger.info(`Hello, ${name}!`);
    });
}

// package.json
{
  "name": "mycli",
  "bin": {
    "mycli": "./bin/mycli.js"
  },
  "dependencies": {
    "@wundr.io/core": "^1.0.0",
    "@wundr.io/config": "^1.0.0",
    "commander": "^11.1.0"
  }
}
```

**Run:**

```bash
npm run build
npm link
mycli hello World
```

---

### Scenario 3: Integrating Code Analysis

**Goal:** Add code analysis to your CI/CD pipeline

**Steps:**

```bash
# 1. Install analysis engine
npm install -D @wundr.io/analysis-engine

# 2. Create analysis script
touch scripts/analyze.ts
```

**Example Implementation:**

```typescript
// scripts/analyze.ts
import { CodeAnalyzer } from '@wundr.io/analysis-engine';
import * as fs from 'fs-extra';

async function analyze() {
  const analyzer = new CodeAnalyzer({
    projectPath: './src',
    include: ['**/*.ts', '**/*.tsx'],
    exclude: ['**/*.test.ts', '**/*.spec.ts']
  });

  console.log('Analyzing codebase...');
  const results = await analyzer.analyze();

  // Save results
  await fs.writeJson('./reports/analysis.json', results, { spaces: 2 });

  // Check thresholds
  if (results.metrics.complexity.average > 10) {
    console.error('❌ Average complexity too high!');
    process.exit(1);
  }

  console.log('✅ Analysis passed!');
}

analyze().catch(console.error);

// package.json scripts
{
  "scripts": {
    "analyze": "ts-node scripts/analyze.ts"
  }
}

// CI workflow (.github/workflows/ci.yml)
- name: Code Analysis
  run: npm run analyze
```

---

### Scenario 4: Setting Up Developer Machines

**Goal:** Automate new developer onboarding

**Steps:**

```bash
# 1. Install computer-setup
npm install @wundr.io/computer-setup @wundr.io/core @wundr.io/config

# 2. Create setup configuration
touch setup.config.yaml
```

**Example Configuration:**

```yaml
# setup.config.yaml
name: 'Backend Developer Setup'
description: 'Complete setup for backend developers'

profiles:
  backend-dev:
    tools:
      - name: node
        version: '20.x'
        required: true
      - name: git
        required: true
      - name: docker
        required: true
      - name: vscode
        required: false

    settings:
      claude-code:
        enabled: true
        workspace: '~/projects'

    verification:
      commands:
        - 'node --version'
        - 'git --version'
        - 'docker --version'
```

**Example Script:**

```typescript
// scripts/setup.ts
import { SetupOrchestrator } from '@wundr.io/computer-setup';
import { ConfigManager } from '@wundr.io/config';
import { Logger } from '@wundr.io/core';

const logger = new Logger('Setup');

async function setup() {
  const config = await new ConfigManager({
    configFile: './setup.config.yaml',
  }).load();

  const orchestrator = new SetupOrchestrator({
    platform: process.platform,
    config: config.profiles['backend-dev'],
  });

  logger.info('Starting developer machine setup...');

  await orchestrator.run();

  logger.info('✅ Setup complete!');
}

setup().catch(console.error);
```

---

### Scenario 5: Building Custom Plugins

**Goal:** Extend Wundr with custom functionality

**Steps:**

```bash
# 1. Install plugin system
npm install @wundr.io/plugin-system @wundr.io/core

# 2. Create plugin structure
mkdir -p src/plugins
touch src/plugins/my-plugin.ts
```

**Example Plugin:**

```typescript
// src/plugins/my-plugin.ts
import { Plugin } from '@wundr.io/plugin-system';
import { Logger } from '@wundr.io/core';

export class MyCustomPlugin implements Plugin {
  name = 'my-custom-plugin';
  version = '1.0.0';
  description = 'My custom plugin';

  private logger = new Logger('MyCustomPlugin');

  async initialize(context: any): Promise<void> {
    this.logger.info('Plugin initialized', { context });
  }

  async execute(context: any): Promise<any> {
    this.logger.info('Plugin executing', { context });

    // Plugin logic here
    return {
      success: true,
      result: 'Plugin executed successfully'
    };
  }

  async cleanup(): Promise<void> {
    this.logger.info('Plugin cleanup');
  }
}

// src/plugin-manager.ts
import { PluginManager } from '@wundr.io/plugin-system';
import { MyCustomPlugin } from './plugins/my-plugin';

const manager = new PluginManager();

manager.register(new MyCustomPlugin());

await manager.initializeAll();
await manager.executePlugin('my-custom-plugin', { data: 'test' });

// package.json
{
  "name": "wundr-plugin-my-custom",
  "main": "dist/index.js",
  "peerDependencies": {
    "@wundr.io/plugin-system": "^1.0.0",
    "@wundr.io/core": "^1.0.0"
  }
}
```

---

### Scenario 6: Lightweight Script with Simple Packages

**Goal:** Create a simple utility script with minimal dependencies

**Steps:**

```bash
# 1. Install simple packages
npm install @wundr.io/core-simple @wundr.io/cli-simple

# 2. Create script
touch src/quick-script.ts
```

**Example Implementation:**

```typescript
// src/quick-script.ts
import { Logger } from '@wundr.io/core-simple';

const logger = new Logger('QuickScript');

async function main() {
  logger.info('Starting quick script...');

  // Do work
  const result = await processData();

  logger.info('Script complete', { result });
}

async function processData() {
  // Simple processing logic
  return { processed: true };
}

main().catch(err => {
  logger.error('Script failed', err);
  process.exit(1);
});

// Run directly with ts-node
// npx ts-node src/quick-script.ts
```

---

### Scenario 7: React Application with Shared Components

**Goal:** Use Wundr React components in your web app

**Steps:**

```bash
# 1. Install web client
npm install @wundr.io/web-client-simple react react-dom

# 2. Configure TypeScript
# Ensure tsconfig.json has:
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

**Example Implementation:**

```tsx
// src/App.tsx
import React from 'react';
import { Button, Card } from '@wundr.io/web-client-simple';

export function App() {
  return (
    <div className='container'>
      <Card>
        <h1>My Wundr App</h1>
        <Button onClick={() => console.log('Clicked!')}>Click Me</Button>
      </Card>
    </div>
  );
}

// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
```

---

## Code Examples by Use Case

### Use Case 1: Logging in Your Application

```typescript
import { Logger } from '@wundr.io/core';

// Create logger instance
const logger = new Logger('MyModule');

// Different log levels
logger.debug('Debug information', { details: 'extra data' });
logger.info('Information message');
logger.warn('Warning message');
logger.error('Error occurred', new Error('Something went wrong'));

// With metadata
logger.info('User logged in', {
  userId: '123',
  timestamp: new Date(),
});

// Child loggers
const childLogger = logger.child({ component: 'SubModule' });
childLogger.info('Child logger message');
```

---

### Use Case 2: Configuration Management

```typescript
import { ConfigManager } from '@wundr.io/config';
import { Logger } from '@wundr.io/core';

const logger = new Logger('Config');

// Basic usage
const config = new ConfigManager();
const settings = await config.load();

logger.info('Config loaded', settings);

// With options
const customConfig = new ConfigManager({
  configFile: './.myapprc',
  envPrefix: 'MYAPP_',
  schema: {
    apiKey: { type: 'string', required: true },
    port: { type: 'number', default: 3000 },
    debug: { type: 'boolean', default: false },
  },
});

const validatedSettings = await customConfig.load();

// Accessing values
console.log(validatedSettings.apiKey);
console.log(validatedSettings.port);
```

---

### Use Case 3: Event-Driven Architecture

```typescript
import { EventBus } from '@wundr.io/core';
import { Logger } from '@wundr.io/core';

const logger = new Logger('Events');
const eventBus = EventBus.getInstance();

// Register event handlers
eventBus.on('user:created', data => {
  logger.info('User created', data);
});

eventBus.on('user:updated', data => {
  logger.info('User updated', data);
});

// Emit events
eventBus.emit('user:created', {
  id: '123',
  name: 'John Doe',
  timestamp: new Date(),
});

// One-time handlers
eventBus.once('app:ready', () => {
  logger.info('Application ready');
});

// Remove handlers
const handler = data => logger.info('Handler', data);
eventBus.on('test:event', handler);
eventBus.off('test:event', handler);
```

---

### Use Case 4: Data Validation

```typescript
import { Validator } from '@wundr.io/core';
import { z } from 'zod';

// Define schema
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(18).optional(),
});

// Validate data
const userData = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  email: 'john@example.com',
  age: 25,
};

try {
  const validUser = Validator.validate(userData, userSchema);
  console.log('Valid user:', validUser);
} catch (error) {
  console.error('Validation failed:', error);
}

// Async validation
const isValid = await Validator.validateAsync(userData, userSchema);
if (isValid) {
  // Process valid data
}
```

---

### Use Case 5: Complex Code Analysis

```typescript
import { CodeAnalyzer, ComplexityMetrics } from '@wundr.io/analysis-engine';
import { Logger } from '@wundr.io/core';
import * as fs from 'fs-extra';

const logger = new Logger('CodeAnalysis');

async function analyzeProject() {
  const analyzer = new CodeAnalyzer({
    projectPath: './src',
    include: ['**/*.ts', '**/*.tsx'],
    exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
  });

  logger.info('Starting code analysis...');

  // Full analysis
  const results = await analyzer.analyze();

  // Check for duplicates
  const duplicates = await analyzer.findDuplicates({
    minTokens: 50,
    similarity: 0.8,
  });

  // Check circular dependencies
  const circular = await analyzer.findCircularDependencies();

  // Complexity metrics
  const complexity = await analyzer.getComplexityMetrics();

  // Generate report
  const report = {
    summary: {
      filesAnalyzed: results.fileCount,
      linesOfCode: results.totalLines,
      averageComplexity: complexity.average,
      maxComplexity: complexity.max,
    },
    duplicates: duplicates.length,
    circularDeps: circular.length,
    violations: results.violations,
  };

  // Save report
  await fs.writeJson('./reports/code-analysis.json', report, { spaces: 2 });

  logger.info('Analysis complete', report.summary);

  // Exit with error if issues found
  if (duplicates.length > 0 || circular.length > 0) {
    logger.error('Code quality issues detected!');
    process.exit(1);
  }
}

analyzeProject().catch(console.error);
```

---

### Use Case 6: Template Generation

```typescript
import { TemplateGenerator } from '@wundr.io/project-templates';
import { Logger } from '@wundr.io/core';

const logger = new Logger('Templates');

async function createProject() {
  const generator = new TemplateGenerator({
    templateName: 'typescript-library',
    outputPath: './my-new-project',
  });

  logger.info('Generating project from template...');

  await generator.generate({
    projectName: 'my-awesome-library',
    author: 'John Doe',
    description: 'An awesome library',
    license: 'MIT',
    features: {
      testing: true,
      linting: true,
      ci: true,
    },
  });

  logger.info('Project created successfully!');
}

createProject().catch(console.error);
```

---

## Integration Patterns

### Pattern 1: Dependency Injection

```typescript
// services/logger.service.ts
import { Logger } from '@wundr.io/core';

export class LoggerService {
  private logger: Logger;

  constructor(private moduleName: string) {
    this.logger = new Logger(moduleName);
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error) {
    this.logger.error(message, error);
  }
}

// services/user.service.ts
import { LoggerService } from './logger.service';

export class UserService {
  constructor(private logger: LoggerService) {}

  async createUser(data: any) {
    this.logger.info('Creating user', { data });
    // User creation logic
  }
}

// index.ts
const loggerService = new LoggerService('UserModule');
const userService = new UserService(loggerService);
```

---

### Pattern 2: Factory Pattern

```typescript
import { Logger } from '@wundr.io/core';
import { ConfigManager } from '@wundr.io/config';

class ServiceFactory {
  private static instances = new Map();

  static async createService(name: string) {
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    const logger = new Logger(name);
    const config = await new ConfigManager().load();

    const service = {
      name,
      logger,
      config,
      execute: async () => {
        logger.info(`Executing ${name} service`);
      },
    };

    this.instances.set(name, service);
    return service;
  }
}

// Usage
const userService = await ServiceFactory.createService('UserService');
await userService.execute();
```

---

### Pattern 3: Middleware Pattern

```typescript
import { Logger } from '@wundr.io/core';
import { EventBus } from '@wundr.io/core';

type Middleware = (context: any, next: () => Promise<void>) => Promise<void>;

class Pipeline {
  private middlewares: Middleware[] = [];
  private logger = new Logger('Pipeline');

  use(middleware: Middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context: any) {
    let index = 0;

    const next = async () => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(context, next);
      }
    };

    await next();
  }
}

// Usage
const pipeline = new Pipeline();

pipeline.use(async (ctx, next) => {
  console.log('Logging middleware');
  await next();
});

pipeline.use(async (ctx, next) => {
  console.log('Validation middleware');
  await next();
});

await pipeline.execute({ data: 'test' });
```

---

## Troubleshooting

### Issue 1: Module Not Found

**Error:**

```
Error: Cannot find module '@wundr.io/core'
```

**Solution:**

```bash
# Ensure package is installed
npm install @wundr.io/core

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript paths in tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
```

---

### Issue 2: TypeScript Type Errors

**Error:**

```
Could not find a declaration file for module '@wundr.io/core'
```

**Solution:**

```bash
# Ensure types are included
npm install @types/node

# Check that package includes types
# package.json should have:
"types": "dist/index.d.ts"

# Ensure TypeScript config is correct
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": false
  }
}
```

---

### Issue 3: Logger Not Working

**Error:**

```
Logger output not appearing
```

**Solution:**

```typescript
import { Logger } from '@wundr.io/core';

// Set log level
const logger = new Logger('MyApp', {
  level: 'debug', // or 'info', 'warn', 'error'
});

// Check that messages are at correct level
logger.debug('This only shows if level is debug');
logger.info('This shows if level is info or debug');

// Ensure logger is configured
Logger.configure({
  level: process.env.LOG_LEVEL || 'info',
  format: 'json', // or 'pretty'
});
```

---

### Issue 4: Config Not Loading

**Error:**

```
Configuration file not found
```

**Solution:**

```typescript
import { ConfigManager } from '@wundr.io/config';
import * as path from 'path';

// Use explicit path
const config = new ConfigManager({
  configFile: path.join(process.cwd(), '.wundrrc'),
});

// Check file exists
import * as fs from 'fs-extra';
if (await fs.pathExists('.wundrrc')) {
  console.log('Config file exists');
}

// Use default values
const config = new ConfigManager({
  defaults: {
    apiKey: 'default-key',
    port: 3000,
  },
});
```

---

## Best Practices

### Best Practice 1: Structured Logging

```typescript
import { Logger } from '@wundr.io/core';

class UserService {
  private logger = new Logger('UserService');

  async createUser(data: any) {
    const correlationId = generateId();

    this.logger.info('Creating user', {
      correlationId,
      email: data.email,
      // Don't log sensitive data like passwords!
    });

    try {
      const user = await this.db.create(data);

      this.logger.info('User created successfully', {
        correlationId,
        userId: user.id,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to create user', {
        correlationId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
```

---

### Best Practice 2: Configuration Hierarchy

```typescript
// config/default.ts
export default {
  server: {
    port: 3000,
    host: 'localhost',
  },
  database: {
    host: 'localhost',
    port: 5432,
  },
};

// config/production.ts
export default {
  server: {
    port: process.env.PORT || 8080,
    host: '0.0.0.0',
  },
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
  },
};

// src/config.ts
import { ConfigManager } from '@wundr.io/config';
import defaultConfig from '../config/default';
import productionConfig from '../config/production';

const env = process.env.NODE_ENV || 'development';
const envConfig = env === 'production' ? productionConfig : {};

export const config = new ConfigManager({
  defaults: defaultConfig,
  overrides: envConfig,
});
```

---

### Best Practice 3: Error Handling

```typescript
import { Logger } from '@wundr.io/core';

const logger = new Logger('App');

// Custom error classes
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Error handler
async function handleError(error: Error) {
  if (error instanceof AppError) {
    logger.error('Application error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });
  } else {
    logger.error('Unexpected error', {
      message: error.message,
      stack: error.stack,
    });
  }
}

// Usage
try {
  await riskyOperation();
} catch (error) {
  await handleError(error);
}
```

---

### Best Practice 4: Testing Integration

```typescript
// __tests__/user.service.test.ts
import { Logger } from '@wundr.io/core';
import { UserService } from '../src/services/user.service';

describe('UserService', () => {
  let userService: UserService;
  let mockLogger: Logger;

  beforeEach(() => {
    // Create test logger with suppressed output
    mockLogger = new Logger('Test', { level: 'silent' });
    userService = new UserService(mockLogger);
  });

  test('should create user', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
    };

    const user = await userService.createUser(userData);

    expect(user).toBeDefined();
    expect(user.email).toBe(userData.email);
  });
});
```

---

**Last Updated:** 2025-11-21 **Maintained By:** Wundr Team **Questions?** Open an issue at
https://github.com/adapticai/wundr/issues
