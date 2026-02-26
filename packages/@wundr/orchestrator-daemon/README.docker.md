# Docker Setup Guide for Orchestrator Daemon

Complete Docker Compose setup for running the orchestrator-daemon with all dependencies.

## Quick Start

### Production Mode

```bash
# Copy environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f daemon
```

### Development Mode

```bash
# Start development environment with hot reload
docker-compose -f docker-compose.dev.yml up

# Run in background
docker-compose -f docker-compose.dev.yml up -d

# Attach to daemon logs
docker-compose -f docker-compose.dev.yml logs -f daemon
```

## Services

### Production (`docker-compose.yml`)

| Service  | Port | Description                   |
| -------- | ---- | ----------------------------- |
| daemon   | 8787 | Orchestrator daemon WebSocket |
| daemon   | 9090 | Prometheus metrics endpoint   |
| redis    | 6379 | Redis cache and pub/sub       |
| postgres | 5432 | PostgreSQL database           |

### Development (`docker-compose.dev.yml`)

Includes all production services plus:

| Service         | Port | Description           |
| --------------- | ---- | --------------------- |
| redis-commander | 8081 | Redis web UI          |
| pgadmin         | 5050 | PostgreSQL web UI     |
| daemon (debug)  | 9229 | Node.js debugger port |

## Environment Configuration

### Required Variables

```bash
# Database
POSTGRES_DB=orchestrator
POSTGRES_USER=orchestrator
POSTGRES_PASSWORD=your_secure_password

# AI Integration (optional)
ANTHROPIC_API_KEY=your_api_key
OPENAI_API_KEY=your_api_key
```

### Optional Variables

See `.env.example` for all available configuration options.

## Docker Commands

### Start Services

```bash
# Production
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Specific service
docker-compose up -d redis postgres
```

### Stop Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop specific service
docker-compose stop daemon
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f daemon

# Last 100 lines
docker-compose logs --tail=100 daemon
```

### Rebuild

```bash
# Rebuild daemon image
docker-compose build daemon

# Rebuild and start
docker-compose up --build daemon

# Force rebuild without cache
docker-compose build --no-cache daemon
```

### Access Containers

```bash
# Access daemon shell
docker-compose exec daemon sh

# Access PostgreSQL
docker-compose exec postgres psql -U orchestrator -d orchestrator

# Access Redis CLI
docker-compose exec redis redis-cli
```

## Health Checks

All services include health checks:

```bash
# Check all services health
docker-compose ps

# Check daemon health manually
curl http://localhost:8787/health

# Check metrics
curl http://localhost:9090/metrics
```

## Development Tools

### Redis Commander

Access Redis data via web UI:

- URL: http://localhost:8081
- No authentication required in dev mode

### PgAdmin

Access PostgreSQL via web UI:

- URL: http://localhost:5050
- Email: admin@orchestrator.local
- Password: admin

**Add Server in PgAdmin:**

1. Right-click Servers > Create > Server
2. General tab: Name = "Orchestrator"
3. Connection tab:
   - Host: postgres
   - Port: 5432
   - Database: orchestrator_dev
   - Username: dev_user
   - Password: dev_pass

### Node.js Debugger

Attach debugger to daemon in dev mode:

- Host: localhost
- Port: 9229

**VS Code launch.json:**

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Docker",
  "port": 9229,
  "address": "localhost",
  "localRoot": "${workspaceFolder}/packages/@wundr/orchestrator-daemon",
  "remoteRoot": "/app/packages/@wundr/orchestrator-daemon",
  "protocol": "inspector"
}
```

## Data Persistence

### Production Volumes

- `orchestrator_postgres_data` - PostgreSQL data
- `orchestrator_redis_data` - Redis data

### Development Volumes

- `orchestrator_postgres_dev_data` - PostgreSQL data
- `orchestrator_redis_dev_data` - Redis data
- `orchestrator_pgadmin_dev_data` - PgAdmin config
- `orchestrator_node_modules_cache` - Node modules cache

