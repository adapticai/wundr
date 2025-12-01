# ADR-003: Plugin-Based Architecture Design

## Status

Accepted

## Context

The unified Wundr platform needs to support extensibility for both code analysis and environment
setup functionality. Users should be able to create custom analysis rules, add new setup tools, and
integrate with third-party services. A plugin architecture will enable this extensibility while
maintaining system stability and security.

## Decision Drivers

- **Extensibility**: Support for custom analysis algorithms and setup procedures
- **Security**: Isolated execution environment for third-party code
- **Performance**: Minimal impact on core system performance
- **Developer Experience**: Easy plugin development and distribution
- **Maintainability**: Clear interfaces and lifecycle management
- **Backward Compatibility**: Support for plugin versioning and migration

## Considered Options

### Plugin Architecture Patterns

1. **Event-Driven Plugin System** (Selected)
2. Dependency Injection Container
3. Microservice-based Plugins
4. WebAssembly (WASM) Plugins

### Plugin Runtime Environment

1. **Node.js Worker Threads** (Selected)
2. Docker Containers
3. V8 Isolates
4. Child Processes

### Plugin Discovery Mechanism

1. **NPM Package Registry** (Selected)
2. Custom Plugin Registry
3. Git-based Plugins
4. Marketplace API

## Decision

### Core Architecture: Event-Driven Plugin System

The platform will implement an event-driven plugin architecture with the following components:

#### 1. Plugin Manager

- **Discovery**: Automatic plugin discovery from npm packages with `@wundr/plugin-` prefix
- **Loading**: Dynamic plugin loading with version management
- **Lifecycle**: Plugin initialization, activation, deactivation, and cleanup
- **Security**: Sandboxed execution environment with limited system access

#### 2. Event System

- **Core Events**: System-defined events for analysis, setup, and lifecycle
- **Custom Events**: Plugin-defined events for inter-plugin communication
- **Event Bus**: Central message routing with type safety
- **Priority System**: Event handler execution order control

#### 3. Plugin Runtime

- **Isolation**: Worker thread-based execution for CPU-intensive operations
- **Resource Limits**: Memory and CPU usage constraints
- **Communication**: Message passing between main thread and plugin workers
- **Error Handling**: Graceful error recovery without system crashes

### Plugin Types

#### Analysis Plugins

```typescript
interface AnalysisPlugin {
  name: string;
  version: string;
  type: 'analysis';
  supportedLanguages: string[];

  analyze(context: AnalysisContext): Promise<AnalysisResult>;
  configure?(config: PluginConfiguration): void;
  initialize?(runtime: PluginRuntime): Promise<void>;
  cleanup?(): Promise<void>;
}
```

#### Setup Plugins

```typescript
interface SetupPlugin {
  name: string;
  version: string;
  type: 'setup';
  supportedPlatforms: Platform[];

  execute(context: SetupContext): Promise<SetupResult>;
  validate?(context: SetupContext): Promise<ValidationResult>;
  rollback?(context: SetupContext): Promise<void>;
}
```

#### Integration Plugins

```typescript
interface IntegrationPlugin {
  name: string;
  version: string;
  type: 'integration';
  service: string;

  connect(credentials: ServiceCredentials): Promise<void>;
  sync(data: IntegrationData): Promise<void>;
  webhook?(event: WebhookEvent): Promise<void>;
}
```

### Event System Design

#### Core Events

```typescript
// Analysis events
'analysis:started' | 'analysis:file:processed' | 'analysis:completed' | 'analysis:failed';

// Setup events
'setup:started' | 'setup:step:completed' | 'setup:completed' | 'setup:failed';

// System events
'plugin:loaded' | 'plugin:error' | 'config:changed' | 'system:shutdown';
```

#### Event Handler Registration

```typescript
class PluginManager {
  registerHandler(event: string, handler: EventHandler, priority: number = 0): void;
  unregisterHandler(event: string, handler: EventHandler): void;
  emit(event: string, data: any): Promise<void>;
  emitParallel(event: string, data: any): Promise<any[]>;
  emitSeries(event: string, data: any): Promise<any[]>;
}
```

## Implementation Details

### Plugin Package Structure

```
@wundr/plugin-eslint/
├── package.json          # Plugin metadata
├── plugin.json          # Plugin configuration
├── src/
│   ├── index.ts         # Main plugin entry
│   ├── analyzer.ts      # Analysis logic
│   └── config.schema.ts # Configuration schema
├── test/
└── README.md
```

### Plugin Configuration Schema

```json
{
  "name": "@wundr/plugin-eslint",
  "version": "1.0.0",
  "wundr": {
    "pluginVersion": "1",
    "type": "analysis",
    "category": "code-quality",
    "supportedLanguages": ["javascript", "typescript"],
    "dependencies": ["eslint"],
    "resources": {
      "maxMemory": "256MB",
      "maxCpu": "1000ms",
      "maxDuration": "30s"
    },
    "permissions": ["filesystem:read", "network:none"],
    "configuration": {
      "schema": "./config.schema.json",
      "defaults": "./config.defaults.json"
    }
  }
}
```

### Security Model

#### Sandboxing

- **Worker Threads**: Plugins run in isolated worker threads
- **Resource Limits**: CPU, memory, and execution time constraints
- **Filesystem Access**: Limited to specified directories
- **Network Access**: Configurable network permissions
- **Process Isolation**: No access to main process or other plugins

#### Permission System

```typescript
enum PluginPermission {
  FILESYSTEM_READ = 'filesystem:read',
  FILESYSTEM_WRITE = 'filesystem:write',
  NETWORK_HTTP = 'network:http',
  NETWORK_HTTPS = 'network:https',
  SYSTEM_EXEC = 'system:exec',
  SYSTEM_ENV = 'system:env',
}
```

