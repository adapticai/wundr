# @wundr.io/hydra-config

Hydra-style hierarchical configuration composition with YAML support, variable interpolation, and Zod validation for TypeScript applications.

## Overview

This package provides a configuration management system inspired by Facebook's [Hydra framework](https://hydra.cc/), enabling:

- **Hierarchical configuration composition** from multiple YAML sources
- **Configuration groups and variants** for organizing related settings
- **Variable interpolation** with `${...}` references
- **CLI argument overrides** for runtime configuration changes
- **Environment variable resolution** with configurable prefixes
- **Deep merging** with customizable merge strategies
- **Zod schema validation** for type-safe configurations
- **Sweep/hyperparameter configurations** for ML workflows

## Installation

```bash
npm install @wundr.io/hydra-config
```

## Quick Start

```typescript
import { composeConfig, ConfigComposer, createComposer } from '@wundr.io/hydra-config';

// Simple usage - compose configuration from a Hydra config file
const result = composeConfig('./config/hydra.yaml', ['db=mysql', 'debug=true']);
console.log(result.config);

// Advanced usage with composer instance
const composer = createComposer({
  basePath: './config',
  strictInterpolation: true,
});

const hydraConfig = composer.loadHydraConfig('./hydra.yaml');
const composed = composer.compose(hydraConfig, process.argv.slice(2));
```

## Core Types

### ConfigValue

Represents valid configuration values including primitives, arrays, and nested objects:

```typescript
type ConfigPrimitive = string | number | boolean | null;

type ConfigValue =
  | ConfigPrimitive
  | ConfigValue[]
  | { [key: string]: ConfigValue };
```

### SweepValue

Valid sweep/hyperparameter value types (primitives only):

```typescript
type SweepValue = string | number | boolean | null;
```

### ConfigGroup

Represents a group of related configuration options:

```typescript
interface ConfigGroup {
  name: string;                           // Unique identifier
  description?: string;                   // Purpose of the group
  path: string;                           // Path to YAML file
  optional?: boolean;                     // Whether group is required
  values: Record<string, ConfigValue>;    // Configuration values
}
```

### HydraConfig

Main Hydra configuration structure:

```typescript
interface HydraConfig {
  configPath: string;                      // Base config directory
  defaults: ConfigDefaults[];              // Default values
  groups: Record<string, ConfigGroup>;     // Available groups
  overrides?: Record<string, ConfigValue>; // CLI overrides
  envPrefix?: string;                      // Environment variable prefix
  strictMode?: boolean;                    // Strict interpolation mode
}
```

### ComposedConfig

The final composed configuration after merging and interpolation:

```typescript
interface ComposedConfig<T = Record<string, unknown>> {
  config: T;                               // Final merged configuration
  sources: ConfigSource[];                 // Contributing sources
  warnings: string[];                      // Composition warnings
  resolvedInterpolations: Map<string, unknown>; // Resolved variables
}
```

## Configuration Composition

### Directory Structure

```
config/
  hydra.yaml           # Main Hydra configuration
  base.yaml            # Base defaults
  db/
    mysql.yaml         # MySQL configuration variant
    postgres.yaml      # PostgreSQL configuration variant
  server/
    development.yaml   # Development server settings
    production.yaml    # Production server settings
```

### Hydra Configuration File (hydra.yaml)

```yaml
configPath: ./config
envPrefix: APP_

defaults:
  - path: base.yaml
  - group: db
    variant: mysql
  - group: server
    variant: development
    optional: true

groups:
  db:
    name: database
    description: Database configuration
    path: db/mysql.yaml
    values: {}
  server:
    name: server
    description: Server configuration
    path: server/development.yaml
    optional: true
    values: {}
```

### Base Configuration (base.yaml)

```yaml
app:
  name: my-application
  version: 1.0.0

logging:
  level: info
  format: json
```

### Group Variant (db/mysql.yaml)

```yaml
database:
  driver: mysql
  host: localhost
  port: 3306
  name: ${app.name}_db
  pool:
    min: 2
    max: 10
```

## Configuration Overrides

### Priority Order

Configuration sources are applied in the following order (later sources override earlier):

1. **Defaults** - Base configuration files
2. **Groups** - Configuration group files
3. **Hydra overrides** - Overrides in `hydra.yaml`
4. **Environment variables** - `${envPrefix}KEY_NAME`
5. **CLI arguments** - Runtime overrides

### CLI Override Syntax

