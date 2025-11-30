# Wundr E2E Testing Startup Guide

Complete guide for starting all services needed for end-to-end testing of the Wundr monorepo.

## Quick Start

```bash
# Start all services
pnpm run start:all

# Stop all services
pnpm run stop:all
```

## What Gets Started

The `start-all.sh` script starts all required services in the correct order:

### 1. Infrastructure Services

**Redis** (Port 6379)
- Used for caching and session management
- Automatically started via Docker if available
- Falls back to local Redis installation

**PostgreSQL** (Port 5432)
- Database for Neolith application
- Automatically started via Docker if available
- Falls back to local PostgreSQL installation

### 2. Application Services

**Orchestrator Daemon** (Port 8787)
- WebSocket server for agent orchestration
- Session management and coordination
- Health check: `http://localhost:8787/health`

**Neolith Web App** (Port 3000)
- Next.js web application
- Connects to daemon and database
- Accessible at: `http://localhost:3000`

## Prerequisites

### Required

- **Node.js** >= 18.0.0
- **pnpm** (package manager)

### Optional

- **Docker** - For automatic Redis/PostgreSQL setup
- **Redis** - If not using Docker
- **PostgreSQL** - If not using Docker

## Installation

### Install Node.js and pnpm

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
node -v  # Should be >= 18.0.0
pnpm -v
```

### Install Docker (Recommended)

```bash
# macOS
brew install --cask docker

# Or download from https://www.docker.com/products/docker-desktop
```

### Install Redis Locally (Alternative to Docker)

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis

# Verify
redis-cli ping  # Should return PONG
```

### Install PostgreSQL Locally (Alternative to Docker)

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu
sudo apt-get install postgresql-16
sudo systemctl start postgresql

# Create database
createdb neolith
```

## Usage

### Starting Services

```bash
# From repository root
pnpm run start:all
```

This will:
1. Check prerequisites (Node.js, pnpm, Docker)
2. Start Redis and PostgreSQL (via Docker or local)
3. Run database migrations
4. Build all necessary packages
5. Start orchestrator daemon
6. Start Neolith web app
7. Display status and URLs

### Stopping Services

```bash
# Graceful shutdown
pnpm run stop:all

# Or press Ctrl+C in the start-all terminal
```

This will:
1. Stop tracked processes (daemon, web app)
2. Check for processes on known ports
3. Stop Docker containers (if started)
4. Cleanup remaining processes
5. Verify ports are free

### Force Stop

If services don't stop cleanly:

```bash
# Kill processes on specific ports
lsof -ti:8787 -ti:3000 | xargs kill -9

# Stop Docker containers manually
docker stop wundr-redis wundr-postgres
docker rm wundr-redis wundr-postgres
```

## Service URLs

After successful startup:

| Service              | URL                               | Description                  |
| -------------------- | --------------------------------- | ---------------------------- |
| Neolith Web          | http://localhost:3000             | Main web application         |
| Orchestrator Daemon  | ws://localhost:8787               | WebSocket server             |
| Health Check         | http://localhost:8787/health      | Daemon health status         |
| Redis                | redis://localhost:6379            | Cache server                 |
| PostgreSQL           | postgresql://localhost:5432       | Database server              |

## Logs

All logs are written to `/tmp/wundr-logs/`:

```bash
# View daemon logs
tail -f /tmp/wundr-logs/daemon.log

# View web app logs
tail -f /tmp/wundr-logs/web.log

# View build logs
ls /tmp/wundr-logs/
```

## Environment Variables

### Default Values

The scripts use sensible defaults, but you can override:

```bash
# Database connection
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Redis connection
export REDIS_URL="redis://localhost:6379"

# NextAuth configuration
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="your-secret-key"

# Daemon connection
export DAEMON_URL="ws://localhost:8787"

# Then start services
pnpm run start:all
```

### For Production

Never use default secrets in production:

```bash
# Generate secure secret
openssl rand -base64 32

# Set in environment
export NEXTAUTH_SECRET="generated-secret-here"
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -ti:8787  # Daemon port
lsof -ti:3000  # Web app port

# Kill the process
kill $(lsof -ti:8787)
kill $(lsof -ti:3000)
```

### Docker Issues

```bash
# Check Docker is running
docker info

# Restart Docker Desktop (macOS)
# Or restart Docker service (Linux)
sudo systemctl restart docker