### Plugin Lifecycle

#### Loading Sequence

1. **Discovery**: Scan for plugins in node_modules and configured directories
2. **Validation**: Verify plugin structure and metadata
3. **Security Check**: Validate permissions and resource requirements
4. **Loading**: Load plugin code into worker thread
5. **Initialization**: Call plugin initialize() method
6. **Registration**: Register event handlers and expose APIs

#### Runtime Management

```typescript
class PluginRuntime {
  async loadPlugin(pluginPath: string): Promise<LoadedPlugin>;
  async unloadPlugin(pluginId: string): Promise<void>;
  async reloadPlugin(pluginId: string): Promise<void>;

  getPluginStatus(pluginId: string): PluginStatus;
  getPluginMetrics(pluginId: string): PluginMetrics;
  setPluginConfiguration(pluginId: string, config: any): Promise<void>;
}
```

## Plugin Development Kit (PDK)

### Development Tools

```typescript
// @wundr/plugin-sdk package
export class PluginBase {
  constructor(public context: PluginContext) {}

  protected log(level: LogLevel, message: string): void;
  protected emitEvent(event: string, data: any): Promise<void>;
  protected getConfiguration<T>(): T;
  protected reportProgress(progress: number, message?: string): void;
}

// CLI tool for plugin development
npx @wundr/plugin-cli create my-analysis-plugin
npx @wundr/plugin-cli test ./my-plugin
npx @wundr/plugin-cli publish ./my-plugin
```

### Testing Framework

```typescript
// Plugin testing utilities
import { createMockContext, runPluginTest } from '@wundr/plugin-testing';

describe('My Analysis Plugin', () => {
  it('should analyze JavaScript files', async () => {
    const context = createMockContext({
      files: ['test.js'],
      configuration: { strict: true },
    });

    const result = await runPluginTest(MyPlugin, context);
    expect(result.issues).toHaveLength(2);
  });
});
```

## Plugin Registry and Distribution

### NPM-Based Distribution

- **Naming Convention**: `@wundr/plugin-{name}` or `@{scope}/wundr-plugin-{name}`
- **Tagging**: Use npm tags for version management (stable, beta, alpha)
- **Discovery**: Automatic discovery via npm search API
- **Installation**: Standard npm install process

### Marketplace Integration

```typescript
interface PluginMarketplace {
  searchPlugins(query: PluginSearchQuery): Promise<PluginSearchResult[]>;
  getPluginDetails(pluginId: string): Promise<PluginDetails>;
  installPlugin(pluginId: string, version?: string): Promise<void>;
  updatePlugin(pluginId: string): Promise<void>;
  uninstallPlugin(pluginId: string): Promise<void>;
}
```

## Performance Considerations

### Resource Management

- **Memory Pools**: Reuse worker threads to reduce initialization overhead
- **Lazy Loading**: Load plugins only when needed
- **Caching**: Cache plugin compilation and initialization results
- **Throttling**: Limit concurrent plugin executions

### Monitoring

```typescript
interface PluginMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorCount: number;
  successCount: number;
  lastExecution: Date;
}
```

## Migration and Versioning

### Plugin Versioning

- **Semantic Versioning**: Follow semver for plugin versions
- **API Compatibility**: Maintain backward compatibility within major versions
- **Migration Hooks**: Support for plugin data migration between versions

### Core API Versioning

```typescript
interface PluginAPI {
  version: string; // "1.0", "1.1", "2.0"
  features: string[]; // Available features for this version
  deprecated: string[]; // Deprecated features
}
```

## Example Plugin Implementation

### ESLint Analysis Plugin

```typescript
// @wundr/plugin-eslint
import { AnalysisPlugin, PluginBase } from '@wundr/plugin-sdk';

export class ESLintPlugin extends PluginBase implements AnalysisPlugin {
  name = '@wundr/plugin-eslint';
  version = '1.0.0';
  type = 'analysis' as const;
  supportedLanguages = ['javascript', 'typescript'];

  async analyze(context: AnalysisContext): Promise<AnalysisResult> {
    this.log('info', 'Starting ESLint analysis');

    const results: AnalysisResult = {
      summary: { totalFiles: 0, totalIssues: 0 },
      issues: [],
      metrics: [],
    };

    for (const file of context.files) {
      if (!this.isSupported(file.path)) continue;

      this.reportProgress((file.index / context.files.length) * 100);

      const fileResult = await this.analyzeFile(file);
      results.issues.push(...fileResult.issues);
    }

    return results;
  }

  private async analyzeFile(file: SourceFile): Promise<FileAnalysisResult> {
    // ESLint analysis implementation
    const eslint = new ESLint(this.getConfiguration());
    const results = await eslint.lintText(file.content, { filePath: file.path });

    return {
      issues: results[0].messages.map(this.mapESLintIssue),
    };
  }
}
```

## Benefits and Trade-offs

### Benefits

- **Extensibility**: Easy to add new analysis algorithms and setup procedures
- **Community**: Enables community contributions and ecosystem growth
- **Isolation**: Plugin failures don't crash the main system
- **Flexibility**: Different plugin types for different use cases
- **Performance**: Worker thread isolation prevents blocking

### Trade-offs

- **Complexity**: Adds architectural complexity to the system
- **Overhead**: Worker thread communication has performance overhead
- **Security**: Requires careful permission and resource management
- **Debugging**: More complex debugging across plugin boundaries

This plugin architecture provides a robust foundation for extensibility while maintaining system
stability and security.
