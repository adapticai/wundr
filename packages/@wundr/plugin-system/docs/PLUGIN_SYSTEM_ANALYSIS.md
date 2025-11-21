# @wundr.io/plugin-system - Comprehensive Analysis

## Executive Summary

The @wundr.io/plugin-system package provides a robust, extensible plugin architecture for the Wundr
platform. It implements a complete plugin lifecycle management system with hooks, event-driven
communication, and automatic dependency resolution.

**Key Features:**

- Full plugin lifecycle management (load, activate, deactivate, unload)
- Event-driven hook system for extensibility
- Manifest-based plugin discovery
- Context-aware plugin execution
- Semver-compliant version management
- Integration with @wundr.io/core for logging and event bus

---

## 1. Plugin System Architecture

### 1.1 Core Components

```
@wundr.io/plugin-system
├── Plugin Manager (WundrPluginManager)
│   ├── Plugin Discovery & Loading
│   ├── Lifecycle Management
│   ├── Context Creation
│   └── Dependency Management
│
├── Hook Registry (WundrHookRegistry)
│   ├── Hook Registration
│   ├── Hook Execution (async/sync)
│   ├── Event Broadcasting
│   └── Performance Tracking
│
└── Type System
    ├── Plugin Interfaces
    ├── Lifecycle States
    ├── Event Definitions
    └── Configuration Schemas
```

### 1.2 Design Patterns

**1. Dependency Injection**

- Plugins receive a `PluginContext` with logger, event bus, and config
- Loose coupling between plugins and core infrastructure

**2. Observer Pattern**

- Event-driven communication via EventBus
- Hook system allows plugins to react to lifecycle events

**3. State Machine**

- Plugin status transitions: UNLOADED → LOADING → LOADED → ACTIVATING → ACTIVE
- Error state for failed operations

**4. Registry Pattern**

- Centralized hook registry for managing all plugin hooks
- Plugin manager maintains plugin instances

---

## 2. Plugin Manager API

### 2.1 Core Interface

```typescript
interface PluginManager {
  // Lifecycle Operations
  loadPlugin(pluginId: string): Promise<PluginInfo>;
  unloadPlugin(pluginId: string): Promise<void>;
  activatePlugin(pluginId: string): Promise<void>;
  deactivatePlugin(pluginId: string): Promise<void>;
  reloadPlugin(pluginId: string): Promise<PluginInfo>;

  // Query Operations
  getPlugin(pluginId: string): PluginInfo | undefined;
  getAllPlugins(): PluginInfo[];
  getActivePlugins(): PluginInfo[];
  hasPlugin(pluginId: string): boolean;

  // Discovery
  discoverPlugins(): Promise<string[]>;
  validatePlugin(pluginId: string): Promise<boolean>;

  // Batch Operations
  loadAll(): Promise<PluginInfo[]>;
  activateAll(): Promise<void>;
  deactivateAll(): Promise<void>;

  // Manager Lifecycle
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}
```

### 2.2 Plugin Lifecycle

#### **Phase 1: Discovery**

```typescript
// Scans plugin directory for plugin.json manifests
const plugins = await manager.discoverPlugins();
// Returns: ['plugin-a', 'plugin-b', 'plugin-c']
```

#### **Phase 2: Loading**

```typescript
// 1. Load manifest (plugin.json)
// 2. Validate manifest structure
// 3. Import plugin module
// 4. Create plugin instance
// 5. Initialize plugin with context
const pluginInfo = await manager.loadPlugin('plugin-a');
```

**Loading Process Details:**

1. **Semaphore Protection**: Prevents concurrent loading of the same plugin
2. **Manifest Validation**: Ensures required fields (name, version, description, main)
3. **Version Validation**: Uses semver to validate version format
4. **Module Loading**: Dynamic import using `pathToFileURL`
5. **Context Creation**: Provides isolated context with config, logger, eventBus
6. **Performance Tracking**: Records load time

#### **Phase 3: Activation**