# Clean up old containers
docker ps -a | grep wundr
docker rm -f wundr-redis wundr-postgres
```

### Database Migration Fails

```bash
# Reset database
pnpm --filter @neolith/database run db:reset

# Or manually
dropdb neolith
createdb neolith
pnpm --filter @neolith/database run db:migrate:deploy
```

### Build Failures

```bash
# Clean and rebuild
pnpm run clean
pnpm run build

# Or rebuild specific package
pnpm --filter @wundr.io/orchestrator-daemon run build
pnpm --filter @neolith/web run build
```

### Services Won't Stop

```bash
# Use force stop script
pnpm run stop:all

# Manual cleanup
pkill -f orchestrator-daemon
pkill -f "next.*@neolith/web"

# Clear PID file
rm -f /tmp/wundr-services.pids
```

## Development Workflow

### Typical E2E Testing Flow

```bash
# 1. Start all services
pnpm run start:all

# 2. In another terminal, run E2E tests
pnpm run test:e2e

# 3. View logs if tests fail
tail -f /tmp/wundr-logs/daemon.log
tail -f /tmp/wundr-logs/web.log

# 4. Stop services when done
pnpm run stop:all
```

### Continuous Development

```bash
# Terminal 1: Start infrastructure only
docker run -d -p 6379:6379 --name wundr-redis redis:7-alpine
docker run -d -p 5432:5432 --name wundr-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=neolith \
  postgres:16-alpine

# Terminal 2: Run daemon in watch mode
cd packages/@wundr/orchestrator-daemon
pnpm run dev

# Terminal 3: Run web app in dev mode
cd packages/@wundr/neolith/apps/web
pnpm run dev

# Terminal 4: Run tests
pnpm run test:watch
```

## Script Architecture

### start-all.sh

**Phases:**
1. **Prerequisite Checks**: Verify Node.js, pnpm, Docker
2. **Infrastructure**: Start Redis, PostgreSQL
3. **Database**: Run migrations, generate Prisma client
4. **Build**: Build core packages, daemon, web app
5. **Services**: Start daemon and web app
6. **Monitoring**: Display status, URLs, logs

**PID Tracking:**
- PIDs written to `/tmp/wundr-services.pids`
- Used by stop script for graceful shutdown

**Signal Handling:**
- Traps SIGINT, SIGTERM for cleanup
- Ensures services stop on Ctrl+C

### stop-all.sh

**Phases:**
1. **PID File**: Stop processes from tracking file
2. **Port Check**: Find and stop processes on known ports
3. **Docker**: Stop containers if created
4. **Cleanup**: Kill remaining processes by name
5. **Verification**: Confirm ports are free

## Advanced Usage

### Custom Ports

Edit the scripts to change ports:

```bash
# In start-all.sh
DAEMON_PORT=8787  # Change to your port
WEB_PORT=3000     # Change to your port
```

### Skip Services

Comment out sections in `start-all.sh`:

```bash
# Skip Redis
# log "Starting Redis..."
# ...

# Skip PostgreSQL
# log "Checking PostgreSQL..."
# ...
```

### Add Services

Add new services before the "PRINT STATUS" section:

```bash
# Start custom service
log "Starting custom service..."
pnpm --filter @my/service run start > "$LOGS_DIR/custom.log" 2>&1 &
CUSTOM_PID=$!
echo "$CUSTOM_PID" >> "$PIDS_FILE"
```

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Start services
        run: pnpm run start:all &

      - name: Wait for services
        run: |
          sleep 30
          curl --retry 10 --retry-delay 5 http://localhost:8787/health
          curl --retry 10 --retry-delay 5 http://localhost:3000

      - name: Run E2E tests
        run: pnpm run test:e2e

      - name: Stop services
        if: always()
        run: pnpm run stop:all
```

## Performance Tips

### Faster Builds

```bash
# Use Turbo cache
export TURBO_CACHE_DIR=/path/to/cache

# Parallel builds
pnpm build --parallel

# Skip type checking during development
export SKIP_TYPE_CHECK=true
```

### Resource Optimization

```bash
# Limit Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Use Docker resource limits
docker run --memory=2g --cpus=2 redis:7-alpine
```

## Support

For issues or questions:

- GitHub Issues: https://github.com/adapticai/wundr/issues
- Documentation: /Users/maya/wundr/docs/
- Scripts: /Users/maya/wundr/scripts/

## License

MIT - See LICENSE file in repository root
