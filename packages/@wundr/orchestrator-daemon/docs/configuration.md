# Orchestrator Daemon Configuration Guide

## Overview

The orchestrator-daemon uses a comprehensive configuration system that loads settings from environment variables with support for `.env` files, validation, and sensible defaults.

## Quick Start

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Set Required Variables

Edit `.env` and set at minimum:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Start the Daemon

```bash
pnpm start
```

## Configuration Files

### `.env.example`
Template file showing all available configuration options with descriptions. Located at the package root.

### `.env`
Your actual configuration file (not committed to git). Copy from `.env.example` and fill in your values.

### `src/config/index.ts`
Configuration loader that:
- Loads environment variables from `.env` file
- Validates all settings using Zod schemas
- Provides typed configuration object
- Gives helpful error messages

## Required Configuration

Only one environment variable is strictly required:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

All other settings have sensible defaults.

## Configuration Categories

### 1. OpenAI API (Required)
```env
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o-mini           # Default: gpt-4o-mini
OPENAI_ORG_ID=                     # Optional
OPENAI_BASE_URL=                   # Optional
```

### 2. Daemon Server
```env
DAEMON_NAME=orchestrator-daemon    # Default: orchestrator-daemon
DAEMON_PORT=8787                   # Default: 8787
DAEMON_HOST=127.0.0.1              # Default: 127.0.0.1
DAEMON_MAX_SESSIONS=100            # Default: 100
DAEMON_VERBOSE=false               # Default: false
```

### 3. Health & Heartbeat
```env
DAEMON_HEARTBEAT_INTERVAL=30000    # Default: 30000 (30s)
DAEMON_HEALTH_CHECK_INTERVAL=60000 # Default: 60000 (1min)
DAEMON_SHUTDOWN_TIMEOUT=10000      # Default: 10000 (10s)
```

### 4. Redis (Optional - for distributed features)
```env
REDIS_URL=redis://localhost:6379   # Required for distributed mode
REDIS_PASSWORD=                    # Optional
REDIS_DB=0                         # Default: 0
REDIS_CONNECT_TIMEOUT=5000         # Default: 5000
```

### 5. Database (Optional - for persistence)
```env
DATABASE_URL=postgresql://...      # Required for persistence
DATABASE_POOL_SIZE=10              # Default: 10
DATABASE_CONNECT_TIMEOUT=5000      # Default: 5000
```

### 6. Distributed Cluster (Optional)
```env
CLUSTER_NAME=orchestrator-cluster  # Default: orchestrator-cluster
LOAD_BALANCING_STRATEGY=least-loaded # Options: round-robin, least-loaded, weighted, hash-based
REBALANCE_INTERVAL=300000          # Default: 300000 (5min)
MIGRATION_TIMEOUT=30000            # Default: 30000 (30s)
```

### 7. Logging
```env
LOG_LEVEL=info                     # Options: debug, info, warn, error
LOG_FORMAT=json                    # Options: json, text
LOG_FILE=                          # Optional log file path
LOG_ROTATION_ENABLED=true          # Default: true
LOG_MAX_SIZE=10                    # Default: 10 MB
LOG_MAX_FILES=5                    # Default: 5 files
```

### 8. Security
```env
DAEMON_JWT_SECRET=...              # Min 32 chars (CHANGE IN PRODUCTION!)
DAEMON_JWT_EXPIRATION=24h          # Default: 24h
DAEMON_CORS_ENABLED=false          # Default: false
DAEMON_CORS_ORIGINS=http://...     # Comma-separated
DAEMON_RATE_LIMIT_ENABLED=true     # Default: true
DAEMON_RATE_LIMIT_MAX=100          # Default: 100
DAEMON_RATE_LIMIT_WINDOW=60000     # Default: 60000 (1min)
```

### 9. Monitoring
```env
METRICS_ENABLED=true               # Default: true
METRICS_PORT=9090                  # Default: 9090
METRICS_PATH=/metrics              # Default: /metrics
HEALTH_CHECK_ENABLED=true          # Default: true
HEALTH_CHECK_PATH=/health          # Default: /health
```

### 10. Memory Management
```env
DAEMON_MAX_HEAP_MB=2048            # Default: 2048
DAEMON_MAX_CONTEXT_TOKENS=128000   # Default: 128000
MEMORY_COMPACTION_ENABLED=true     # Default: true
MEMORY_COMPACTION_THRESHOLD=0.8    # Default: 0.8 (80%)
```