```typescript
// Calls plugin.activate() method
await manager.activatePlugin('plugin-a');
// Plugin can now register hooks, start services, etc.
```

#### **Phase 4: Deactivation**

```typescript
// Calls plugin.deactivate() method
await manager.deactivatePlugin('plugin-a');
// Plugin should cleanup resources
```

#### **Phase 5: Unloading**

```typescript
// 1. Deactivate if active
// 2. Call plugin.destroy() if available
// 3. Remove from registry
await manager.unloadPlugin('plugin-a');
```

### 2.3 Configuration Options

```typescript
interface PluginManagerOptions {
  pluginDir: string; // Directory containing plugins
  dataDir: string; // Data storage directory
  autoLoad?: boolean; // Auto-load plugins on init (default: true)
  autoActivate?: boolean; // Auto-activate on load (default: true)
  maxConcurrentLoads?: number; // Load concurrency limit (default: 5)
  loadTimeout?: number; // Load timeout in ms (default: 30000)
  logger?: Logger; // Custom logger instance
  eventBus?: EventBus; // Custom event bus instance
}
```

---

## 3. Hook System and Lifecycle Events

### 3.1 Hook Registry Interface

```typescript
interface PluginHookRegistry {
  // Registration
  register<T>(name: string, hook: PluginHook<T>): void;
  unregister(name: string, hook: PluginHook): void;

  // Execution
  execute<T>(name: string, ...args: unknown[]): Promise<T[]>;
  executeSync<T>(name: string, ...args: unknown[]): T[];

  // Query
  has(name: string): boolean;
  getHooks(name: string): PluginHook[];

  // Management
  clear(name?: string): void;
  getHookNames(): string[];
  getStats(): HookStats;
}
```

### 3.2 Hook Implementation

```typescript
interface PluginHook<T = unknown> {
  readonly name: string;
  readonly description?: string;
  execute(...args: unknown[]): T | Promise<T>;
}

// Example hook
const myHook: PluginHook<string> = {
  name: 'my-custom-hook',
  description: 'Processes data before save',
  execute: async (data: any) => {
    // Hook logic
    return processedData;
  },
};

// Register hook
hookRegistry.register('pre-save', myHook);

// Execute all 'pre-save' hooks
const results = await hookRegistry.execute('pre-save', myData);
```

### 3.3 Built-in Lifecycle Events

```typescript
const PLUGIN_EVENTS = {
  // Loading Events
  PLUGIN_LOADING: 'plugin:loading',
  PLUGIN_LOADED: 'plugin:loaded',
  PLUGIN_LOAD_ERROR: 'plugin:load:error',

  // Activation Events
  PLUGIN_ACTIVATING: 'plugin:activating',
  PLUGIN_ACTIVATED: 'plugin:activated',
  PLUGIN_ACTIVATION_ERROR: 'plugin:activation:error',

  // Deactivation Events
  PLUGIN_DEACTIVATING: 'plugin:deactivating',
  PLUGIN_DEACTIVATED: 'plugin:deactivated',
  PLUGIN_DEACTIVATION_ERROR: 'plugin:deactivation:error',

  // Unload Events
  PLUGIN_UNLOADING: 'plugin:unloading',
  PLUGIN_UNLOADED: 'plugin:unloaded',

  // Hook Events
  HOOK_REGISTERED: 'plugin:hook:registered',
  HOOK_UNREGISTERED: 'plugin:hook:unregistered',
  HOOK_EXECUTED: 'plugin:hook:executed',

  // Error Events
  PLUGIN_ERROR: 'plugin:error',
} as const;
```

### 3.4 Event Subscription Example

```typescript
// Subscribe to plugin loaded events
eventBus.on(PLUGIN_EVENTS.PLUGIN_LOADED, event => {
  console.log(`Plugin ${event.pluginId} loaded in ${event.loadTime}ms`);
});

// Subscribe to hook execution
eventBus.on(PLUGIN_EVENTS.HOOK_EXECUTED, event => {
  console.log(`Hook ${event.name} executed with ${event.resultCount} results`);
});
```

---

