# @wundr.io/plugin-system

[![npm version](https://img.shields.io/npm/v/@wundr.io/plugin-system.svg)](https://www.npmjs.com/package/@wundr.io/plugin-system)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)

> **Extensible plugin architecture with lifecycle management, hook system, and dynamic loading**

From monolithic rigidity to modular flexibility, systematically. `@wundr.io/plugin-system` provides
a production-ready plugin architecture that enables runtime extensibility, isolated feature
development, and seamless third-party integrations.

---

## Overview

`@wundr.io/plugin-system` is a comprehensive plugin framework designed for applications that need:

- **Dynamic Plugin Loading** - Load plugins at runtime without application restart
- **Lifecycle Management** - Fine-grained control over plugin initialization, activation, and
  cleanup
- **Hook System** - Event-driven extension points for maximum flexibility
- **Isolation** - Plugins run in isolated contexts with dedicated resources
- **Validation** - Semver validation, manifest checking, and dependency management

### Key Features

- 🔌 **Dynamic Loading** - Load and unload plugins at runtime
- 🔄 **Complete Lifecycle** - Initialize → Load → Activate → Deactivate → Unload → Destroy
- 🪝 **Hook Registry** - Extensible hook system for plugin communication
- 📦 **Auto-Discovery** - Automatically discover plugins in directories
- ⚡ **Concurrent Loading** - Load multiple plugins in parallel with semaphore control
- 🛡️ **Type-Safe** - Full TypeScript support with strong typing
- 📊 **Performance Tracking** - Load time and activation time metrics
- 🎯 **Event-Driven** - Comprehensive event system for monitoring

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Plugin Lifecycle](#plugin-lifecycle)
  - [Hook System](#hook-system)
  - [Plugin Context](#plugin-context)
- [Creating Plugins](#creating-plugins)
  - [Basic Plugin](#basic-plugin)
  - [Plugin with Hooks](#plugin-with-hooks)
  - [Plugin Manifest](#plugin-manifest)
- [Usage Examples](#usage-examples)
  - [Plugin Manager Setup](#plugin-manager-setup)
  - [Loading Plugins](#loading-plugins)
  - [Using Hooks](#using-hooks)
  - [Plugin Discovery](#plugin-discovery)
- [API Reference](#api-reference)
  - [PluginManager](#pluginmanager)
  - [Hook Registry](#hook-registry)
  - [Events](#events)
- [Integration Guide](#integration-guide)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
npm install @wundr.io/plugin-system
```

### Peer Dependencies

```bash
npm install @wundr.io/core
```

---

## Quick Start

### 1. Create a Plugin

Create a plugin directory structure:

```
my-plugin/
├── plugin.json      # Plugin manifest
└── index.ts         # Plugin implementation
```

**plugin.json**:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "main": "index.js",
  "author": "Your Name",
  "license": "MIT"
}
```

**index.ts**:

```typescript
import type { Plugin, PluginContext } from '@wundr.io/plugin-system';

export default class MyPlugin implements Plugin {
  readonly metadata = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My awesome plugin',
  };

  async initialize(context: PluginContext): Promise<void> {
    context.logger.info('Plugin initializing...');
  }

  async activate(): Promise<void> {
    console.log('Plugin activated!');
  }

  async deactivate(): Promise<void> {
    console.log('Plugin deactivated!');
  }
}
```

### 2. Load and Use the Plugin

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';

const pluginManager = new WundrPluginManager({
  pluginDir: './plugins',
  dataDir: './plugin-data',
  autoLoad: true,
  autoActivate: true,
});

await pluginManager.initialize();

// Plugin is now loaded and active!
const plugins = pluginManager.getActivePlugins();
console.log('Active plugins:', plugins.length);
```

---

## Core Concepts

### Plugin Lifecycle

Plugins go through a well-defined lifecycle:

```
UNLOADED → LOADING → LOADED → ACTIVATING → ACTIVE → DEACTIVATING → LOADED → UNLOADED
                                                  ↓
                                                ERROR
```

**Lifecycle Stages**:

1. **UNLOADED** - Plugin is not loaded
2. **LOADING** - Manifest and module are being loaded
3. **LOADED** - Plugin is loaded but not active
4. **ACTIVATING** - Plugin `activate()` method is being called
5. **ACTIVE** - Plugin is fully active and operational
6. **DEACTIVATING** - Plugin `deactivate()` method is being called
7. **ERROR** - Plugin encountered an error during loading/activation

**Lifecycle Methods**:

```typescript
class MyPlugin implements Plugin {
  // Called when plugin is first loaded
  async initialize(context: PluginContext): Promise<void> {
    // Setup configuration, prepare resources
  }

  // Called when plugin is activated
  async activate(): Promise<void> {
    // Start services, register hooks, begin operation
  }

  // Called when plugin is deactivated
  async deactivate(): Promise<void> {
    // Stop services, cleanup resources (but keep state)
  }

  // Called when plugin is unloaded (optional)
  async destroy(): Promise<void> {
    // Final cleanup, release all resources
  }
}
```

### Hook System

Hooks provide extension points where plugins can inject custom behavior:

```typescript
import { getHookRegistry } from '@wundr.io/plugin-system';

const hookRegistry = getHookRegistry();

// Register a hook
hookRegistry.register('before-save', {
  name: 'validate-data',
  description: 'Validate data before saving',
  execute: async data => {
    // Validate and transform data
    return validatedData;
  },
});

// Execute all hooks
const results = await hookRegistry.execute('before-save', data);

// Use transformed results
const finalData = results[results.length - 1];
```

**Hook Execution Models**:

1. **Async (execute)** - Execute all hooks asynchronously, collect results
2. **Sync (executeSync)** - Execute all hooks synchronously
3. **First-Match** - Execute hooks until one returns truthy value
4. **Pipeline** - Pass output of each hook to the next

### Plugin Context

Each plugin receives an isolated context with dedicated resources:

```typescript
interface PluginContext {
  logger: Logger; // Scoped logger for this plugin
  eventBus: EventBus; // Global event bus
  config: Record<string, unknown>; // Plugin-specific configuration
  pluginDir: string; // Plugin directory path
  dataDir: string; // Plugin data directory path
}
```

**Usage**:

```typescript
class MyPlugin implements Plugin {
  async initialize(context: PluginContext): Promise<void> {
    // Use scoped logger
    context.logger.info('Initializing plugin');

    // Access plugin configuration
    const apiKey = context.config.apiKey as string;

    // Read plugin files
    const dataPath = path.join(context.dataDir, 'cache.json');

    // Subscribe to events
    context.eventBus.on('app:shutdown', () => {
      this.cleanup();
    });
  }
}
```

---

## Creating Plugins

### Basic Plugin

```typescript
import type { Plugin, PluginContext, PluginMetadata } from '@wundr.io/plugin-system';

export default class BasicPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    name: 'basic-plugin',
    version: '1.0.0',
    description: 'A basic plugin example',
    author: 'Your Name',
    license: 'MIT',
  };

  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Basic plugin initialized');
  }

  async activate(): Promise<void> {
    this.context?.logger.info('Basic plugin activated');
    // Start plugin functionality
  }

  async deactivate(): Promise<void> {
    this.context?.logger.info('Basic plugin deactivated');
    // Stop plugin functionality
  }

  async destroy(): Promise<void> {
    this.context?.logger.info('Basic plugin destroyed');
    // Final cleanup
    this.context = undefined;
  }
}
```

### Plugin with Hooks

```typescript
import type { Plugin, PluginContext } from '@wundr.io/plugin-system';

export default class HookPlugin implements Plugin {
  readonly metadata = {
    name: 'hook-plugin',
    version: '1.0.0',
    description: 'Plugin using hooks',
  };

  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
  }

  async activate(): Promise<void> {
    const { hookRegistry } = this.context!;

    // Register data validation hook
    hookRegistry.register('validate-input', {
      name: 'email-validator',
      description: 'Validate email addresses',
      execute: async (input: any) => {
        if (input.email && !this.isValidEmail(input.email)) {
          throw new Error('Invalid email address');
        }
        return input;
      },
    });

    // Register data transformation hook
    hookRegistry.register('transform-output', {
      name: 'add-timestamp',
      description: 'Add timestamp to output',
      execute: async (output: any) => {
        return {
          ...output,
          timestamp: new Date().toISOString(),
        };
      },
    });
  }

  async deactivate(): Promise<void> {
    const { hookRegistry } = this.context!;

    // Unregister hooks
    hookRegistry.clear('validate-input');
    hookRegistry.clear('transform-output');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### Plugin Manifest

The `plugin.json` manifest file describes your plugin:

```json
{
  "name": "my-plugin",
  "version": "2.1.0",
  "description": "A comprehensive plugin example",
  "main": "dist/index.js",
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "keywords": ["plugin", "wundr", "extension"],
  "repository": "https://github.com/you/my-plugin",
  "homepage": "https://my-plugin.example.com",
  "enabled": true,
  "config": {
    "apiKey": "default-key",
    "timeout": 5000,
    "retryAttempts": 3
  },
  "dependencies": ["other-plugin@^1.0.0"],
  "peerDependencies": ["@wundr.io/core@^1.0.0"]
}
```

**Required Fields**:

- `name` - Plugin identifier (unique)
- `version` - Semver version
- `description` - Brief description
- `main` - Entry point file

**Optional Fields**:

- `author` - Plugin author
- `license` - License identifier
- `enabled` - Whether plugin should be loaded (default: true)
- `config` - Default configuration
- `dependencies` - Other plugins this plugin depends on

---

## Usage Examples

### Plugin Manager Setup

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';
import { getLogger, getEventBus } from '@wundr.io/core';

const pluginManager = new WundrPluginManager({
  pluginDir: './plugins', // Where plugins are located
  dataDir: './plugin-data', // Where plugins store data
  autoLoad: true, // Load plugins on initialize
  autoActivate: true, // Activate plugins after loading
  maxConcurrentLoads: 5, // Load up to 5 plugins in parallel
  loadTimeout: 30000, // 30 second load timeout
  logger: getLogger(), // Custom logger
  eventBus: getEventBus(), // Custom event bus
});

await pluginManager.initialize();

console.log('Plugin manager ready!');
```

### Loading Plugins

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';

const pluginManager = new WundrPluginManager({
  pluginDir: './plugins',
  dataDir: './plugin-data',
  autoLoad: false, // Manual loading
});

await pluginManager.initialize();

// Load a single plugin
try {
  const pluginInfo = await pluginManager.loadPlugin('my-plugin');
  console.log('Plugin loaded:', pluginInfo.metadata.name);
  console.log('Load time:', pluginInfo.loadTime, 'ms');
} catch (error) {
  console.error('Failed to load plugin:', error);
}

// Activate the plugin
await pluginManager.activatePlugin('my-plugin');

// Check plugin status
const plugin = pluginManager.getPlugin('my-plugin');
console.log('Plugin status:', plugin?.status); // "active"

// Deactivate when done
await pluginManager.deactivatePlugin('my-plugin');

// Unload completely
await pluginManager.unloadPlugin('my-plugin');

// Reload plugin (unload + load)
await pluginManager.reloadPlugin('my-plugin');
```

### Using Hooks

```typescript
import { getHookRegistry } from '@wundr.io/plugin-system';

const hookRegistry = getHookRegistry();

// Define a hook
hookRegistry.register('format-output', {
  name: 'json-formatter',
  description: 'Format output as JSON',
  execute: async (data: any) => {
    return JSON.stringify(data, null, 2);
  },
});

hookRegistry.register('format-output', {
  name: 'html-formatter',
  description: 'Wrap in HTML',
  execute: async (data: string) => {
    return `<pre>${data}</pre>`;
  },
});

// Execute hooks (async)
const results = await hookRegistry.execute('format-output', { name: 'John' });
console.log(results);
// [
//   '{\n  "name": "John"\n}',
//   '<pre>{\n  "name": "John"\n}</pre>'
// ]

// Execute hooks synchronously
const syncResults = hookRegistry.executeSync('format-output', { name: 'John' });

// Check if hooks exist
if (hookRegistry.has('format-output')) {
  console.log('Format hooks available:', hookRegistry.getHooks('format-output').length);
}

// Clear specific hooks
hookRegistry.clear('format-output');

// Clear all hooks
hookRegistry.clear();
```

### Plugin Discovery

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';

const pluginManager = new WundrPluginManager({
  pluginDir: './plugins',
  dataDir: './plugin-data',
});

await pluginManager.initialize();

// Discover available plugins
const pluginIds = await pluginManager.discoverPlugins();
console.log('Available plugins:', pluginIds);
// ['my-plugin', 'another-plugin', 'third-plugin']

// Validate plugins before loading
for (const pluginId of pluginIds) {
  const isValid = await pluginManager.validatePlugin(pluginId);

  if (isValid) {
    console.log(`✓ ${pluginId} is valid`);
  } else {
    console.log(`✗ ${pluginId} has invalid manifest`);
  }
}

// Load all valid plugins
await pluginManager.loadAll();

// Get all loaded plugins
const allPlugins = pluginManager.getAllPlugins();
console.log('Total plugins:', allPlugins.length);

// Get only active plugins
const activePlugins = pluginManager.getActivePlugins();
console.log('Active plugins:', activePlugins.length);

// Check if specific plugin exists
if (pluginManager.hasPlugin('my-plugin')) {
  const plugin = pluginManager.getPlugin('my-plugin');
  console.log('Plugin info:', {
    name: plugin.metadata.name,
    version: plugin.metadata.version,
    status: plugin.status,
  });
}
```

### Batch Operations

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';

const pluginManager = new WundrPluginManager({
  pluginDir: './plugins',
  dataDir: './plugin-data',
  maxConcurrentLoads: 3, // Load 3 plugins at a time
});

await pluginManager.initialize();

// Load all plugins (respects maxConcurrentLoads)
const loadedPlugins = await pluginManager.loadAll();
console.log(`Loaded ${loadedPlugins.length} plugins`);

// Activate all loaded plugins
await pluginManager.activateAll();
console.log('All plugins activated');

// Deactivate all active plugins
await pluginManager.deactivateAll();
console.log('All plugins deactivated');

// Clean shutdown
await pluginManager.destroy();
console.log('Plugin manager destroyed');
```

### Monitoring Plugin Events

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';
import { getEventBus } from '@wundr.io/core';
import { PLUGIN_EVENTS } from '@wundr.io/plugin-system';

const eventBus = getEventBus();
const pluginManager = new WundrPluginManager({
  pluginDir: './plugins',
  dataDir: './plugin-data',
});

// Subscribe to plugin events
eventBus.on(PLUGIN_EVENTS.PLUGIN_LOADING, event => {
  console.log(`Loading plugin: ${event.pluginId}`);
});

eventBus.on(PLUGIN_EVENTS.PLUGIN_LOADED, event => {
  console.log(`Loaded plugin: ${event.pluginId} in ${event.loadTime}ms`);
});

eventBus.on(PLUGIN_EVENTS.PLUGIN_ACTIVATED, event => {
  console.log(`Activated plugin: ${event.pluginId}`);
});

eventBus.on(PLUGIN_EVENTS.PLUGIN_ERROR, event => {
  console.error(`Plugin error in ${event.pluginId}:`, event.error);
});

await pluginManager.initialize();
await pluginManager.loadAll();
```

---

## API Reference

### PluginManager

#### Constructor Options

```typescript
interface PluginManagerOptions {
  pluginDir: string; // Directory containing plugins
  dataDir: string; // Directory for plugin data
  autoLoad?: boolean; // Auto-load plugins on init (default: true)
  autoActivate?: boolean; // Auto-activate after loading (default: true)
  maxConcurrentLoads?: number; // Max parallel loads (default: 5)
  loadTimeout?: number; // Load timeout in ms (default: 30000)
  logger?: Logger; // Custom logger
  eventBus?: EventBus; // Custom event bus
}
```

#### Lifecycle Methods

```typescript
// Initialize the plugin manager
initialize(): Promise<void>

// Destroy the plugin manager and all plugins
destroy(): Promise<void>
```

#### Plugin Management Methods

```typescript
// Load a single plugin
loadPlugin(pluginId: string): Promise<PluginInfo>

// Unload a plugin
unloadPlugin(pluginId: string): Promise<void>

// Activate a loaded plugin
activatePlugin(pluginId: string): Promise<void>

// Deactivate an active plugin
deactivatePlugin(pluginId: string): Promise<void>

// Reload a plugin (unload + load)
reloadPlugin(pluginId: string): Promise<PluginInfo>

// Get plugin information
getPlugin(pluginId: string): PluginInfo | undefined

// Get all plugins
getAllPlugins(): PluginInfo[]

// Get only active plugins
getActivePlugins(): PluginInfo[]

// Check if plugin exists
hasPlugin(pluginId: string): boolean
```

#### Discovery Methods

```typescript
// Discover plugins in plugin directory
discoverPlugins(): Promise<string[]>

// Validate plugin manifest
validatePlugin(pluginId: string): Promise<boolean>
```

#### Batch Methods

```typescript
// Load all discovered plugins
loadAll(): Promise<PluginInfo[]>

// Activate all loaded plugins
activateAll(): Promise<void>

// Deactivate all active plugins
deactivateAll(): Promise<void>
```

### Hook Registry

```typescript
import { getHookRegistry, type PluginHook } from '@wundr.io/plugin-system';

const hookRegistry = getHookRegistry();

// Register a hook
hookRegistry.register<T>(name: string, hook: PluginHook<T>): void

// Unregister a hook
hookRegistry.unregister(name: string, hook: PluginHook): void

// Execute hooks asynchronously
hookRegistry.execute<T>(name: string, ...args: unknown[]): Promise<T[]>

// Execute hooks synchronously
hookRegistry.executeSync<T>(name: string, ...args: unknown[]): T[]

// Check if hooks exist
hookRegistry.has(name: string): boolean

// Get all hooks for a name
hookRegistry.getHooks(name: string): PluginHook[]

// Clear hooks (specific name or all)
hookRegistry.clear(name?: string): void
```

### Events

```typescript
import { PLUGIN_EVENTS } from '@wundr.io/plugin-system';

// Plugin lifecycle events
PLUGIN_EVENTS.PLUGIN_LOADING; // Plugin is being loaded
PLUGIN_EVENTS.PLUGIN_LOADED; // Plugin loaded successfully
PLUGIN_EVENTS.PLUGIN_LOAD_ERROR; // Plugin load failed
PLUGIN_EVENTS.PLUGIN_ACTIVATING; // Plugin is being activated
PLUGIN_EVENTS.PLUGIN_ACTIVATED; // Plugin activated successfully
PLUGIN_EVENTS.PLUGIN_ACTIVATION_ERROR; // Plugin activation failed
PLUGIN_EVENTS.PLUGIN_DEACTIVATING; // Plugin is being deactivated
PLUGIN_EVENTS.PLUGIN_DEACTIVATED; // Plugin deactivated successfully
PLUGIN_EVENTS.PLUGIN_DEACTIVATION_ERROR; // Plugin deactivation failed
PLUGIN_EVENTS.PLUGIN_UNLOADING; // Plugin is being unloaded
PLUGIN_EVENTS.PLUGIN_UNLOADED; // Plugin unloaded successfully
PLUGIN_EVENTS.PLUGIN_ERROR; // General plugin error

// Hook events
PLUGIN_EVENTS.HOOK_REGISTERED; // Hook registered
PLUGIN_EVENTS.HOOK_UNREGISTERED; // Hook unregistered
PLUGIN_EVENTS.HOOK_EXECUTED; // Hook executed
```

---

## Integration Guide

### With @wundr.io/cli

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';
import { Command } from 'commander';

// Create plugin manager for CLI extensions
const pluginManager = new WundrPluginManager({
  pluginDir: './.wundr/plugins',
  dataDir: './.wundr/plugin-data',
  autoLoad: true,
  autoActivate: true,
});

await pluginManager.initialize();

// Allow plugins to register CLI commands via hooks
const hookRegistry = pluginManager.hookRegistry;

const program = new Command();

// Execute CLI hooks to let plugins register commands
await hookRegistry.execute('register-commands', program);

program.parse(process.argv);
```

### With @wundr.io/config

```typescript
import { WundrPluginManager } from '@wundr.io/plugin-system';
import { WundrConfigManager, MemoryConfigSource } from '@wundr.io/config';

// Create plugin manager with config
const configManager = new WundrConfigManager({
  sources: [new MemoryConfigSource({ priority: 100 })],
});

await configManager.initialize();

const pluginManager = new WundrPluginManager({
  pluginDir: './plugins',
  dataDir: './plugin-data',
});

await pluginManager.initialize();

// Pass plugin-specific config to plugins
const plugins = pluginManager.getAllPlugins();
plugins.forEach(plugin => {
  const pluginConfig = configManager.get(`plugins.${plugin.id}`);
  // Plugin receives config in context
});
```

---

## Best Practices

### 1. Handle Plugin Errors Gracefully

```typescript
// ✅ Good: Handle individual plugin failures
try {
  await pluginManager.loadPlugin('unstable-plugin');
} catch (error) {
  logger.warn('Failed to load unstable-plugin, continuing...', error);
}

// ❌ Bad: Let one plugin failure stop everything
await pluginManager.loadPlugin('unstable-plugin'); // May crash app
```

### 2. Use Hooks for Extension Points

```typescript
// ✅ Good: Provide clear extension points
hookRegistry.register('before-execute', hook);
hookRegistry.register('after-execute', hook);
hookRegistry.register('on-error', hook);

// ❌ Bad: Hardcode behavior with no extension
function execute() {
  // No way for plugins to extend this
}
```

### 3. Clean Up Resources

```typescript
// ✅ Good: Implement destroy method
class MyPlugin implements Plugin {
  private timer?: NodeJS.Timer;

  async activate() {
    this.timer = setInterval(() => {}, 1000);
  }

  async destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

// ❌ Bad: Leave resources running
class BadPlugin implements Plugin {
  async activate() {
    setInterval(() => {}, 1000); // Memory leak!
  }
}
```

### 4. Validate Plugin Compatibility

```typescript
// ✅ Good: Check dependencies and version
const plugin = pluginManager.getPlugin('my-plugin');
if (plugin.metadata.dependencies) {
  for (const dep of plugin.metadata.dependencies) {
    if (!pluginManager.hasPlugin(dep)) {
      throw new Error(`Missing dependency: ${dep}`);
    }
  }
}

// ❌ Bad: Assume dependencies are available
await pluginManager.loadPlugin('my-plugin'); // May fail silently
```

---

## Troubleshooting

### Plugin Not Loading

**Problem**: Plugin fails to load with no clear error.

**Solutions**:

```typescript
// 1. Check plugin directory
const exists = await fs
  .access('./plugins/my-plugin')
  .then(() => true)
  .catch(() => false);

// 2. Validate manifest
const isValid = await pluginManager.validatePlugin('my-plugin');
if (!isValid) {
  console.error('Invalid manifest');
}

// 3. Check plugin status
const plugin = pluginManager.getPlugin('my-plugin');
if (plugin?.status === 'error') {
  console.error('Plugin error:', plugin.error);
}
```

### Hook Not Executing

**Problem**: Registered hooks are not being called.

**Solutions**:

```typescript
// 1. Verify hook is registered
const hooks = hookRegistry.getHooks('my-hook');
console.log('Registered hooks:', hooks.length);

// 2. Check hook name matches exactly
hookRegistry.register('before-save', hook); // ✓
await hookRegistry.execute('before-save', data);

// ❌ Wrong: Typo in name
await hookRegistry.execute('beforeSave', data);

// 3. Ensure async hooks are awaited
await hookRegistry.execute('my-hook', data); // ✓
hookRegistry.execute('my-hook', data); // ❌ Promise not awaited
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/adapticai/wundr.git
cd wundr/packages/@wundr/plugin-system

# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm run test

# Type check
pnpm run typecheck
```

---

## License

MIT © [Wundr, by Adaptic.ai](https://wundr.io)

---

## Related Packages

- [@wundr.io/core](../core/README.md) - Core utilities and base classes
- [@wundr.io/cli](../cli/README.md) - Command-line interface with plugin support
- [@wundr.io/config](../config/README.md) - Configuration management

---

**Part of the [@wundr.io](https://wundr.io) ecosystem** - Building excellence, systematically.
