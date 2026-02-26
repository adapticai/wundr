# Docker Quick Start Guide

Get the orchestrator-daemon running in Docker in 60 seconds.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose available (included with Docker Desktop)

## Quick Start (3 Steps)

### 1. Setup Environment

```bash
# Copy environment file
cp .env.example .env

# Edit configuration (optional - defaults work for development)
nano .env
```

### 2. Start Services

**Option A: Using Make (Recommended)**

```bash
# Development mode with hot reload + dev tools
make dev

# Production mode
make prod
```

**Option B: Using Docker Compose**

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose up -d
```

**Option C: Using Start Script**

```bash
# Development
./docker-start.sh dev up

# Production
./docker-start.sh prod up
```

### 3. Verify

```bash
# Check status
make status

# Check health
make health

# View logs
make logs
```

## Access Points

### Production Mode

- **Daemon WebSocket**: ws://localhost:8787
- **Health Check**: http://localhost:8787/health
- **Metrics**: http://localhost:9090/metrics
- **Redis**: localhost:6379
- **PostgreSQL**: localhost:5432

### Development Mode

All production endpoints plus:

- **Redis Commander**: http://localhost:8081
- **PgAdmin**: http://localhost:5050 (admin@orchestrator.local / admin)
- **Node Debugger**: localhost:9229

## Essential Commands

```bash
# Start services
make dev              # Start development environment
make prod             # Start production environment

# Stop services
make down             # Stop all services

# View logs
make logs             # View daemon logs
make logs-all         # View all service logs

# Restart
make restart          # Restart all services
make restart-daemon   # Restart only daemon

# Database
make db-shell         # PostgreSQL shell
make db-backup        # Backup database
make redis-cli        # Redis CLI

# Monitoring
make status           # Service status
make health           # Health checks
make monitor          # Resource monitoring

# Development tools
make pgadmin          # Open PgAdmin
make redis-commander  # Open Redis Commander
make test             # Run tests

# Cleanup
make clean            # Remove containers and volumes
make clean-all        # Full cleanup (WARNING: destructive)
```

## Common Workflows

### Development Workflow

```bash
# 1. Start environment
make dev

# 2. Code changes auto-reload

# 3. Run tests
make test

# 4. View logs
make logs

# 5. Stop when done
make down
```

### Production Testing

```bash
# 1. Build images
make prod-build

# 2. Start services
make prod

# 3. Check health
make health

# 4. Monitor
make monitor

# 5. View metrics
curl http://localhost:9090/metrics
```

### Database Management

```bash
# Backup
make db-backup

# Access database
make db-shell

# Restore
make db-restore FILE=backup-20251201-123456.sql

# Access via PgAdmin (dev mode)
make dev
make pgadmin
```

### Debugging

```bash
# Start in dev mode
make dev

# Access container
make daemon-shell

# Attach debugger (VS Code)
# Add to launch.json:
{
  "type": "node",
  "request": "attach",
  "name": "Docker Attach",
  "port": 9229
}

# View detailed logs
make logs-all
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker info

# Check logs for errors
make logs-all

# Rebuild images
make rebuild

# Clean and restart
make clean
make dev
```

### Can't Connect to Services

```bash
# Check if services are running
make status

# Verify health
make health

# Check network
docker network inspect orchestrator-network

# Restart services
make restart
```

### Database Connection Issues

```bash
# Check PostgreSQL is ready
make db-shell

# Verify environment variables
docker-compose exec daemon env | grep POSTGRES

# Check logs
docker-compose logs postgres
```

### Redis Connection Issues

```bash
# Test Redis
make redis-cli
> PING
> exit

# Check logs
docker-compose logs redis

# Flush and restart (if needed)
make redis-flush
make restart
```

### Performance Issues

```bash
# Check resource usage
make top

# View detailed stats
make monitor

# Restart services
make restart
```

## Environment Variables

### Required for Production

```bash
# Database credentials
POSTGRES_PASSWORD=your_secure_password

# AI API keys (if using AI features)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### Optional Configuration

```bash
# Ports
DAEMON_PORT=8787
METRICS_PORT=9090
REDIS_PORT=6379
POSTGRES_PORT=5432

# Session settings
SESSION_TIMEOUT=3600000
MAX_SESSIONS=100

# Features
ENABLE_FEDERATION=true
ENABLE_METRICS=true
ENABLE_COST_TRACKING=true
```

See `.env.example` for complete list.

## Data Persistence

### Volumes

- `orchestrator_postgres_data` - PostgreSQL database
- `orchestrator_redis_data` - Redis cache
- `orchestrator_node_modules_cache` - Node modules (dev only)

### Backup Data

```bash
# PostgreSQL
make db-backup

# Redis
docker-compose exec redis redis-cli SAVE
docker cp orchestrator-redis:/data/dump.rdb ./redis-backup.rdb
```

### Restore Data

```bash
# PostgreSQL
make db-restore FILE=backup.sql

# Redis
docker cp redis-backup.rdb orchestrator-redis:/data/dump.rdb
docker-compose restart redis
```

## Development vs Production

| Feature            | Development | Production |
| ------------------ | ----------- | ---------- |
| Hot Reload         | ✓           | ✗          |
| Debug Port         | ✓ (9229)    | ✗          |
| Redis Commander    | ✓           | ✗          |
| PgAdmin            | ✓           | ✗          |
| Source Mounts      | ✓           | ✗          |
| Optimized Build    | ✗           | ✓          |
| Security Hardening | ✗           | ✓          |
| Resource Limits    | ✗           | ✓          |

## Next Steps

1. **Configure**: Edit `.env` with your settings
2. **Start**: Run `make dev` or `make prod`
3. **Verify**: Run `make health`
4. **Develop**: Make changes, they auto-reload in dev mode
5. **Test**: Run `make test`
6. **Monitor**: Use `make monitor` and metrics endpoint
7. **Deploy**: Build production images and deploy

## Help

```bash
# Show all available commands
make help

# View detailed documentation
cat README.docker.md

# Check service health
make health

# View logs for debugging
make logs-all
```

## Support

- Full Documentation: [README.docker.md](./README.docker.md)
- Issues: https://github.com/adapticai/wundr/issues
- Package Docs: [README.md](./README.md)