## 4. Plugin Types and Interfaces

### 4.1 Plugin Interface

```typescript
interface Plugin {
  readonly metadata: PluginMetadata;

  // Required lifecycle methods
  initialize(context: PluginContext): Promise<void> | void;
  activate(): Promise<void> | void;
  deactivate(): Promise<void> | void;

  // Optional cleanup
  destroy?(): Promise<void> | void;
}
```

### 4.2 Plugin Metadata

```typescript
interface PluginMetadata {
  readonly name: string; // Plugin identifier
  readonly version: string; // Semver version
  readonly description: string; // Brief description
  readonly author?: string; // Author information
  readonly license?: string; // License (e.g., 'MIT')
  readonly keywords?: string[]; // Search keywords
  readonly repository?: string; // Repository URL
  readonly homepage?: string; // Homepage URL
  readonly dependencies?: string[]; // Plugin dependencies
  readonly peerDependencies?: string[]; // Peer dependencies
}
```

### 4.3 Plugin Context

```typescript
interface PluginContext {
  readonly logger: Logger; // Logger instance
  readonly eventBus: EventBus; // Event bus for communication
  readonly config: Record<string, unknown>; // Plugin configuration
  readonly pluginDir: string; // Plugin directory path
  readonly dataDir: string; // Data directory for plugin
}
```

### 4.4 Plugin Status Enum

```typescript
enum PluginStatus {
  UNLOADED = 'unloaded', // Not loaded
  LOADING = 'loading', // Currently loading
  LOADED = 'loaded', // Loaded, not active
  ACTIVATING = 'activating', // Currently activating
  ACTIVE = 'active', // Active and running
  DEACTIVATING = 'deactivating', // Currently deactivating
  ERROR = 'error', // Error state
}
```

### 4.5 Plugin Info

```typescript
interface PluginInfo {
  readonly id: string; // Plugin ID
  readonly metadata: PluginMetadata; // Plugin metadata
  readonly status: PluginStatus; // Current status
  readonly instance?: Plugin; // Plugin instance (if loaded)
  readonly context?: PluginContext; // Plugin context (if loaded)
  readonly error?: Error; // Error (if status is ERROR)
  readonly loadTime?: number; // Load time in ms
  readonly activationTime?: number; // Activation time in ms
}
```

---

## 5. Plugin Discovery and Registration

### 5.1 Plugin Manifest Format

**File:** `plugin.json` (required in plugin root directory)

```json
{
  "name": "my-awesome-plugin",
  "version": "1.2.3",
  "description": "An awesome plugin for Wundr",
  "author": "Plugin Developer",
  "license": "MIT",
  "main": "dist/index.js",
  "enabled": true,
  "config": {
    "apiKey": "default-key",
    "timeout": 5000
  },
  "keywords": ["wundr", "integration", "api"],
  "repository": "https://github.com/user/plugin",
  "homepage": "https://plugin-docs.com",
  "dependencies": [],
  "peerDependencies": ["@wundr.io/core"]
}
```

**Required Fields:**

- `name`: Plugin identifier
- `version`: Semver-compliant version
- `description`: Plugin description
- `main`: Entry point file (relative to plugin directory)

**Optional Fields:**

- `enabled`: Whether plugin should auto-activate
- `config`: Default configuration
- `author`, `license`, `keywords`, `repository`, `homepage`
- `dependencies`: Other plugin dependencies
- `peerDependencies`: Required platform packages

### 5.2 Plugin Module Structure

```typescript
// dist/index.js (or .ts before compilation)
import { Plugin, PluginContext } from '@wundr.io/plugin-system';

export default class MyPlugin implements Plugin {
  readonly metadata = {
    name: 'my-awesome-plugin',
    version: '1.2.3',
    description: 'An awesome plugin',
  };

  async initialize(context: PluginContext): Promise<void> {
    context.logger.info('Initializing plugin');
    // Setup logic
  }

  async activate(): Promise<void> {
    // Register hooks, start services
  }

  async deactivate(): Promise<void> {
    // Cleanup, stop services
  }

  async destroy(): Promise<void> {
    // Final cleanup
  }
}

// Optional: Export metadata at module level
export const metadata = {
  // Additional metadata
};
```