```bash
# Simple key=value
node app.js database.host=production-db database.port=5432

# Group selection (db/postgres)
node app.js db/postgres server/production

# Nested values (dot notation)
node app.js database.pool.max=20

# Boolean and null values
node app.js debug=true cache=null

# Quoted strings
node app.js app.name="My App" message='Hello World'
```

### Programmatic Overrides

```typescript
const composer = createComposer({ basePath: './config' });
const hydraConfig = composer.loadHydraConfig('./hydra.yaml');

// Override at composition time
const result = composer.compose(hydraConfig, [
  'database.host=prod-server',
  'database.port=5432',
  'logging.level=debug',
]);
```

## Environment Variables

Environment variables are resolved using the configured prefix (default: `HYDRA_`):

```bash
# Set environment variables
export APP_DATABASE_HOST=prod-server
export APP_DATABASE_PORT=5432
export APP_LOGGING_LEVEL=debug
```

```yaml
# hydra.yaml
envPrefix: APP_
```

Variable names are converted: `APP_DATABASE_HOST` becomes `database.host`.

### Environment Variable Reference in YAML

```yaml
database:
  host: ${env:DATABASE_HOST}
  port: ${env:DATABASE_PORT:3306}  # With default value
  password: ${env:DATABASE_PASSWORD}
```

## Variable Interpolation

### Basic Interpolation

Reference other configuration values using `${path.to.value}`:

```yaml
app:
  name: my-app
  version: 1.0.0

database:
  name: ${app.name}_db         # Resolves to: my-app_db
  tag: ${app.name}-${app.version}  # Resolves to: my-app-1.0.0
```

### Environment Variables

```yaml
server:
  host: ${env:SERVER_HOST}
  port: ${env:SERVER_PORT:8080}    # With default value
  secret: ${env:API_SECRET}
```

### Custom Resolvers

```typescript
const composer = createComposer({
  basePath: './config',
  customResolvers: {
    file: (key, context) => {
      return fs.readFileSync(key, 'utf-8').trim();
    },
    timestamp: () => new Date().toISOString(),
    random: (key) => {
      const max = parseInt(key, 10) || 100;
      return Math.floor(Math.random() * max);
    },
  },
});
```

```yaml
# Usage in config
secrets:
  apiKey: ${file:/etc/secrets/api-key}

metadata:
  createdAt: ${timestamp:}
  requestId: ${random:1000000}
```

### Interpolation Options

```typescript
interface InterpolationOptions {
  strict?: boolean;           // Throw on unresolved references
  maxDepth?: number;          // Maximum recursion depth (default: 10)
  resolvers?: Record<string, InterpolationResolver>;
  env?: Record<string, string | undefined>;
}
```

### Interpolation Utilities

```typescript
import {
  resolveInterpolations,
  hasInterpolations,
  extractInterpolations,
} from '@wundr.io/hydra-config';

// Check if string contains interpolations
hasInterpolations('${app.name}_db');  // true

// Extract all interpolation references
extractInterpolations('${app.name}_${app.version}');
// Returns: ['app.name', 'app.version']

// Resolve interpolations in a config object
const resolved = resolveInterpolations(
  { name: '${base.name}' },
  { base: { name: 'MyApp' } },
  { strict: true }
);
```

## Sweep/Hyperparameter Configurations

For machine learning workflows, the package supports parameter sweeps:

### CLI Sweep Syntax

```bash
# Grid sweep over learning rates
node train.js learning_rate=[0.1,0.01,0.001]

# Multiple sweeps
node train.js learning_rate=[0.1,0.01] batch_size=[32,64,128]
```

### SweepConfig Structure

```typescript
interface SweepConfig {
  key: string;              // Parameter key to sweep
  values: SweepValue[];     // Values to sweep over
  type: 'grid' | 'random';  // Sweep type
}
```

### Parsing Sweeps

```typescript
const composer = createComposer({ basePath: './config' });

const parsed = composer.parseCliOverrides([
  'learning_rate=[0.1,0.01,0.001]',
  'batch_size=[32,64]',
  'epochs=100',
]);

console.log(parsed.sweeps);
// [
//   { key: 'learning_rate', values: [0.1, 0.01, 0.001], type: 'grid' },
//   { key: 'batch_size', values: [32, 64], type: 'grid' }
// ]

console.log(parsed.overrides);
// { epochs: 100 }
```

## Defaults Management

### DefaultsManager

