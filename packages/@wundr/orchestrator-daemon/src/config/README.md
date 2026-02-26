# Orchestrator Daemon Configuration

This directory contains the configuration loading and validation system for the orchestrator-daemon.

## Overview

The configuration system provides:

- Environment variable loading from `.env` files
- Type-safe configuration with Zod validation
- Helpful error messages for missing or invalid configuration
- Sensible defaults for all optional settings
- Support for multiple deployment modes (standalone, distributed, etc.)

## Quick Start

### 1. Create `.env` file

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### 2. Set Required Variables

At minimum, you need to set:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Use in Your Code

```typescript
import { getConfig } from './config';

const config = getConfig();

// Access typed configuration
console.log(config.daemon.port); // 8787
console.log(config.openai.apiKey); // sk-...
```

## Configuration Structure

### Required Configuration

#### OpenAI API

```typescript
{
  openai: {
    apiKey: string;      // OPENAI_API_KEY (required)
    model: string;       // OPENAI_MODEL (default: gpt-4o-mini)
    organization?: string; // OPENAI_ORG_ID (optional)
    baseUrl?: string;    // OPENAI_BASE_URL (optional)
  }
}
```

### Core Configuration

#### Daemon Settings

```typescript
{
  daemon: {
    name: string; // DAEMON_NAME (default: orchestrator-daemon)
    port: number; // DAEMON_PORT (default: 8787)
    host: string; // DAEMON_HOST (default: 127.0.0.1)
    maxSessions: number; // DAEMON_MAX_SESSIONS (default: 100)
    verbose: boolean; // DAEMON_VERBOSE (default: false)
  }
}
```

#### Health Configuration

```typescript
{
  health: {
    heartbeatInterval: number; // DAEMON_HEARTBEAT_INTERVAL (default: 30000)
    healthCheckInterval: number; // DAEMON_HEALTH_CHECK_INTERVAL (default: 60000)
    shutdownTimeout: number; // DAEMON_SHUTDOWN_TIMEOUT (default: 10000)
  }
}
```

### Optional Configuration

#### Redis (for distributed features)

```typescript
{
  redis?: {
    url: string;           // REDIS_URL
    password?: string;     // REDIS_PASSWORD
    db: number;           // REDIS_DB (default: 0)
    connectTimeout: number; // REDIS_CONNECT_TIMEOUT (default: 5000)
  }
}
```

#### Database (for persistence)

```typescript
{
  database?: {
    url: string;           // DATABASE_URL
    poolSize: number;      // DATABASE_POOL_SIZE (default: 10)
    connectTimeout: number; // DATABASE_CONNECT_TIMEOUT (default: 5000)
  }
}
```

#### Distributed Features

```typescript
{
  distributed?: {
    clusterName: string;  // CLUSTER_NAME (default: orchestrator-cluster)
    loadBalancingStrategy: 'round-robin' | 'least-loaded' | 'weighted' | 'hash-based';
    rebalanceInterval: number;  // REBALANCE_INTERVAL (default: 300000)
    migrationTimeout: number;   // MIGRATION_TIMEOUT (default: 30000)
  }
}
```

#### Security

```typescript
{
  security: {
    jwtSecret: string;     // DAEMON_JWT_SECRET (min 32 chars)
    jwtExpiration: string; // DAEMON_JWT_EXPIRATION (default: 24h)
    cors: {
      enabled: boolean;    // DAEMON_CORS_ENABLED (default: false)
      origins: string[];   // DAEMON_CORS_ORIGINS (comma-separated)
    },
    rateLimit: {
      enabled: boolean;    // DAEMON_RATE_LIMIT_ENABLED (default: true)
      max: number;        // DAEMON_RATE_LIMIT_MAX (default: 100)
      windowMs: number;   // DAEMON_RATE_LIMIT_WINDOW (default: 60000)
    }
  }
}
```

#### Monitoring

```typescript
{
  monitoring: {
    metrics: {
      enabled: boolean;  // METRICS_ENABLED (default: true)
      port: number;     // METRICS_PORT (default: 9090)
      path: string;     // METRICS_PATH (default: /metrics)
    },
    healthCheck: {
      enabled: boolean; // HEALTH_CHECK_ENABLED (default: true)
      path: string;    // HEALTH_CHECK_PATH (default: /health)
    }
  }
}
```

## API Reference

### `loadConfig(): Config`

Loads configuration from environment variables and validates it.

```typescript
import { loadConfig } from './config';

try {
  const config = loadConfig();
  console.log('Configuration loaded successfully');
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}
```

### `getConfig(): Config`

Gets a singleton configuration instance. Lazy-loaded on first access.

```typescript
import { getConfig } from './config';

const config = getConfig();
// Subsequent calls return the same instance
const sameConfig = getConfig();
```

### `validateRequiredEnv(): void`

Validates only required environment variables without loading full config. Useful for early
validation before application startup.