### 5.3 Plugin Directory Structure

```
my-plugin/
├── plugin.json          # Plugin manifest
├── package.json         # Node.js package info
├── dist/
│   └── index.js         # Compiled entry point
├── src/
│   └── index.ts         # Source code
├── tests/
│   └── index.test.ts    # Tests
└── README.md            # Documentation
```

### 5.4 Discovery Process

```typescript
// 1. Scan plugin directory
const pluginIds = await manager.discoverPlugins();
// Scans: pluginDir/* for directories with plugin.json

// 2. Validate each plugin
for (const pluginId of pluginIds) {
  const isValid = await manager.validatePlugin(pluginId);
  if (isValid) {
    // Plugin is valid
  }
}

// 3. Load all valid plugins
const loadedPlugins = await manager.loadAll();
```

---

## 6. Usage Examples for Creating Plugins

### 6.1 Basic Plugin Example

```typescript
// src/index.ts
import { Plugin, PluginContext } from '@wundr.io/plugin-system';

export default class HelloWorldPlugin implements Plugin {
  readonly metadata = {
    name: 'hello-world',
    version: '1.0.0',
    description: 'Simple hello world plugin',
  };

  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Hello World plugin initialized');
  }

  async activate(): Promise<void> {
    this.context?.logger.info('Hello World plugin activated!');
  }

  async deactivate(): Promise<void> {
    this.context?.logger.info('Hello World plugin deactivated');
  }
}
```

### 6.2 Plugin with Hooks

```typescript
import { Plugin, PluginContext, PluginHook } from '@wundr.io/plugin-system';

export default class ValidationPlugin implements Plugin {
  readonly metadata = {
    name: 'validation-plugin',
    version: '1.0.0',
    description: 'Provides validation hooks',
  };

  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
  }

  async activate(): Promise<void> {
    // Register validation hook
    const validationHook: PluginHook<boolean> = {
      name: 'validation-hook',
      description: 'Validates data before processing',
      execute: async (data: any) => {
        return this.validateData(data);
      },
    };

    // Get hook registry from plugin manager
    const hookRegistry = this.getHookRegistry();
    hookRegistry.register('pre-process', validationHook);

    this.context?.logger.info('Validation hook registered');
  }

  async deactivate(): Promise<void> {
    // Hooks are automatically cleaned up
  }

  private validateData(data: any): boolean {
    // Validation logic
    return data !== null && data !== undefined;
  }

  private getHookRegistry() {
    // Access registry through context or manager
    // Implementation depends on how it's exposed
    return (this.context as any).hookRegistry;
  }
}
```

### 6.3 Plugin with Event Handling

```typescript
import { Plugin, PluginContext, PLUGIN_EVENTS } from '@wundr.io/plugin-system';

export default class EventListenerPlugin implements Plugin {
  readonly metadata = {
    name: 'event-listener',
    version: '1.0.0',
    description: 'Listens to system events',
  };

  private context?: PluginContext;
  private eventHandlers = new Map<string, Function>();

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
  }

  async activate(): Promise<void> {
    // Subscribe to plugin events
    const handler = (event: any) => {
      this.context?.logger.info('Plugin loaded:', event.pluginId);
    };

    this.eventHandlers.set('loaded', handler);
    this.context?.eventBus.on(PLUGIN_EVENTS.PLUGIN_LOADED, handler);
  }

  async deactivate(): Promise<void> {
    // Unsubscribe from all events
    this.eventHandlers.forEach((handler, key) => {
      this.context?.eventBus.off(PLUGIN_EVENTS.PLUGIN_LOADED, handler);
    });
    this.eventHandlers.clear();
  }
}
```

### 6.4 Plugin with Configuration