### 11. Token Budget
```env
TOKEN_BUDGET_DAILY=1000000         # Default: 1000000
TOKEN_BUDGET_WEEKLY=5000000        # Default: 5000000
TOKEN_BUDGET_MONTHLY=20000000      # Default: 20000000
TOKEN_BUDGET_ALERTS_ENABLED=true   # Default: true
TOKEN_BUDGET_ALERT_THRESHOLD=0.8   # Default: 0.8 (80%)
```

## Usage in Code

### Basic Usage

```typescript
import { getConfig } from '@wundr.io/orchestrator-daemon/config';

const config = getConfig();

console.log(`Starting on ${config.daemon.host}:${config.daemon.port}`);
console.log(`Using model: ${config.openai.model}`);
```

### Early Validation

```typescript
import { validateRequiredEnv } from '@wundr.io/orchestrator-daemon/config';

try {
  validateRequiredEnv();
  console.log('Configuration is valid');
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}
```

### Conditional Features

```typescript
import { getConfig } from '@wundr.io/orchestrator-daemon/config';

const config = getConfig();

if (config.redis) {
  // Initialize Redis for distributed mode
  console.log('Distributed mode enabled');
}

if (config.database) {
  // Initialize database for persistence
  console.log('Persistence enabled');
}
```

### Testing

```typescript
import { resetConfig, getConfig } from '@wundr.io/orchestrator-daemon/config';

beforeEach(() => {
  resetConfig();
  process.env.OPENAI_API_KEY = 'test-key';
});

it('should load test config', () => {
  const config = getConfig();
  expect(config.openai.apiKey).toBe('test-key');
});
```

## Deployment Modes

### Standalone (Minimal)
```env
OPENAI_API_KEY=sk-...
DAEMON_PORT=8787
```

### Distributed (Multi-node)
```env
OPENAI_API_KEY=sk-...
DAEMON_PORT=8787
REDIS_URL=redis://redis-cluster:6379
CLUSTER_NAME=my-cluster
LOAD_BALANCING_STRATEGY=least-loaded
```

### Production (Full)
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
DAEMON_JWT_SECRET=secure-32-character-secret-here
```

## Validation Errors

The configuration system provides clear error messages:

### Missing Required Variable
```
Configuration validation failed:
  - openai.apiKey: OPENAI_API_KEY is required

Please check your environment variables or .env file.
See .env.example for all available configuration options.
```

### Invalid Port
```
Configuration validation failed:
  - daemon.port: Number must be greater than or equal to 1024
```

### Weak JWT Secret
```
Configuration validation failed:
  - security.jwtSecret: JWT secret must be at least 32 characters
```

## Security Best Practices

1. **Never commit `.env` files** - They contain secrets
2. **Use strong JWT secrets** - Minimum 32 characters, random
3. **Change defaults in production** - Especially JWT secret
4. **Use secrets managers** - AWS Secrets Manager, HashiCorp Vault, etc.
5. **Restrict CORS origins** - Only allow necessary origins
6. **Enable rate limiting** - Protect against abuse

## Environment Variable Precedence

1. Process environment variables (highest priority)
2. `.env` file in package root
3. Default values (lowest priority)

## Type Safety

All configuration is fully typed with TypeScript:

```typescript
const config = getConfig();

// TypeScript knows these types:
config.daemon.port;                    // number
config.openai.apiKey;                  // string
config.redis?.url;                     // string | undefined
config.monitoring.metrics.enabled;     // boolean
config.security.cors.origins;          // string[]
```

## Examples

See `examples/config-usage.ts` for comprehensive usage examples including:
- Basic configuration loading
- Early validation
- Conditional feature usage
- Security configuration
- Memory and budget settings
- Daemon initialization
- Testing patterns

## Troubleshooting

### dotenv not installed
The config loader will work without dotenv - it will just use environment variables directly.

To use `.env` files, ensure dotenv is installed:
```bash
pnpm add dotenv
```

### Configuration not loading
Check that:
1. `.env` file exists in package root
2. Environment variables are set correctly
3. No syntax errors in `.env` file
4. Required variables are present

### Type errors
Ensure you're importing from the correct path:
```typescript
import { getConfig } from '@wundr.io/orchestrator-daemon/config';
```

## Further Reading

- [Configuration README](../src/config/README.md) - Detailed API documentation
- [.env.example](../.env.example) - All available configuration options
- [Usage Examples](../examples/config-usage.ts) - Code examples
