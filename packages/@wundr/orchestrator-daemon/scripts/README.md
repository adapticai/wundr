# Orchestrator Daemon Startup Scripts

This directory contains startup and utility scripts for the orchestrator-daemon.

## Scripts Overview

### 1. start.sh - Production Startup

Main production startup script with comprehensive checks and graceful shutdown.

**Features:**

- Validates Node.js version (requires 18+)
- Checks for required environment variables (OPENAI_API_KEY)
- Verifies Redis availability (warns if not available)
- Builds TypeScript if needed
- Handles graceful shutdown on SIGTERM/SIGINT
- Provides colored console output for status

**Usage:**

```bash
./scripts/start.sh
# or via npm
npm start
```

**Environment Variables:**

- `OPENAI_API_KEY` (required) - OpenAI API key for AI features
- `PORT` (optional, default: 3000) - Port to run daemon on
- `LOG_LEVEL` (optional, default: info) - Logging level
- `REDIS_ENABLED` (optional, default: true) - Enable Redis session persistence

### 2. start-dev.sh - Development Startup

Development mode with hot reload and verbose logging.

**Features:**

- Uses ts-node for direct TypeScript execution
- Enables debug logging
- Hot reload on file changes
- Development environment variables
- No build step required

**Usage:**

```bash
./scripts/start-dev.sh
# or via npm
npm run start:dev
```

**Environment Variables:**

- `OPENAI_API_KEY` (required)
- `PORT` (optional, default: 3000)
- `LOG_LEVEL` (optional, default: debug)
- `NODE_ENV` (optional, default: development)

### 3. start-docker.sh - Docker Startup

Optimized startup script for Docker containers.

**Features:**

- Waits for dependencies (Redis, PostgreSQL) to be ready
- Runs database migrations if configured
- Handles container shutdown signals
- Service health checks before startup
- Configurable retry logic

**Usage:**

```bash
./scripts/start-docker.sh
# or via npm
npm run start:docker
```

**Environment Variables:**

- `OPENAI_API_KEY` (required)
- `REDIS_HOST` (optional, default: redis)
- `REDIS_PORT` (optional, default: 6379)
- `POSTGRES_HOST` (optional) - If set, waits for PostgreSQL
- `POSTGRES_PORT` (optional, default: 5432)
- `PORT` (optional, default: 3000)

### 4. health-check.sh - Health Check

Performs health checks on running daemon instance.

**Features:**

- Configurable retry logic
- Timeout support
- Proper exit codes for container orchestration
- Verbose mode for debugging

**Usage:**

```bash
./scripts/health-check.sh
# or via npm
npm run health-check
```

**Environment Variables:**

- `HOST` (optional, default: localhost)
- `PORT` (optional, default: 3000)
- `TIMEOUT` (optional, default: 5) - Request timeout in seconds
- `MAX_RETRIES` (optional, default: 3) - Number of retry attempts
- `VERBOSE` (optional) - Show full response

**Exit Codes:**

- `0` - Health check passed
- `1` - Health check failed

## Docker Integration

### Using with Docker Compose

```yaml
version: '3.8'
services:
  daemon:
    build: .
    ports:
      - '3000:3000'
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_ENABLED=true
      - REDIS_HOST=redis
    command: ./scripts/start-docker.sh
    healthcheck:
      test: ['CMD', './scripts/health-check.sh']
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
```

### Docker Commands (via npm)

```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View daemon logs
npm run docker:logs
```

## Common Scenarios

### Local Development

```bash
# 1. Set environment variables
export OPENAI_API_KEY="your-key-here"

# 2. Start in dev mode with hot reload
npm run start:dev
```

### Production Deployment

```bash
# 1. Build the project
npm run build

# 2. Set environment variables
export OPENAI_API_KEY="your-key-here"
export PORT=3000
export LOG_LEVEL=info

# 3. Start the daemon
npm start
```

### Docker Deployment

```bash
# 1. Create .env file
cat > .env << EOF
OPENAI_API_KEY=your-key-here
PORT=3000
REDIS_ENABLED=true
EOF

# 2. Start with Docker Compose
npm run docker:up

# 3. Check health
npm run health-check

# 4. View logs
npm run docker:logs
```

### Health Monitoring

```bash
# Basic health check
npm run health-check

# Verbose health check
VERBOSE=1 npm run health-check

# Custom endpoint
HOST=myserver.com PORT=8080 npm run health-check
```

## Troubleshooting

### Script Permission Issues

```bash
# If scripts are not executable
chmod +x scripts/*.sh
```

### Node Version Issues

```bash
# Check Node version
node -v

# Should be 18.0.0 or higher
# Update via nvm:
nvm install 18
nvm use 18
```

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Start Redis (macOS)
brew services start redis

# Start Redis (Linux)
sudo systemctl start redis

# Or disable Redis in daemon
export REDIS_ENABLED=false
```

### Build Issues

```bash
# Clean and rebuild
npm run clean
npm run build
```

### Health Check Failures

```bash
# Check if daemon is running
ps aux | grep orchestrator-daemon

