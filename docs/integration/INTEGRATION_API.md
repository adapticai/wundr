# Wundr Dashboard Consumer Integration API

This document provides comprehensive guidance for integrating the Wundr dashboard into your existing projects and workflows.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration API](#configuration-api)
3. [Plugin System](#plugin-system)
4. [Hooks and Callbacks](#hooks-and-callbacks)
5. [CLI Interface](#cli-interface)
6. [Security Model](#security-model)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Initialize Dashboard

```bash
# Initialize dashboard in your project
npx wundr init-dashboard

# Interactive setup
npx wundr init-dashboard --interactive

# Use specific template
npx wundr init-dashboard --template react-typescript
```

### 2. Basic Configuration

```json
{
  "branding": {
    "appName": "My Project Dashboard",
    "primaryColor": "#0066CC",
    "logo": "./assets/logo.png"
  },
  "analysis": {
    "defaultPath": "./src",
    "excludePatterns": ["node_modules", "dist"],
    "includeExtensions": [".ts", ".tsx", ".js", ".jsx"]
  },
  "integration": {
    "customScripts": [
      {
        "name": "run-tests",
        "command": "npm test",
        "description": "Run project tests",
        "safetyLevel": "safe"
      }
    ]
  }
}
```

### 3. Start Dashboard

```bash
# Development mode
npm run wundr:dev

# Production mode  
npm run wundr:start

# Custom port
WUNDR_PORT=4000 npm run wundr:dev
```

## Configuration API

### Schema

The configuration system uses Zod schemas for validation:

```typescript
import { ConfigurationAPI, DashboardConfig } from '@lumic/wundr/integration';

const configAPI = new ConfigurationAPI('./my-project');

// Load configuration
const config = await configAPI.loadConfig();

// Update configuration
await configAPI.updateConfig('branding', {
  appName: 'New Name',
  primaryColor: '#FF6B35'
});

// Validate configuration
const validConfig = configAPI.validateConfig(userConfig);
```

### Configuration Sections

#### Branding Configuration

```typescript
interface BrandingConfig {
  appName: string;           // Dashboard title
  logo?: string;             // Logo image path
  primaryColor: string;      // Primary theme color
  secondaryColor: string;    // Secondary theme color
  favicon?: string;          // Favicon path
  customCss?: string;        // Custom CSS file path
}
```

#### Analysis Configuration

```typescript
interface AnalysisConfig {
  defaultPath: string;           // Default analysis path
  excludePatterns: string[];     // Patterns to exclude
  includeExtensions: string[];   // File extensions to analyze
  maxFileSize: number;           // Max file size (bytes)
  enableRealtime: boolean;       // Real-time analysis
}
```

#### Integration Configuration

```typescript
interface IntegrationConfig {
  webhooks: WebhookConfig[];         // External webhooks
  apiEndpoints: ApiEndpoint[];       // Custom API endpoints
  customScripts: ScriptConfig[];     // Custom scripts
}
```

### Environment Variables

All configuration can be overridden with environment variables:

```bash
# Branding
WUNDR_APP_NAME="My Dashboard"
WUNDR_PRIMARY_COLOR="#0066CC"
WUNDR_LOGO="./assets/logo.png"

# Analysis
WUNDR_DEFAULT_PATH="./src"
WUNDR_EXCLUDE_PATTERNS="node_modules,dist,build"

# Server
WUNDR_PORT=3000
WUNDR_ENVIRONMENT=development
```

### Configuration Builder

Use the fluent API for programmatic configuration:

```typescript
import { ConfigurationBuilder } from '@lumic/wundr/integration';

const config = new ConfigurationBuilder()
  .branding({
    appName: 'My Project',
    primaryColor: '#0066CC'
  })
  .analysis({
    defaultPath: './src',
    excludePatterns: ['node_modules', 'dist']
  })
  .integration({
    customScripts: [
      {
        name: 'test',
        command: 'npm test',
        description: 'Run tests',
        safetyLevel: 'safe'
      }
    ]
  })
  .build();
```

## Plugin System

### Plugin Structure

```
my-plugin/
├── plugin.json          # Plugin manifest
├── index.js            # Main plugin file
├── components/         # React components
├── pages/             # Custom pages
└── styles/            # CSS styles
```

### Plugin Manifest

```json
{
  "name": "my-custom-plugin",
  "version": "1.0.0",
  "description": "Custom analytics plugin",
  "author": "Your Name",
  "main": "index.js",
  "type": "component",
  "dependencies": ["@wundr/core"],
  "permissions": [
    {
      "type": "filesystem",
      "scope": ["./data"],
      "reason": "Read analysis data"
    }
  ]
}
```

### Plugin Implementation

```javascript
// index.js
module.exports = {
  async initialize(context) {
    const { api, logger, config, hooks } = context;
    
    logger.info('Custom plugin initializing...');
    
    // Add menu item
    api.addMenuItem({
      id: 'custom-analytics',
      label: 'Custom Analytics',
      path: '/custom-analytics',
      icon: 'chart-bar',
      group: 'analytics'
    });
    
    // Register hooks
    hooks.afterAnalysis((data) => {
      logger.info('Analysis completed:', data.summary);
    });
  },
  
  // React component for the page
  component: function CustomAnalytics({ data }) {
    return React.createElement('div', null, [
      React.createElement('h1', null, 'Custom Analytics'),
      React.createElement('pre', null, JSON.stringify(data, null, 2))
    ]);
  },
  
  async cleanup() {
    console.log('Cleaning up custom plugin...');
  }
};
```

### Plugin Loading

```typescript
import { PluginSystem } from '@lumic/wundr/integration';

const pluginSystem = new PluginSystem();

// Initialize with plugin paths
await pluginSystem.initialize([
  './wundr-dashboard/plugins',
  './node_modules/@wundr/plugins'
]);

// Get loaded plugins
const plugins = pluginSystem.getRegistry().getAllPlugins();
```

### Built-in Plugin Types

- **Page Plugins**: Add custom pages to the dashboard
- **Component Plugins**: Add reusable UI components
- **Analysis Plugins**: Add custom analysis capabilities
- **Service Plugins**: Add background services
- **Middleware Plugins**: Add request/response processing

## Hooks and Callbacks

### Available Hook Events

```typescript
type HookEvent = 
  | 'before-analysis'         // Before analysis starts
  | 'after-analysis'          // After analysis completes
  | 'before-dashboard-start'  // Before dashboard server starts
  | 'after-dashboard-start'   // After dashboard server starts
  | 'before-script-execution' // Before script execution
  | 'after-script-execution'  // After script execution
  | 'config-changed'          // When configuration changes
  | 'plugin-loaded'           // When plugin is loaded
  | 'error-occurred';         // When error occurs
```

### Hook Types

- **sync**: Synchronous execution, blocks until complete
- **async**: Asynchronous execution, fire-and-forget
- **waterfall**: Sequential execution, each hook gets previous result
- **parallel**: Parallel execution, all hooks get same input

### Registering Hooks

```typescript
import { HookSystem } from '@lumic/wundr/integration';

const hookSystem = new HookSystem(logger);

// Register a hook
hookSystem.registerHook({
  name: 'slack-notification',
  event: 'after-analysis',
  type: 'async',
  description: 'Send results to Slack',
  callback: async (context) => {
    const { data, config } = context;
    await sendToSlack(data.summary);
    return data;
  }
});

// Trigger hooks
await hookSystem.trigger('after-analysis', analysisResults, config);
```

### Hook Configuration

```json
{
  "integration": {
    "hooks": [
      {
        "name": "git-commit",
        "event": "after-analysis",
        "type": "waterfall",
        "command": "git add results.json && git commit -m 'Update analysis'",
        "conditions": [
          {
            "type": "config",
            "path": "git.autoCommit",
            "operator": "equals",
            "value": true
          }
        ]
      }
    ],
    "webhooks": [
      {
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "method": "POST",
        "events": ["after-analysis", "error-occurred"],
        "headers": {
          "Authorization": "Bearer ${SLACK_TOKEN}"
        }
      }
    ]
  }
}
```

### Hook Conditions

```typescript
interface HookCondition {
  type: 'config' | 'environment' | 'data' | 'time';
  operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
  value: any;
  path?: string;  // Dot notation path for nested values
}
```

## CLI Interface

### Available Commands

```bash
# Analysis
wundr analyze                    # Run analysis
wundr analyze --path ./src      # Analyze specific path
wundr analyze --format table    # Table output format

# Scripts
wundr scripts                   # List available scripts
wundr script run-tests         # Execute script
wundr script build --safety safe  # Execute with safety level

# Dashboard
wundr dashboard                 # Start dashboard
wundr dashboard --port 4000    # Custom port
wundr dashboard --dev          # Development mode

# Configuration
wundr config                   # Interactive config manager
wundr status                   # System status
```

### Script Registration

```typescript
import { ScriptExecutor } from '@lumic/wundr/integration';

const executor = new ScriptExecutor();

// Register script
executor.registerScript({
  name: 'run-tests',
  command: 'npm test',
  description: 'Run project tests',
  safetyLevel: 'safe',
  timeout: 30000,
  validation: (command) => command.startsWith('npm')
});

// Execute script
const result = await executor.executeRegisteredScript('run-tests');
```

### CLI Options

Global options available for all commands:

```bash
-c, --config <path>     # Configuration file path
-v, --verbose           # Verbose output
-q, --quiet            # Quiet output
--timeout <ms>         # Execution timeout
```

## Security Model

### Safety Levels

- **safe**: Only whitelisted commands, no shell features
- **moderate**: Limited shell features, command validation
- **unsafe**: Full shell access (use with extreme caution)

### Command Validation

```typescript
// Blocked commands (security risk)
const blockedCommands = [
  'rm', 'del', 'sudo', 'curl', 'wget', 'ssh'
];

// Safe commands (always allowed)
const safeCommands = [
  'npm', 'yarn', 'node', 'git', 'tsc', 'eslint'
];

// Dangerous patterns
const dangerousPatterns = [
  /rm\s+-rf/,     // Recursive delete
  />\s*\/dev\//,  // Device redirection
  /\|\s*sh/,      // Pipe to shell
  /`[^`]*`/       // Command substitution
];
```

### Execution Environment

```typescript
// Sanitized environment
const safeEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  // Only WUNDR_ prefixed variables passed through
  ...wundrEnvVars
};

// Resource limits
const limits = {
  timeout: 30000,      // 30 second timeout
  maxBuffer: 1024 * 1024,  // 1MB output buffer
  maxMemory: 512 * 1024 * 1024,  // 512MB memory
};
```

### Security Violations

```typescript
interface SecurityViolation {
  type: 'command' | 'file' | 'network' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  blocked: boolean;
}
```

## Examples

### Basic Integration

```javascript
// wundr.config.js
const { ConfigurationBuilder } = require('@lumic/wundr/integration');

module.exports = new ConfigurationBuilder()
  .branding({
    appName: 'MyApp Dashboard',
    primaryColor: '#0066CC'
  })
  .analysis({
    defaultPath: './src',
    excludePatterns: ['node_modules', 'dist', 'coverage']
  })
  .integration({
    customScripts: [
      {
        name: 'test',
        command: 'npm test',
        description: 'Run unit tests',
        safetyLevel: 'safe'
      },
      {
        name: 'lint',
        command: 'npm run lint',
        description: 'Run linting',
        safetyLevel: 'safe'
      }
    ]
  })
  .build();
```

### Advanced Plugin

```javascript
// plugins/ci-integration/index.js
class CIIntegrationPlugin {
  async initialize(context) {
    const { api, hooks, logger } = context;
    
    // Add CI status page
    api.addMenuItem({
      id: 'ci-status',
      label: 'CI Status',
      path: '/ci-status',
      icon: 'build'
    });
    
    // Hook into analysis completion
    hooks.afterAnalysis(async (data) => {
      if (process.env.CI) {
        await this.updateCIStatus(data);
      }
    });
    
    logger.info('CI Integration plugin loaded');
  }
  
  async updateCIStatus(analysisData) {
    const ciProvider = process.env.CI_PROVIDER;
    
    switch (ciProvider) {
      case 'github':
        await this.updateGitHubStatus(analysisData);
        break;
      case 'gitlab':
        await this.updateGitLabStatus(analysisData);
        break;
    }
  }
  
  component({ data }) {
    return React.createElement('div', null, [
      React.createElement('h1', null, 'CI Status'),
      React.createElement('div', null, 
        `Build Status: ${data.buildStatus}`
      )
    ]);
  }
}

module.exports = new CIIntegrationPlugin();
```

### Custom Hook Integration

```javascript
// hooks/deployment-hook.js
module.exports = {
  name: 'deployment-webhook',
  event: 'after-analysis',
  type: 'async',
  callback: async (context) => {
    const { data, config } = context;
    
    if (data.quality.score > 0.8) {
      // Trigger deployment
      await fetch(config.deployment.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'deploy',
          quality: data.quality.score,
          timestamp: new Date().toISOString()
        })
      });
    }
    
    return data;
  }
};
```

### Environment Configuration

```bash
# .env.wundr
WUNDR_APP_NAME="Production Dashboard"
WUNDR_PRIMARY_COLOR="#28a745"
WUNDR_ENVIRONMENT=production
WUNDR_PORT=3000

# Integration tokens
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
JIRA_API_TOKEN=xxxxxxxxxx

# Analysis settings
WUNDR_DEFAULT_PATH=./src
WUNDR_EXCLUDE_PATTERNS=node_modules,dist,coverage,.next
WUNDR_MAX_FILE_SIZE=1048576

# Security
WUNDR_SCRIPT_TIMEOUT=30000
WUNDR_DEFAULT_SAFETY_LEVEL=moderate
```

## Troubleshooting

### Common Issues

#### 1. Dashboard Won't Start

```bash
# Check configuration
wundr status

# Validate configuration
wundr config

# Check logs
DEBUG=wundr:* wundr dashboard --dev
```

#### 2. Scripts Not Executing

```bash
# List registered scripts
wundr scripts

# Check script safety level
wundr script <name> --safety safe

# View execution logs
wundr status
```

#### 3. Plugins Not Loading

```bash
# Check plugin directory
ls -la wundr-dashboard/plugins/

# Validate plugin manifest
cat wundr-dashboard/plugins/my-plugin/plugin.json

# Check plugin logs
DEBUG=wundr:plugins wundr dashboard --dev
```

### Debug Mode

Enable debug logging:

```bash
# All debug logs
DEBUG=wundr:* wundr dashboard

# Specific components
DEBUG=wundr:plugins,wundr:hooks wundr dashboard

# Plugin-specific logs
DEBUG=wundr:plugins:my-plugin wundr dashboard
```

### Performance Optimization

```javascript
// wundr.config.js - Performance settings
{
  "analysis": {
    "maxFileSize": 2097152,  // 2MB limit
    "enableRealtime": false, // Disable for large projects
    "excludePatterns": [
      "node_modules",
      "dist",
      "build",
      "*.min.js",
      "*.map"
    ]
  },
  "integration": {
    "customScripts": [
      {
        "name": "quick-test",
        "command": "npm run test:unit",  // Faster subset
        "timeout": 15000  // Shorter timeout
      }
    ]
  }
}
```

### Security Best Practices

1. **Use appropriate safety levels**
   - `safe` for automated scripts
   - `moderate` for interactive use
   - `unsafe` only when absolutely necessary

2. **Validate script inputs**
   ```javascript
   {
     name: 'deploy',
     command: 'npm run deploy',
     validation: (cmd) => cmd.match(/^npm run deploy(:\w+)?$/),
     safetyLevel: 'moderate'
   }
   ```

3. **Limit resource usage**
   ```javascript
   {
     timeout: 60000,      // 1 minute max
     maxBuffer: 1048576,  // 1MB output limit
   }
   ```

4. **Use environment variables for secrets**
   ```javascript
   // Don't hardcode tokens
   headers: {
     'Authorization': 'Bearer ${API_TOKEN}'
   }
   ```

## API Reference

### ConfigurationAPI

```typescript
class ConfigurationAPI {
  constructor(projectRoot?: string);
  loadConfig(): Promise<DashboardConfig>;
  saveConfig(config: Partial<DashboardConfig>): Promise<void>;
  getConfig(): DashboardConfig;
  updateConfig(section: keyof DashboardConfig, value: any): Promise<void>;
  validateConfig(config: unknown): DashboardConfig;
  static createTemplate(): DashboardConfig;
}
```

### PluginSystem

```typescript
class PluginSystem {
  constructor();
  initialize(pluginPaths: string[]): Promise<void>;
  getRegistry(): PluginRegistry;
  getLoader(): PluginLoader;
  shutdown(): Promise<void>;
}
```

### ScriptExecutor

```typescript
class ScriptExecutor {
  constructor(workingDirectory?: string);
  registerScript(script: ScriptDefinition): void;
  executeRegisteredScript(name: string, options?: ScriptExecutionOptions): Promise<ScriptExecutionResult>;
  executeCommand(command: string, options?: ScriptExecutionOptions): Promise<ScriptExecutionResult>;
  getRegisteredScripts(): ScriptDefinition[];
  getExecutionLogs(): ExecutionLog[];
}
```

### HookSystem

```typescript
class HookSystem {
  constructor(logger: Logger);
  registerHook(hookDef: HookDefinition): void;
  loadHooksFromConfig(configPath: string): Promise<void>;
  trigger(event: HookEvent, data?: any, config?: any, metadata?: Record<string, any>): Promise<any>;
  getRegistry(): HookRegistry;
}
```

For more detailed API documentation, see the TypeScript definitions in the source code.