```typescript
import { Plugin, PluginContext } from '@wundr.io/plugin-system';

interface MyPluginConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}

export default class ConfigurablePlugin implements Plugin {
  readonly metadata = {
    name: 'configurable-plugin',
    version: '1.0.0',
    description: 'Plugin with configuration',
  };

  private config?: MyPluginConfig;
  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;

    // Load configuration with defaults
    this.config = {
      apiUrl: (context.config.apiUrl as string) || 'https://api.example.com',
      timeout: (context.config.timeout as number) || 5000,
      retries: (context.config.retries as number) || 3,
    };

    context.logger.info('Plugin configured:', this.config);
  }

  async activate(): Promise<void> {
    // Use configuration
    this.context?.logger.info(`Connecting to ${this.config?.apiUrl}`);
  }

  async deactivate(): Promise<void> {
    this.context?.logger.info('Disconnected');
  }
}
```

### 6.5 Plugin with Data Persistence

```typescript
import { Plugin, PluginContext } from '@wundr.io/plugin-system';
import fs from 'fs/promises';
import path from 'path';

export default class DataPlugin implements Plugin {
  readonly metadata = {
    name: 'data-plugin',
    version: '1.0.0',
    description: 'Plugin with data persistence',
  };

  private context?: PluginContext;
  private dataFile?: string;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.dataFile = path.join(context.dataDir, 'plugin-data.json');

    // Ensure data directory exists
    await fs.mkdir(context.dataDir, { recursive: true });
  }

  async activate(): Promise<void> {
    // Load existing data
    const data = await this.loadData();
    this.context?.logger.info('Loaded data:', data);
  }

  async deactivate(): Promise<void> {
    // Save data
    await this.saveData({ timestamp: Date.now() });
  }

  private async loadData(): Promise<any> {
    try {
      const content = await fs.readFile(this.dataFile!, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return {}; // Return empty if file doesn't exist
    }
  }

  private async saveData(data: any): Promise<void> {
    await fs.writeFile(this.dataFile!, JSON.stringify(data, null, 2));
  }
}
```

---

## 7. Extension Points for Customization

### 7.1 Custom Hook Points

Plugins can define custom hook points for other plugins to extend:

```typescript
// In your plugin
export const CUSTOM_HOOKS = {
  BEFORE_PROCESS: 'custom:before-process',
  AFTER_PROCESS: 'custom:after-process',
  VALIDATE: 'custom:validate',
  TRANSFORM: 'custom:transform',
} as const;

// Register and execute custom hooks
export default class ExtensiblePlugin implements Plugin {
  // ... metadata and lifecycle methods ...

  async processData(data: any): Promise<any> {
    const hookRegistry = this.getHookRegistry();

    // Execute before-process hooks
    await hookRegistry.execute(CUSTOM_HOOKS.BEFORE_PROCESS, data);

    // Process data
    let result = this.transform(data);

    // Execute transform hooks (allow modification)
    const transformResults = await hookRegistry.execute(CUSTOM_HOOKS.TRANSFORM, result);

    // Use last transform result
    if (transformResults.length > 0) {
      result = transformResults[transformResults.length - 1];
    }

    // Execute after-process hooks
    await hookRegistry.execute(CUSTOM_HOOKS.AFTER_PROCESS, result);

    return result;
  }
}
```

### 7.2 Custom Plugin Context

Extend plugin context for additional functionality:

```typescript
interface ExtendedPluginContext extends PluginContext {
  database: Database;
  cache: Cache;
  api: ApiClient;
}

// In plugin manager initialization
const extendedContext: ExtendedPluginContext = {
  ...baseContext,
  database: databaseInstance,
  cache: cacheInstance,
  api: apiClient,
};
```

### 7.3 Plugin Communication

Plugins can communicate via the shared event bus:

```typescript
// Plugin A - Emits events
export default class PluginA implements Plugin {
  async activate(): Promise<void> {
    // Emit custom event
    this.context?.eventBus.emit('plugin-a:data-ready', {
      data: 'some data',
      timestamp: Date.now(),
    });
  }
}

// Plugin B - Listens to events
export default class PluginB implements Plugin {
  async activate(): Promise<void> {
    // Subscribe to Plugin A's events
    this.context?.eventBus.on('plugin-a:data-ready', event => {
      this.context?.logger.info('Received data from Plugin A:', event.data);
    });
  }
}
```