Handles default configuration values with deep merging:

```typescript
import { DefaultsManager, mergeDefaults, defaultsManager } from '@wundr.io/hydra-config';

// Create with custom options
const manager = new DefaultsManager({
  deepMerge: true,
  preserveUndefined: false,
  mergeStrategies: {
    plugins: 'append',      // Append arrays
    overrides: 'replace',   // Replace entirely
  },
});

// Merge multiple configs
const merged = manager.mergeConfigs([
  { app: { name: 'base' }, plugins: ['a'] },
  { app: { version: '1.0' }, plugins: ['b'] },
]);
// Result: { app: { name: 'base', version: '1.0' }, plugins: ['a', 'b'] }
```

### Merge Strategies

| Strategy  | Behavior |
|-----------|----------|
| `replace` | Completely replace the target value |
| `merge`   | Deep merge objects (default for objects) |
| `append`  | Append arrays (for array values) |
| `prepend` | Prepend arrays (for array values) |

### Schema-Based Defaults

```typescript
import { z } from 'zod';
import { DefaultsManager } from '@wundr.io/hydra-config';

const AppConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  debug: z.boolean().default(false),
});

const manager = new DefaultsManager();
const defaults = manager.createFromSchema(AppConfigSchema);
// { port: 3000, host: 'localhost', debug: false }
```

## Configuration Loader

### ConfigLoader

Handles reading and parsing YAML configuration files:

```typescript
import { ConfigLoader, loadConfig, configExists, writeConfig } from '@wundr.io/hydra-config';

// Create loader with options
const loader = new ConfigLoader({
  basePath: './config',
  encoding: 'utf-8',
  throwOnMissing: true,
  includeMetadata: true,
});

// Load a single file
const result = loader.load('database.yaml');
console.log(result.data);
console.log(result.path);       // Absolute path
console.log(result.exists);     // true
console.log(result.metadata);   // { size, modifiedTime, createdTime }

// Load optional file
const optional = loader.load('optional.yaml', true);

// Load entire directory
const configs = loader.loadDirectory('./config/environments');
// Returns Map<string, LoadResult>

// Convenience functions
const config = loadConfig('app.yaml', { basePath: './config' });
const exists = configExists('app.yaml', './config');
writeConfig('output.yaml', { key: 'value' }, './config');
```

### LoaderOptions

```typescript
interface LoaderOptions {
  basePath?: string;           // Base directory for relative paths
  encoding?: BufferEncoding;   // File encoding (default: utf-8)
  throwOnMissing?: boolean;    // Throw on missing files
  schema?: z.ZodType<unknown>; // Validation schema
  includeMetadata?: boolean;   // Include file metadata
}
```

## Schema Validation

Validate composed configuration using Zod schemas:

```typescript
import { z } from 'zod';
import { createComposer, HydraConfigError, HydraErrorCode } from '@wundr.io/hydra-config';

const AppConfigSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    name: z.string(),
  }),
  server: z.object({
    port: z.number().default(3000),
    cors: z.boolean().default(true),
  }),
});

type AppConfig = z.infer<typeof AppConfigSchema>;

const composer = createComposer({ basePath: './config' });
const hydraConfig = composer.loadHydraConfig('./hydra.yaml');
const result = composer.compose(hydraConfig);

try {
  const validConfig = composer.validate<AppConfig>(result.config, AppConfigSchema);
  console.log('Valid config:', validConfig);
} catch (error) {
  if (error instanceof HydraConfigError && error.code === HydraErrorCode.VALIDATION_ERROR) {
    console.error('Validation errors:', error.details?.errors);
  }
}
```

## Error Handling

### HydraConfigError

Custom error class with error codes and details:

```typescript
import { HydraConfigError, HydraErrorCode } from '@wundr.io/hydra-config';

try {
  const config = loadConfig('missing.yaml');
} catch (error) {
  if (error instanceof HydraConfigError) {
    console.error('Code:', error.code);         // 'FILE_NOT_FOUND'
    console.error('Message:', error.message);   // 'Configuration file not found: ...'
    console.error('Details:', error.details);   // { path: '...' }
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `FILE_NOT_FOUND` | Configuration file does not exist |
| `PARSE_ERROR` | YAML parsing failed |
| `INTERPOLATION_ERROR` | Variable interpolation failed |
| `VALIDATION_ERROR` | Schema validation failed |
| `CIRCULAR_REFERENCE` | Circular interpolation detected |
| `MISSING_GROUP` | Referenced configuration group not found |
| `INVALID_OVERRIDE` | Invalid CLI override syntax |

## Type Guards

Runtime type checking utilities:

```typescript
import { isConfigGroup, isHydraConfig } from '@wundr.io/hydra-config';