# Check logs
npm run docker:logs

# Test endpoint manually
curl http://localhost:3000/health
```

## Script Architecture

All scripts follow these principles:

1. **Fail Fast**: Exit immediately on errors with clear messages
2. **Colored Output**: Use consistent color coding (green=success, yellow=warning, red=error)
3. **Graceful Shutdown**: Handle SIGTERM/SIGINT properly
4. **Dependency Checks**: Validate all requirements before starting
5. **Environment Safety**: Never hardcode sensitive values
6. **Container Ready**: Work seamlessly in Docker environments

## Exit Codes

All scripts use standard exit codes:

- `0` - Success
- `1` - General error (missing dependencies, startup failure, etc.)

---

## Testing Scripts

### 5. test-e2e.ts - End-to-End Integration Test

Comprehensive E2E test that verifies the complete daemon workflow including real LLM calls.

**Features:**

- Starts daemon programmatically
- Tests WebSocket connection and all message types
- Executes real LLM calls via OpenAI API
- Validates responses and state transitions
- Color-coded test output with pass/fail summary
- Timeout handling and proper cleanup

**Requirements:**

- `OPENAI_API_KEY` environment variable must be set
- OpenAI API key must have available credits

**Usage:**

```bash
npm run test:e2e
# or directly
npx tsx scripts/test-e2e.ts
```

**Test Steps:**

1. Start Daemon - Initializes orchestrator daemon
2. WebSocket Connection - Establishes connection
3. Health Check - Verifies daemon responsiveness
4. Daemon Status - Validates metrics and state
5. Spawn Session - Creates execution session
6. Execute Task - Runs real LLM call to OpenAI
7. Stop Session - Gracefully terminates session

**Exit Codes:**

- `0` - All tests passed
- `1` - One or more tests failed
- `130` - Interrupted by user (Ctrl+C)

**Typical Execution Time:** 7-17 seconds (varies by LLM response time)

### 6. test-websocket.ts - Interactive WebSocket Client

Interactive command-line client for manual testing and debugging of the daemon.

**Features:**

- Interactive CLI with command history
- Pretty-printed JSON responses
- Color-coded output
- Session tracking
- Real-time streaming display
- Custom message support

**Usage:**

```bash
npm run test:ws
# or directly
npx tsx scripts/test-websocket.ts

# Connect to custom host/port
npx tsx scripts/test-websocket.ts --host 127.0.0.1 --port 8787
```

**Available Commands:**

| Command         | Description                     |
| --------------- | ------------------------------- |
| `help`          | Show available commands         |
| `ping`          | Send ping message               |
| `health`        | Request health check            |
| `status`        | Request daemon status           |
| `spawn`         | Spawn a test session            |
| `execute`       | Execute task in current session |
| `stop`          | Stop current session            |
| `session <id>`  | Get status of specific session  |
| `custom <json>` | Send custom JSON message        |
| `clear`         | Clear screen                    |
| `exit`, `quit`  | Exit the client                 |

**Example Session:**

```
ws> health
✓ Health check passed

ws> spawn
✓ Session spawned: session_1234567890

ws> execute
ℹ Stream started
Hello! This is a test response...
ℹ Stream ended

ws> stop
✓ Session terminated

ws> exit
```

---

## Testing Workflows

### Running E2E Tests

```bash
# 1. Set OpenAI API key
export OPENAI_API_KEY="sk-..."

# 2. Run the E2E test suite
npm run test:e2e

# Expected output:
# ✓ All tests passed (7/7)
# Total execution time: 12.34s
```

### Manual Testing with WebSocket Client

```bash
# 1. Start the daemon in one terminal
npm run start:dev

# 2. Open WebSocket client in another terminal
npm run test:ws

# 3. Interact with daemon
ws> spawn
ws> execute
ws> stop
```

### Testing Custom Messages

```bash
# Using the WebSocket client
ws> custom {"type":"daemon_status"}
ws> custom {"type":"spawn_session","payload":{...}}
```

---

## Troubleshooting Tests

### E2E Test Issues

**Problem: "OPENAI_API_KEY environment variable not set"**

```bash
export OPENAI_API_KEY="your-api-key-here"
npm run test:e2e
```

**Problem: Test timeout**

- Check network connectivity to OpenAI API
- Verify API key has available credits
- Check OpenAI service status
- Increase timeout in test-e2e.ts if needed

**Problem: LLM call fails**

```bash
# Verify API key is valid
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### WebSocket Client Issues

**Problem: "Failed to connect"**

```bash
# Make sure daemon is running
npm run start:dev

# Check daemon health
curl http://127.0.0.1:8787/health
```

**Problem: Connection refused**

- Verify daemon is running on expected port (default: 8787)
- Check firewall settings
- Use `--port` flag to specify correct port

---

## Additional Resources

- [Orchestrator Daemon Documentation](../README.md)
- [Docker Documentation](https://docs.docker.com/)
- [Redis Documentation](https://redis.io/documentation)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