### 7.4 Middleware Pattern

Implement middleware for request/response processing:

```typescript
interface Middleware {
  name: string;
  priority: number;
  execute(context: any, next: () => Promise<any>): Promise<any>;
}

export default class MiddlewarePlugin implements Plugin {
  private middlewares: Middleware[] = [];

  async activate(): Promise<void> {
    // Register middleware hook
    const middlewareHook: PluginHook = {
      name: 'middleware-processor',
      execute: async (context: any) => {
        return this.executeMiddlewareChain(context);
      },
    };

    this.getHookRegistry().register('process-request', middlewareHook);
  }

  registerMiddleware(middleware: Middleware): void {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => b.priority - a.priority);
  }

  private async executeMiddlewareChain(context: any): Promise<any> {
    let index = 0;

    const next = async (): Promise<any> => {
      if (index >= this.middlewares.length) {
        return context;
      }

      const middleware = this.middlewares[index++];
      return middleware.execute(context, next);
    };

    return next();
  }
}
```

---

## 8. Best Practices for Plugin Development

### 8.1 Plugin Design Principles

**1. Single Responsibility**

```typescript
// Good: Focused plugin
class EmailNotificationPlugin implements Plugin {
  // Only handles email notifications
}

// Bad: Too many responsibilities
class AllNotificationsPlugin implements Plugin {
  // Handles email, SMS, push, webhooks, etc.
}
```

**2. Fail Gracefully**

```typescript
async activate(): Promise<void> {
  try {
    await this.connectToService();
  } catch (error) {
    this.context?.logger.error('Failed to connect, using fallback:', error);
    this.useFallbackMode();
  }
}
```

**3. Clean Up Resources**

```typescript
async deactivate(): Promise<void> {
  // Close connections
  await this.connection?.close();

  // Clear timers
  clearInterval(this.intervalId);

  // Unsubscribe from events
  this.context?.eventBus.off('event-name', this.handler);

  // Clear caches
  this.cache.clear();
}
```

**4. Use Semantic Versioning**

```json
{
  "version": "1.2.3"
  // 1 = major (breaking changes)
  // 2 = minor (new features, backward compatible)
  // 3 = patch (bug fixes)
}
```

### 8.2 Performance Best Practices

**1. Lazy Initialization**

```typescript
export default class PerformantPlugin implements Plugin {
  private heavyService?: HeavyService;

  async initialize(context: PluginContext): Promise<void> {
    // Don't load heavy dependencies here
    this.context = context;
  }

  private async getHeavyService(): Promise<HeavyService> {
    if (!this.heavyService) {
      this.heavyService = await this.loadHeavyService();
    }
    return this.heavyService;
  }
}
```

**2. Debounce/Throttle Events**

```typescript
async activate(): Promise<void> {
  const debouncedHandler = this.debounce(
    (event) => this.handleEvent(event),
    300
  );

  this.context?.eventBus.on('frequent-event', debouncedHandler);
}

private debounce(fn: Function, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

**3. Use Connection Pooling**

```typescript
// Good: Reuse connections
private connectionPool = new ConnectionPool({ max: 10 });

// Bad: Create new connection each time
private async query() {
  const conn = await createConnection(); // Expensive!
}
```

### 8.3 Security Best Practices

**1. Validate All Inputs**

```typescript
async execute(data: unknown): Promise<void> {
  // Validate schema
  if (!this.isValidData(data)) {
    throw new Error('Invalid data format');
  }

  // Sanitize inputs
  const sanitized = this.sanitizeData(data);

  // Process safely
  await this.process(sanitized);
}
```

**2. Don't Expose Sensitive Data**

```typescript
// Bad: Logging sensitive data
this.context?.logger.info('API Key:', this.apiKey);

