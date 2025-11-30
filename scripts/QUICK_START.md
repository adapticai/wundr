# Quick Start - E2E Testing Environment

## TL;DR

```bash
# Start everything
pnpm run start:all

# Stop everything
pnpm run stop:all
```

## What You Get

| Service | URL | Status |
|---------|-----|--------|
| Web App | http://localhost:3000 | Main application |
| Daemon | ws://localhost:8787 | WebSocket server |
| Health | http://localhost:8787/health | Health check |
| Redis | redis://localhost:6379 | Cache |
| PostgreSQL | postgresql://localhost:5432 | Database |

## Logs

```bash
# View all logs
ls -la /tmp/wundr-logs/

# Follow daemon logs
tail -f /tmp/wundr-logs/daemon.log

# Follow web logs
tail -f /tmp/wundr-logs/web.log
```

## Common Issues

### Port in use?
```bash
lsof -ti:8787 -ti:3000 | xargs kill -9
```

### Docker not running?
```bash
# Install Redis/PostgreSQL locally
brew install redis postgresql@16
brew services start redis postgresql@16
```

### Build failed?
```bash
pnpm run clean
pnpm run build
```

### Services won't stop?
```bash
pnpm run stop:all
# Or manually:
pkill -f orchestrator-daemon
pkill -f "next.*@neolith/web"
```

## Full Documentation

See [E2E_STARTUP_GUIDE.md](./E2E_STARTUP_GUIDE.md) for complete documentation.