### Backup Volumes

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U orchestrator orchestrator > backup.sql

# Restore PostgreSQL
docker-compose exec -T postgres psql -U orchestrator orchestrator < backup.sql

# Backup Redis
docker-compose exec redis redis-cli SAVE
docker cp orchestrator-redis:/data/dump.rdb ./redis-backup.rdb
```

### Remove Volumes

```bash
# Remove all volumes (WARNING: deletes all data)
docker-compose down -v

# Remove specific volume
docker volume rm orchestrator_postgres_data
```

## Networking

All services communicate via `orchestrator-network` bridge network:

- Services can reach each other by service name (e.g., `redis`, `postgres`)
- External access via published ports only
- Isolated from other Docker networks

## Troubleshooting

### Daemon Won't Start

```bash
# Check logs
docker-compose logs daemon

# Check dependencies
docker-compose ps

# Verify health checks
docker-compose exec redis redis-cli ping
docker-compose exec postgres pg_isready
```

### Connection Issues

```bash
# Verify network
docker network inspect orchestrator-network

# Check environment variables
docker-compose exec daemon env | grep -E 'REDIS|POSTGRES'

# Test Redis connection
docker-compose exec daemon sh -c 'wget -O- http://redis:6379'

# Test PostgreSQL connection
docker-compose exec daemon sh -c 'nc -zv postgres 5432'
```

### Permission Issues

```bash
# Check file permissions
ls -la packages/@wundr/orchestrator-daemon/

# Fix permissions
chmod -R 755 packages/@wundr/orchestrator-daemon/

# Check volume permissions
docker-compose exec daemon ls -la /app/
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Limit resources in docker-compose.yml
services:
  daemon:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Production Deployment

### Security Recommendations

1. **Environment Variables:**
   - Never commit `.env` file
   - Use secrets management (Docker secrets, Vault)
   - Rotate credentials regularly

2. **Networking:**
   - Use internal networks for service communication
   - Only expose necessary ports
   - Use reverse proxy (nginx, Traefik) in front

3. **Resource Limits:**
   - Set memory and CPU limits
   - Configure PostgreSQL and Redis limits
   - Monitor resource usage

4. **Updates:**
   - Pin Docker image versions
   - Test updates in staging first
   - Implement blue-green deployments

### Example Production Stack

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  daemon:
    image: orchestrator-daemon:1.0.6
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
      restart_policy:
        condition: on-failure
        max_attempts: 3
    secrets:
      - postgres_password
      - redis_password
      - anthropic_api_key

secrets:
  postgres_password:
    external: true
  redis_password:
    external: true
  anthropic_api_key:
    external: true
```

## Monitoring

### Prometheus Metrics

Daemon exposes Prometheus metrics on port 9090:

```bash
# Access metrics
curl http://localhost:9090/metrics

# Example metrics
orchestrator_sessions_total
orchestrator_tasks_completed
orchestrator_memory_usage_bytes
```

### Health Endpoint

```bash
# Check health
curl http://localhost:8787/health

# Expected response
{
  "status": "healthy",
  "uptime": 12345,
  "version": "1.0.6"
}
```

## Development Workflow

1. **Start development environment:**

   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. **Make code changes** - hot reload happens automatically

3. **Run tests:**

   ```bash
   docker-compose exec daemon pnpm test
   ```

4. **Access development tools:**
   - Redis Commander: http://localhost:8081
   - PgAdmin: http://localhost:5050
   - Metrics: http://localhost:9090/metrics

5. **Debug issues:**
   - Attach VS Code debugger to port 9229
   - View logs: `docker-compose logs -f daemon`

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Docker Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker-compose build
      - name: Run tests
        run: docker-compose run daemon pnpm test
      - name: Push to registry
        run: docker-compose push
```

## Support

For issues and questions:

- GitHub Issues: https://github.com/adapticai/wundr/issues
- Documentation: See main README.md