// Good: Redact sensitive data
this.context?.logger.info('API Key:', '***redacted***');
```

**3. Use Environment Variables**

```typescript
// Good: Load from environment
const apiKey = process.env.PLUGIN_API_KEY || this.context?.config.apiKey;

// Bad: Hardcoded secrets
const apiKey = 'sk-1234567890abcdef';
```

### 8.4 Testing Best Practices

```typescript
// tests/index.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import MyPlugin from '../src/index';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
      eventBus: {
        on: jest.fn(),
        emit: jest.fn(),
      },
      config: {},
      pluginDir: '/tmp/plugin',
      dataDir: '/tmp/data',
    };

    plugin = new MyPlugin();
  });

  it('should initialize successfully', async () => {
    await plugin.initialize(mockContext);
    expect(mockContext.logger.info).toHaveBeenCalled();
  });

  it('should activate and register hooks', async () => {
    await plugin.initialize(mockContext);
    await plugin.activate();
    expect(mockContext.eventBus.on).toHaveBeenCalled();
  });

  it('should deactivate cleanly', async () => {
    await plugin.initialize(mockContext);
    await plugin.activate();
    await expect(plugin.deactivate()).resolves.not.toThrow();
  });
});
```

### 8.5 Documentation Best Practices

Create comprehensive README.md:

```markdown
# My Awesome Plugin

Brief description of what the plugin does.

## Installation

\`\`\`bash npm install @wundr/my-plugin \`\`\`

## Configuration

\`\`\`json { "apiUrl": "https://api.example.com", "timeout": 5000 } \`\`\`

## Usage

\`\`\`typescript // Example usage code \`\`\`

## Hooks

- `pre-process`: Executes before data processing
- `post-process`: Executes after data processing

## Events

- `data-ready`: Emitted when data is ready
- `error`: Emitted on errors

## API

### Methods

#### `processData(data: any): Promise<any>`

Processes input data and returns result.

## License

MIT
```

---

## 9. Advanced Features

### 9.1 Plugin Dependencies

Handle plugin dependencies:

```typescript
// plugin.json
{
  "name": "dependent-plugin",
  "dependencies": ["base-plugin", "utils-plugin"]
}

// In plugin manager, implement dependency resolution
async loadPluginWithDependencies(pluginId: string): Promise<void> {
  const manifest = await this.loadManifest(pluginId);

  // Load dependencies first
  if (manifest.dependencies) {
    for (const dep of manifest.dependencies) {
      if (!this.hasPlugin(dep)) {
        await this.loadPlugin(dep);
      }
    }
  }

  // Then load the plugin
  await this.loadPlugin(pluginId);
}
```

### 9.2 Hot Reload Support

```typescript
import chokidar from 'chokidar';

async enableHotReload(pluginId: string): Promise<void> {
  const pluginPath = path.join(this.options.pluginDir, pluginId);

  const watcher = chokidar.watch(pluginPath, {
    ignored: /node_modules/,
    persistent: true,
  });

  watcher.on('change', async (filePath) => {
    this.logger.info(`Plugin ${pluginId} changed, reloading...`);
    await this.reloadPlugin(pluginId);
  });
}
```

### 9.3 Plugin Sandboxing

```typescript
// Use vm2 for sandboxed execution
import { VM } from 'vm2';

async loadPluginSandboxed(pluginId: string): Promise<void> {
  const vm = new VM({
    timeout: 10000,
    sandbox: {
      console: this.logger,
      require: this.createSafeRequire(),
    }
  });

  const pluginCode = await fs.readFile(pluginPath, 'utf-8');
  const Plugin = vm.run(pluginCode);

  return new Plugin();
}
```

---

## 10. Real-World Integration Example (CLI)

Based on the @wundr/cli implementation, here's how plugins are integrated:

### 10.1 CLI Plugin Manager Setup