```typescript
import { validateRequiredEnv } from './config';

try {
  validateRequiredEnv();
  console.log('Required environment variables are set');
} catch (error) {
  console.error('Missing required environment variables:', error.message);
  process.exit(1);
}
```

### `resetConfig(): void`

Resets the configuration singleton. Useful for testing.

```typescript
import { resetConfig, getConfig } from './config';

// In tests
beforeEach(() => {
  resetConfig();
  process.env.OPENAI_API_KEY = 'test-key';
});
```

## Environment Files

### Development

Create a `.env` file in the package root:

```bash
# .env
OPENAI_API_KEY=sk-dev-key
DAEMON_VERBOSE=true
LOG_LEVEL=debug
```

### Production

Use environment variables directly or a secure secrets manager:

```bash
export OPENAI_API_KEY="sk-prod-key"
export DAEMON_PORT=8787
export REDIS_URL="redis://prod-redis:6379"
export DATABASE_URL="postgresql://user:pass@prod-db:5432/orchestrator"
```

### Testing

Set minimal configuration for tests:

```typescript
// test setup
process.env.OPENAI_API_KEY = 'test-key';
process.env.NODE_ENV = 'test';
```

## Validation

The configuration system uses Zod for validation:

### Validation Errors

If validation fails, you'll get detailed error messages:

```
Configuration validation failed:
  - openai.apiKey: OPENAI_API_KEY is required
  - security.jwtSecret: JWT secret must be at least 32 characters
  - daemon.port: Number must be greater than or equal to 1024

Please check your environment variables or .env file.
See .env.example for all available configuration options.
```

### Type Safety

All configuration is fully typed:

```typescript
const config = getConfig();

// TypeScript knows the exact types
config.daemon.port; // number
config.openai.apiKey; // string
config.redis?.url; // string | undefined
config.monitoring.metrics.enabled; // boolean
```

## Deployment Modes

### Standalone Mode

Minimal configuration for single-node deployment:

```env
OPENAI_API_KEY=sk-...
DAEMON_PORT=8787
```

### Distributed Mode

Configuration for multi-node cluster:

```env
OPENAI_API_KEY=sk-...
DAEMON_PORT=8787
REDIS_URL=redis://redis-cluster:6379
CLUSTER_NAME=my-cluster
LOAD_BALANCING_STRATEGY=least-loaded
```

### Production Mode

Full configuration with persistence and monitoring:

```env
NODE_ENV=production
OPENAI_API_KEY=sk-...
DAEMON_PORT=8787
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://user:pass@db:5432/orchestrator
METRICS_ENABLED=true
METRICS_PORT=9090
LOG_LEVEL=info
LOG_FORMAT=json
DAEMON_JWT_SECRET=your-production-secret-at-least-32-characters-long
```

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use strong JWT secrets** - Minimum 32 characters, random
3. **Change defaults in production** - Especially JWT secret
4. **Use secrets managers** - For production deployments (AWS Secrets Manager, HashiCorp Vault,
   etc.)
5. **Restrict CORS origins** - Only allow necessary origins
6. **Enable rate limiting** - Protect against abuse

## Troubleshooting

### Missing API Key

```
Error: Configuration validation failed:
  - openai.apiKey: OPENAI_API_KEY is required
```

**Solution**: Set `OPENAI_API_KEY` in your `.env` file or environment

### Invalid Port Number

```
Error: Configuration validation failed:
  - daemon.port: Number must be greater than or equal to 1024
```

**Solution**: Set `DAEMON_PORT` to a value between 1024 and 65535

### Weak JWT Secret

```
Error: Configuration validation failed:
  - security.jwtSecret: JWT secret must be at least 32 characters
```

**Solution**: Set `DAEMON_JWT_SECRET` to a string with at least 32 characters

### dotenv Not Found

The config loader will work without dotenv - it will just use environment variables directly. To use
`.env` files, install dotenv:

```bash
pnpm add dotenv
```

## Examples

### Basic Usage

```typescript
import { getConfig } from './config';

const config = getConfig();

console.log(`Starting daemon on ${config.daemon.host}:${config.daemon.port}`);
console.log(`Max sessions: ${config.daemon.maxSessions}`);
```

### Conditional Features

```typescript
import { getConfig } from './config';

const config = getConfig();

if (config.redis) {
  console.log('Distributed mode enabled');
  // Initialize Redis connection
}

if (config.database) {
  console.log('Persistence enabled');
  // Initialize database connection
}
```

### Using in OrchestratorDaemon

```typescript
import { getConfig } from './config';
import { OrchestratorDaemon } from './core/orchestrator-daemon';

const config = getConfig();

const daemon = new OrchestratorDaemon({
  name: config.daemon.name,
  port: config.daemon.port,
  host: config.daemon.host,
  maxSessions: config.daemon.maxSessions,
  heartbeatInterval: config.health.heartbeatInterval,
  shutdownTimeout: config.health.shutdownTimeout,
  verbose: config.daemon.verbose,
});

await daemon.start();
```