// Check if value is a ConfigGroup
if (isConfigGroup(someValue)) {
  console.log(someValue.name, someValue.path);
}

// Check if value is a HydraConfig
if (isHydraConfig(someValue)) {
  console.log(someValue.configPath, someValue.defaults);
}
```

## Integration Patterns

### Express.js Integration

```typescript
import express from 'express';
import { composeConfig } from '@wundr.io/hydra-config';
import { z } from 'zod';

const ConfigSchema = z.object({
  server: z.object({
    port: z.number(),
    host: z.string(),
  }),
  database: z.object({
    url: z.string(),
  }),
});

const { config } = composeConfig<z.infer<typeof ConfigSchema>>(
  './config/hydra.yaml',
  process.argv.slice(2)
);

const app = express();
app.listen(config.server.port, config.server.host, () => {
  console.log(`Server running on ${config.server.host}:${config.server.port}`);
});
```

### ML Training Pipeline

```typescript
import { createComposer } from '@wundr.io/hydra-config';

const composer = createComposer({ basePath: './experiments' });
const hydraConfig = composer.loadHydraConfig('./hydra.yaml');
const parsed = composer.parseCliOverrides(process.argv.slice(2));

// Handle parameter sweeps
if (parsed.sweeps.length > 0) {
  // Generate all sweep combinations
  for (const sweep of parsed.sweeps) {
    for (const value of sweep.values) {
      const args = [`${sweep.key}=${value}`];
      const result = composer.compose(hydraConfig, args);
      await trainModel(result.config);
    }
  }
} else {
  const result = composer.compose(hydraConfig, process.argv.slice(2));
  await trainModel(result.config);
}
```

### Multi-Environment Configuration

```typescript
import { createComposer } from '@wundr.io/hydra-config';

const env = process.env.NODE_ENV || 'development';

const composer = createComposer({
  basePath: './config',
  envPrefix: 'APP_',
});

const hydraConfig = composer.loadHydraConfig('./hydra.yaml');

// Select environment-specific configuration
const result = composer.compose(hydraConfig, [
  `environment/${env}`,
  ...process.argv.slice(2),
]);

export default result.config;
```

## API Reference

### Main Exports

| Export | Description |
|--------|-------------|
| `ConfigComposer` | Main composer class |
| `createComposer` | Factory function for ConfigComposer |
| `composeConfig` | Convenience function for quick composition |
| `ConfigLoader` | YAML file loader |
| `loadConfig` | Load single YAML file |
| `configExists` | Check if config file exists |
| `writeConfig` | Write configuration to YAML |
| `DefaultsManager` | Defaults handling and merging |
| `mergeDefaults` | Merge multiple configs |
| `InterpolationResolver` | Variable interpolation |
| `resolveInterpolations` | Resolve interpolations in config |
| `hasInterpolations` | Check for interpolation patterns |
| `extractInterpolations` | Extract interpolation references |

### Type Exports

| Type | Description |
|------|-------------|
| `ConfigValue` | Valid configuration values |
| `SweepValue` | Valid sweep parameter values |
| `ConfigGroup` | Configuration group structure |
| `HydraConfig` | Main Hydra configuration |
| `ComposedConfig` | Composition result |
| `ConfigDefaults` | Default entry structure |
| `ConfigSource` | Source tracking |
| `ComposerOptions` | Composer configuration |
| `LoaderOptions` | Loader configuration |
| `InterpolationOptions` | Interpolation settings |
| `InterpolationResult` | Interpolation result |
| `DefaultsOptions` | Defaults manager options |
| `MergeStrategy` | Merge strategy types |
| `SweepConfig` | Sweep configuration |
| `ParsedOverrides` | Parsed CLI overrides |

### Zod Schemas

| Schema | Description |
|--------|-------------|
| `ConfigValueSchema` | Validates ConfigValue |
| `ConfigGroupSchema` | Validates ConfigGroup |
| `HydraConfigSchema` | Validates HydraConfig |
| `ConfigDefaultsSchema` | Validates ConfigDefaults |
| `ComposerOptionsSchema` | Validates ComposerOptions |

## License

MIT