```typescript
// src/index.ts
import { WundrPluginManager } from '@wundr.io/plugin-system';
import { ConfigManager } from './utils/config-manager';

class WundrCLI {
  private pluginManager: WundrPluginManager;

  async initialize(): Promise<void> {
    const config = new ConfigManager();

    this.pluginManager = new WundrPluginManager({
      pluginDir: path.join(process.cwd(), '.wundr', 'plugins'),
      dataDir: path.join(process.cwd(), '.wundr', 'data'),
      autoLoad: true,
      autoActivate: true,
    });

    await this.pluginManager.initialize();

    // Register plugin commands
    this.registerPluginCommands();
  }

  private registerPluginCommands(): void {
    const activePlugins = this.pluginManager.getActivePlugins();

    for (const pluginInfo of activePlugins) {
      // Register commands from plugins
      // Implementation specific to CLI framework
    }
  }
}
```

### 10.2 Plugin Command Integration

```typescript
// Plugin that adds CLI commands
export default class GitPlugin implements Plugin {
  readonly metadata = {
    name: 'git-integration',
    version: '1.0.0',
    description: 'Git integration commands',
  };

  async activate(): Promise<void> {
    // Register git commands with CLI
    this.registerCommand({
      name: 'git-status',
      description: 'Show git status',
      action: async () => {
        // Implementation
      },
    });
  }
}
```

---

## 11. Troubleshooting Guide

### 11.1 Common Issues

**Issue: Plugin not loading**

```typescript
// Check plugin manifest
const isValid = await manager.validatePlugin('my-plugin');
if (!isValid) {
  // Check plugin.json format
  // Verify required fields
  // Check version format
}
```

**Issue: Plugin activation fails**

```typescript
try {
  await manager.activatePlugin('my-plugin');
} catch (error) {
  // Check plugin logs
  // Verify dependencies are loaded
  // Check for missing configuration
}
```

**Issue: Hooks not executing**

```typescript
// Verify hook registration
const hasHook = hookRegistry.has('my-hook-name');
console.log('Hook registered:', hasHook);

// Check hook execution
const results = await hookRegistry.execute('my-hook-name', data);
console.log('Hook results:', results);
```

### 11.2 Debugging Tips

```typescript
// Enable debug logging
const manager = new WundrPluginManager({
  logger: createLogger({ level: 'debug' }),
  // ... other options
});

// Monitor plugin events
eventBus.on('*', event => {
  console.log('Event:', event);
});

// Get plugin statistics
const stats = hookRegistry.getStats();
console.log('Hook stats:', stats);
```

---

## 12. Migration and Compatibility

### 12.1 Version Compatibility

```typescript
// Check platform version compatibility
interface PluginManifest {
  engines: {
    wundr: '^1.0.0';
    node: '>=18.0.0';
  };
}
```

### 12.2 Breaking Changes Handling

```typescript
// Implement version-based behavior
export default class CompatiblePlugin implements Plugin {
  async initialize(context: PluginContext): Promise<void> {
    const platformVersion = (context.config as any).platformVersion;

    if (semver.satisfies(platformVersion, '>=2.0.0')) {
      // Use new API
      this.useNewApi();
    } else {
      // Use legacy API
      this.useLegacyApi();
    }
  }
}
```

---

## 13. Conclusion

The @wundr.io/plugin-system provides a robust, production-ready plugin architecture with:

- **Complete lifecycle management** with state tracking
- **Event-driven architecture** for loose coupling
- **Hook system** for extensibility
- **Type safety** with comprehensive TypeScript interfaces
- **Performance optimization** with concurrent loading and caching
- **Error handling** with detailed error contexts
- **Integration support** with core infrastructure (logger, event bus)

### Key Strengths:

1. Well-designed separation of concerns
2. Comprehensive error handling and recovery
3. Performance-conscious implementation (semaphores, concurrency control)
4. Flexible hook system for cross-plugin communication
5. Clean TypeScript interfaces

### Recommended Improvements:

1. Add plugin dependency resolution
2. Implement plugin versioning and update mechanisms
3. Add plugin sandboxing for security
4. Create plugin template generator
5. Add plugin marketplace/registry support

This plugin system serves as a solid foundation for building extensible applications and can be used
as-is or extended for specific use cases.
