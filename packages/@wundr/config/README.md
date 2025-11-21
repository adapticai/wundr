# @wundr.io/config

[![npm version](https://img.shields.io/npm/v/@wundr.io/config.svg)](https://www.npmjs.com/package/@wundr.io/config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)

> **Multi-source configuration management with validation, auto-reload, and event-driven
> architecture**

From scattered settings to unified configuration, systematically. `@wundr.io/config` provides
enterprise-grade configuration management that scales from simple JSON files to complex
multi-environment deployments with automatic synchronization and validation.

---

## Overview

`@wundr.io/config` is a flexible configuration management system designed for modern applications
that need to:

- **Load configuration from multiple sources** with priority-based merging
- **Validate configuration** automatically with custom validation rules
- **Watch for changes** and auto-reload when configuration files change
- **Type-safe access** with TypeScript support and dot notation
- **Event-driven updates** for real-time configuration synchronization

### Key Features

- 🔄 **Multi-Source Loading** - JSON, YAML, ENV variables, files, and in-memory sources
- ✅ **Built-in Validation** - Zod schema validation with custom rules
- 👁️ **Auto-Reload** - Watch configuration files and reload automatically
- 💾 **Auto-Save** - Automatically persist configuration changes
- 🎯 **Priority-Based** - Control configuration precedence across sources
- 📢 **Event System** - React to configuration changes in real-time
- 🔍 **Deep Nesting** - Access nested configuration with dot notation
- 🛡️ **Type-Safe** - Full TypeScript support with generics

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Configuration Sources](#configuration-sources)
  - [Priority System](#priority-system)
  - [Validation Rules](#validation-rules)
- [Usage Examples](#usage-examples)
  - [Basic Configuration](#basic-configuration)
  - [Multiple Sources](#multiple-sources)
  - [Watching for Changes](#watching-for-changes)
  - [Validation](#validation)
  - [Auto-Save Configuration](#auto-save-configuration)
- [API Reference](#api-reference)
  - [ConfigManager](#configmanager)
  - [Configuration Sources](#configuration-sources-1)
  - [Events](#events)
- [Integration Guide](#integration-guide)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
npm install @wundr.io/config
```

### Peer Dependencies

```bash
npm install @wundr.io/core
```

---

## Quick Start

```typescript
import { WundrConfigManager, JsonConfigSource, EnvConfigSource } from '@wundr.io/config';

// Create configuration manager
const configManager = new WundrConfigManager({
  sources: [
    new EnvConfigSource({ priority: 100 }),
    new JsonConfigSource({ filePath: './config.json', priority: 50 }),
  ],
  autoReload: true,
});

// Initialize
await configManager.initialize();

// Get configuration values
const logLevel = configManager.get<string>('core.logLevel', 'info');
const maxConnections = configManager.get<number>('database.maxConnections', 10);

// Set configuration values
configManager.set('app.name', 'MyApp');

// Watch for changes
configManager.watch('core.logLevel', (newValue, oldValue) => {
  console.log(`Log level changed from ${oldValue} to ${newValue}`);
});
```

---

## Core Concepts

### Configuration Sources

Configuration sources provide configuration data from various backends. Each source has a priority
that determines merge order.

**Built-in Sources**:

1. **JsonConfigSource** - Load from JSON files
2. **YamlConfigSource** - Load from YAML files
3. **EnvConfigSource** - Load from environment variables
4. **FileConfigSource** - Load from generic files
5. **MemoryConfigSource** - In-memory configuration (testing)

```typescript
import { JsonConfigSource, EnvConfigSource, YamlConfigSource } from '@wundr.io/config';

// JSON source with file watching
const jsonSource = new JsonConfigSource({
  filePath: './config.json',
  priority: 50,
  watch: true, // Auto-reload on file changes
});

// Environment variables (highest priority)
const envSource = new EnvConfigSource({
  priority: 100,
  prefix: 'APP_', // Only load vars starting with APP_
  delimiter: '_', // Convert APP_DB_HOST to db.host
});

// YAML source
const yamlSource = new YamlConfigSource({
  filePath: './config.yaml',
  priority: 40,
});
```

### Priority System

Sources with **higher priority override** sources with lower priority during configuration merge:

```typescript
// Priority order (higher = more important):
// 1. EnvConfigSource (priority: 100) ← Highest
// 2. JsonConfigSource (priority: 50)
// 3. YamlConfigSource (priority: 40)  ← Lowest

const configManager = new WundrConfigManager({
  sources: [
    new EnvConfigSource({ priority: 100 }), // Wins for conflicts
    new JsonConfigSource({ priority: 50 }),
    new YamlConfigSource({ priority: 40 }), // Base configuration
  ],
});
```

**Example**:

- `config.yaml` sets `db.host = "localhost"`
- `config.json` sets `db.host = "dev.mysql.com"`
- `APP_DB_HOST` env var sets `db.host = "prod.mysql.com"`

**Result**: `db.host = "prod.mysql.com"` (environment variable wins)

### Validation Rules

Add validation rules to ensure configuration correctness:

```typescript
import { WundrConfigManager, type ValidationRule } from '@wundr.io/config';

const rules: ValidationRule[] = [
  {
    key: 'database.host',
    required: true,
    validator: value => {
      if (typeof value !== 'string') return 'Must be a string';
      if (value.length === 0) return 'Cannot be empty';
      return true;
    },
  },
  {
    key: 'server.port',
    required: true,
    validator: value => {
      if (typeof value !== 'number') return 'Must be a number';
      if (value < 1 || value > 65535) return 'Must be between 1-65535';
      return true;
    },
  },
];

const configManager = new WundrConfigManager({
  sources: [
    /* ... */
  ],
  validationRules: rules,
});

// Validate configuration
const result = configManager.validate();
if (!result.valid) {
  console.error('Configuration errors:', result.errors);
}
```

---

## Usage Examples

### Basic Configuration

```typescript
import { WundrConfigManager, JsonConfigSource } from '@wundr.io/config';

const configManager = new WundrConfigManager({
  sources: [new JsonConfigSource({ filePath: './config.json', priority: 50 })],
});

await configManager.initialize();

// Get values with type safety
const appName = configManager.get<string>('app.name');
const port = configManager.get<number>('server.port', 3000);
const features = configManager.get<string[]>('app.features', []);

// Check existence
if (configManager.has('database.connectionString')) {
  const connStr = configManager.get<string>('database.connectionString');
}

// Get all configuration
const allConfig = configManager.getAll();
console.log('Current configuration:', allConfig);
```

### Multiple Sources

```typescript
import {
  WundrConfigManager,
  JsonConfigSource,
  YamlConfigSource,
  EnvConfigSource,
  MemoryConfigSource,
} from '@wundr.io/config';

const configManager = new WundrConfigManager({
  sources: [
    // Environment variables (highest priority)
    new EnvConfigSource({
      priority: 100,
      prefix: 'APP_',
      delimiter: '_',
    }),

    // Environment-specific JSON (medium-high priority)
    new JsonConfigSource({
      filePath: `./config.${process.env.NODE_ENV}.json`,
      priority: 75,
    }),

    // Base JSON configuration (medium priority)
    new JsonConfigSource({
      filePath: './config.json',
      priority: 50,
    }),

    // YAML defaults (low priority)
    new YamlConfigSource({
      filePath: './config.yaml',
      priority: 25,
    }),

    // Runtime overrides (testing/debugging)
    new MemoryConfigSource({
      priority: 150,
      data: {
        debug: true,
        logLevel: 'verbose',
      },
    }),
  ],
  autoReload: true,
});

await configManager.initialize();

// Configuration is automatically merged by priority
console.log('Effective configuration:', configManager.getAll());
```

### Watching for Changes

```typescript
import { WundrConfigManager, JsonConfigSource } from '@wundr.io/config';
import { getEventBus } from '@wundr.io/core';

const configManager = new WundrConfigManager({
  sources: [
    new JsonConfigSource({
      filePath: './config.json',
      priority: 50,
      watch: true, // Enable file watching
    }),
  ],
  autoReload: true,
});

await configManager.initialize();

// Watch specific key
const unwatch = configManager.watch('database.host', (newValue, oldValue) => {
  console.log(`Database host changed: ${oldValue} → ${newValue}`);

  // Reconnect to database with new host
  reconnectDatabase(newValue);
});

// Watch all changes
const unwatchAll = configManager.watchAll(config => {
  console.log('Configuration updated:', config);
});

// Subscribe to events
const eventBus = getEventBus();

eventBus.on('config:loaded', event => {
  console.log('Configuration loaded from sources:', event.sources);
});

eventBus.on('config:changed', event => {
  console.log(`Configuration key "${event.key}" changed`, {
    oldValue: event.oldValue,
    newValue: event.value,
  });
});

// Later: Stop watching
unwatch();
unwatchAll();
```

### Validation

```typescript
import { WundrConfigManager, JsonConfigSource, type ValidationRule } from '@wundr.io/config';
import { z } from 'zod';

// Define validation rules
const rules: ValidationRule[] = [
  {
    key: 'database.host',
    required: true,
    description: 'Database host address',
    validator: value => {
      if (typeof value !== 'string') return 'Must be a string';
      if (!value.match(/^[a-z0-9.-]+$/i)) return 'Invalid hostname format';
      return true;
    },
  },
  {
    key: 'database.port',
    required: true,
    validator: value => {
      if (typeof value !== 'number') return 'Must be a number';
      if (value < 1 || value > 65535) return 'Port must be 1-65535';
      return true;
    },
  },
  {
    key: 'api.keys',
    required: true,
    validator: value => {
      if (!Array.isArray(value)) return 'Must be an array';
      if (value.length === 0) return 'At least one API key required';
      return true;
    },
  },
];

const configManager = new WundrConfigManager({
  sources: [new JsonConfigSource({ filePath: './config.json', priority: 50 })],
  validationRules: rules,
});

await configManager.initialize();

// Validate configuration
const validationResult = configManager.validate();

if (!validationResult.valid) {
  console.error('❌ Configuration validation failed:');
  validationResult.errors.forEach(error => {
    console.error(`  - ${error.key}: ${error.message}`);
    console.error(`    Current value:`, error.value);
  });
  process.exit(1);
}

console.log('✅ Configuration is valid');

// Use Zod for complex validation
const DatabaseConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  username: z.string(),
  password: z.string().min(8),
  database: z.string(),
});

const zodValidationRule: ValidationRule = {
  key: 'database',
  required: true,
  validator: value => {
    try {
      DatabaseConfigSchema.parse(value);
      return true;
    } catch (error) {
      return error instanceof z.ZodError
        ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        : 'Invalid database configuration';
    }
  },
};
```

### Auto-Save Configuration

```typescript
import { WundrConfigManager, JsonConfigSource } from '@wundr.io/config';

const configManager = new WundrConfigManager({
  sources: [
    new JsonConfigSource({
      filePath: './config.json',
      priority: 50,
      writable: true, // Enable writing
    }),
  ],
  autoSave: true, // Automatically save changes
  debounceMs: 500, // Debounce saves by 500ms
});

await configManager.initialize();

// Changes are automatically saved to config.json
configManager.set('app.lastStarted', new Date().toISOString());
configManager.set('app.version', '1.2.3');
configManager.set('features.analytics', true);

// Manual save
await configManager.save();

// Manual reload
await configManager.reload();
```

### Dynamic Configuration Updates

```typescript
import { WundrConfigManager, MemoryConfigSource } from '@wundr.io/config';

const runtimeConfig = new MemoryConfigSource({ priority: 150 });

const configManager = new WundrConfigManager({
  sources: [
    runtimeConfig,
    // ... other sources
  ],
});

await configManager.initialize();

// Update runtime configuration
configManager.set('feature.flags.newUI', true);
configManager.set('performance.maxConcurrency', 20);

// Delete configuration
configManager.delete('feature.flags.oldFeature');

// Clear all runtime overrides
configManager.clear();
```

---

## API Reference

### ConfigManager

#### Constructor Options

```typescript
interface ConfigOptions {
  sources?: ConfigSource[]; // Configuration sources to load
  validationRules?: ValidationRule[]; // Validation rules to apply
  autoReload?: boolean; // Auto-reload on source changes (default: true)
  autoSave?: boolean; // Auto-save on value changes (default: false)
  debounceMs?: number; // Debounce time for reload/save (default: 300)
  freezeConfig?: boolean; // Freeze returned config objects (default: false)
}
```

#### Methods

**Configuration Access**:

```typescript
// Get a value (with optional default)
get<T>(key: string, defaultValue?: T): T

// Set a value
set(key: string, value: unknown): void

// Check if key exists
has(key: string): boolean

// Delete a key
delete(key: string): void

// Clear all configuration
clear(): void

// Get all configuration
getAll(): Record<string, unknown>
```

**Source Management**:

```typescript
// Add a configuration source
addSource(source: ConfigSource): void

// Remove a configuration source
removeSource(sourceName: string): void

// Get all sources
getSources(): ConfigSource[]
```

**Watching**:

```typescript
// Watch a specific key
watch(
  key: string,
  callback: (value: unknown, oldValue: unknown) => void
): () => void

// Watch all changes
watchAll(
  callback: (config: Record<string, unknown>) => void
): () => void
```

**Lifecycle**:

```typescript
// Initialize the configuration manager
initialize(): Promise<void>

// Reload from all sources
reload(): Promise<void>

// Save to writable sources
save(): Promise<void>

// Validate configuration
validate(): ValidationResult
```

### Configuration Sources

All configuration sources implement the `ConfigSource` interface:

```typescript
interface ConfigSource {
  readonly name: string;
  readonly priority: number;
  load(): Promise<Record<string, unknown>> | Record<string, unknown>;
  save?(config: Record<string, unknown>): Promise<void> | void;
  watch?(callback: (config: Record<string, unknown>) => void): () => void;
}
```

#### JsonConfigSource

```typescript
import { JsonConfigSource } from '@wundr.io/config';

const source = new JsonConfigSource({
  name: 'json-config',
  filePath: './config.json',
  priority: 50,
  watch: true, // Watch file for changes
  writable: true, // Allow saving
});
```

#### YamlConfigSource

```typescript
import { YamlConfigSource } from '@wundr.io/config';

const source = new YamlConfigSource({
  name: 'yaml-config',
  filePath: './config.yaml',
  priority: 40,
  watch: true,
  writable: true,
});
```

#### EnvConfigSource

```typescript
import { EnvConfigSource } from '@wundr.io/config';

const source = new EnvConfigSource({
  name: 'env-config',
  priority: 100,
  prefix: 'APP_', // Only load vars starting with APP_
  delimiter: '_', // Convert APP_DB_HOST to db.host
});
```

#### MemoryConfigSource

```typescript
import { MemoryConfigSource } from '@wundr.io/config';

const source = new MemoryConfigSource({
  name: 'memory-config',
  priority: 150,
  data: {
    feature: { enabled: true },
    debug: true,
  },
});
```

### Events

Subscribe to configuration events via `@wundr.io/core` event bus:

```typescript
import { getEventBus } from '@wundr.io/core';
import { CONFIG_EVENTS } from '@wundr.io/config';

const eventBus = getEventBus();

// Configuration loaded
eventBus.on(CONFIG_EVENTS.CONFIG_LOADED, event => {
  console.log('Configuration loaded:', event.sources);
});

// Configuration changed
eventBus.on(CONFIG_EVENTS.CONFIG_CHANGED, event => {
  console.log(`Key "${event.key}" changed:`, {
    oldValue: event.oldValue,
    newValue: event.value,
  });
});

// Configuration saved
eventBus.on(CONFIG_EVENTS.CONFIG_SAVED, event => {
  console.log('Configuration saved to sources:', event.writableSources);
});

// Source added
eventBus.on(CONFIG_EVENTS.SOURCE_ADDED, event => {
  console.log('Source added:', event.sourceName);
});

// Source removed
eventBus.on(CONFIG_EVENTS.SOURCE_REMOVED, event => {
  console.log('Source removed:', event.sourceName);
});

// Validation failed
eventBus.on(CONFIG_EVENTS.VALIDATION_FAILED, event => {
  console.error('Validation errors:', event.errors);
});

// Configuration error
eventBus.on(CONFIG_EVENTS.CONFIG_ERROR, event => {
  console.error('Configuration error:', event.error);
});
```

---

## Integration Guide

### With @wundr.io/core

```typescript
import { getLogger, getEventBus } from '@wundr.io/core';
import { WundrConfigManager, JsonConfigSource } from '@wundr.io/config';

const logger = getLogger();
const eventBus = getEventBus();

const configManager = new WundrConfigManager({
  sources: [new JsonConfigSource({ filePath: './config.json', priority: 50 })],
});

await configManager.initialize();

// Configuration is automatically logged via @wundr.io/core logger
// Events are automatically emitted via @wundr.io/core event bus
```

### With @wundr.io/cli

```typescript
import { WundrConfigManager, JsonConfigSource, EnvConfigSource } from '@wundr.io/config';

export async function setupConfig() {
  const configManager = new WundrConfigManager({
    sources: [
      new EnvConfigSource({ priority: 100 }),
      new JsonConfigSource({
        filePath: './.wundr/config.json',
        priority: 50,
        watch: true,
      }),
    ],
    autoReload: true,
  });

  await configManager.initialize();

  return configManager;
}

// Use in CLI commands
const config = await setupConfig();
const outputDir = config.get<string>('output.directory', './dist');
```

### With @wundr.io/security

```typescript
import { WundrConfigManager } from '@wundr.io/config';
import { SecureConfigSource } from '@wundr.io/security';

const configManager = new WundrConfigManager({
  sources: [
    // Encrypted configuration with @wundr.io/security
    new SecureConfigSource({
      filePath: './config.encrypted',
      priority: 100,
      encryptionKey: process.env.CONFIG_ENCRYPTION_KEY,
    }),
  ],
});
```

---

## Best Practices

### 1. Use Priority Strategically

```typescript
// ✅ Good: Clear priority hierarchy
const configManager = new WundrConfigManager({
  sources: [
    new EnvConfigSource({ priority: 100 }), // Runtime overrides
    new JsonConfigSource({
      filePath: './config.prod.json',
      priority: 75, // Environment-specific
    }),
    new JsonConfigSource({
      filePath: './config.json',
      priority: 50, // Base configuration
    }),
  ],
});

// ❌ Bad: Confusing priorities
const configManager = new WundrConfigManager({
  sources: [
    new EnvConfigSource({ priority: 73 }),
    new JsonConfigSource({ priority: 82 }),
    new YamlConfigSource({ priority: 41 }),
  ],
});
```

### 2. Always Validate Critical Configuration

```typescript
// ✅ Good: Validate before use
const configManager = new WundrConfigManager({
  sources: [/* ... */],
  validationRules: [
    { key: 'database.host', required: true, validator: /* ... */ },
    { key: 'api.key', required: true, validator: /* ... */ },
  ],
});

await configManager.initialize();

const validation = configManager.validate();
if (!validation.valid) {
  throw new Error('Invalid configuration');
}

// ❌ Bad: No validation
const dbHost = configManager.get('database.host'); // Might be undefined!
```

### 3. Use Type-Safe Getters

```typescript
// ✅ Good: Type-safe with defaults
const port = configManager.get<number>('server.port', 3000);
const features = configManager.get<string[]>('app.features', []);

// ❌ Bad: No type safety
const port = configManager.get('server.port'); // any type
```

### 4. Clean Up Watchers

```typescript
// ✅ Good: Clean up watchers
const unwatch = configManager.watch('key', callback);

// Later, when component unmounts or is destroyed:
unwatch();

// ❌ Bad: Memory leak from not cleaning up
configManager.watch('key', callback); // Never cleaned up
```

### 5. Use Auto-Reload in Development

```typescript
// ✅ Good: Enable auto-reload in dev
const configManager = new WundrConfigManager({
  sources: [
    new JsonConfigSource({
      filePath: './config.json',
      watch: process.env.NODE_ENV === 'development',
    }),
  ],
  autoReload: process.env.NODE_ENV === 'development',
});
```

---

## Troubleshooting

### Configuration Not Loading

**Problem**: Configuration values are undefined or not loading.

**Solutions**:

```typescript
// 1. Check if sources are properly added
const sources = configManager.getSources();
console.log('Active sources:', sources.length);

// 2. Verify file paths
const jsonSource = new JsonConfigSource({
  filePath: path.resolve(__dirname, './config.json'),
  priority: 50,
});

// 3. Check initialization
await configManager.initialize(); // Don't forget to await!

// 4. Enable debug logging
import { getLogger } from '@wundr.io/core';
const logger = getLogger();
logger.setLevel('debug');
```

### Priority Issues

**Problem**: Wrong configuration values due to priority conflicts.

**Solutions**:

```typescript
// 1. List sources by priority
const sources = configManager.getSources();
sources.forEach(source => {
  console.log(`${source.name}: priority ${source.priority}`);
});

// 2. Use clear priority gaps
new EnvConfigSource({ priority: 100 }),     // Environment
new JsonConfigSource({ priority: 50 }),     // Application
new YamlConfigSource({ priority: 25 }),     // Defaults

// 3. Test merged configuration
const allConfig = configManager.getAll();
console.log('Effective configuration:', allConfig);
```

### Validation Errors

**Problem**: Validation is failing unexpectedly.

**Solutions**:

```typescript
// 1. Check validation results
const result = configManager.validate();
if (!result.valid) {
  result.errors.forEach(error => {
    console.error(`Validation error in "${error.key}":`, {
      message: error.message,
      currentValue: error.value,
    });
  });
}

// 2. Make validators more permissive during development
const rule: ValidationRule = {
  key: 'api.timeout',
  required: process.env.NODE_ENV === 'production',
  validator: value => {
    // Allow undefined in development
    if (process.env.NODE_ENV !== 'production' && value === undefined) {
      return true;
    }
    return typeof value === 'number';
  },
};
```

### File Watching Not Working

**Problem**: Changes to configuration files are not triggering reload.

**Solutions**:

```typescript
// 1. Verify watch option is enabled
const source = new JsonConfigSource({
  filePath: './config.json',
  watch: true, // Must be true
  priority: 50,
});

// 2. Check autoReload option
const configManager = new WundrConfigManager({
  sources: [source],
  autoReload: true, // Must be true
});

// 3. Listen to reload events
import { getEventBus } from '@wundr.io/core';
getEventBus().on('config:loaded', () => {
  console.log('Configuration reloaded!');
});
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/adapticai/wundr.git
cd wundr/packages/@wundr/config

# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Type check
pnpm run typecheck
```

---

## License

MIT © [Wundr, by Adaptic.ai](https://wundr.io)

---

## Related Packages

- [@wundr.io/core](../core/README.md) - Core utilities and event system
- [@wundr.io/security](../security/README.md) - Security and encryption
- [@wundr.io/cli](../cli/README.md) - Command-line interface

---

**Part of the [@wundr.io](https://wundr.io) ecosystem** - Building excellence, systematically.
