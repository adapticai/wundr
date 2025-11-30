#!/bin/bash

# Master startup script for Wundr monorepo E2E testing
# Starts all required services in proper order

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timestamp function
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

success() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warn() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# PID tracking file
PIDS_FILE="/tmp/wundr-services.pids"
LOGS_DIR="/tmp/wundr-logs"

# Cleanup function
cleanup() {
  log "Stopping all services..."

  if [ -f "$PIDS_FILE" ]; then
    while read -r pid; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        log "Stopping process $pid"
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PIDS_FILE"
    rm -f "$PIDS_FILE"
  fi

  success "All services stopped"
  exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# Create logs directory
mkdir -p "$LOGS_DIR"

# Clear PID file
> "$PIDS_FILE"

log "Starting Wundr E2E environment..."
echo ""

# ============================================================================
# 1. CHECK PREREQUISITES
# ============================================================================

log "Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
  error "Node.js is not installed"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js version must be >= 18.0.0 (found: $(node -v))"
  exit 1
fi
success "Node.js $(node -v) detected"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  error "pnpm is not installed. Run: npm install -g pnpm"
  exit 1
fi
success "pnpm $(pnpm -v) detected"

# Check Docker (optional)
DOCKER_AVAILABLE=false
if command -v docker &> /dev/null && docker info &> /dev/null; then
  DOCKER_AVAILABLE=true
  success "Docker detected and running"
else
  warn "Docker not available - will use local services if configured"
fi

echo ""

# ============================================================================
# 2. START REDIS
# ============================================================================

log "Starting Redis..."

REDIS_PORT=6379
REDIS_RUNNING=false

# Check if Redis is already running
if command -v redis-cli &> /dev/null && redis-cli ping &> /dev/null; then
  success "Redis already running on port $REDIS_PORT"
  REDIS_RUNNING=true
elif [ "$DOCKER_AVAILABLE" = true ]; then
  log "Starting Redis via Docker..."
  docker run -d \
    --name wundr-redis \
    -p $REDIS_PORT:6379 \
    redis:7-alpine > /dev/null 2>&1 || true

  # Wait for Redis to be ready
  for i in {1..30}; do
    if redis-cli ping &> /dev/null; then
      success "Redis started via Docker"
      REDIS_RUNNING=true
      break
    fi
    sleep 1
  done
else
  warn "Redis not available - some features may not work"
  warn "Install Redis or Docker to enable caching"
fi

echo ""

# ============================================================================
# 3. START POSTGRESQL (if needed)
# ============================================================================

log "Checking PostgreSQL..."

POSTGRES_RUNNING=false
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/neolith}"

# Check if Postgres is running
if command -v psql &> /dev/null; then
  if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
    success "PostgreSQL already running"
    POSTGRES_RUNNING=true
  fi
elif [ "$DOCKER_AVAILABLE" = true ]; then
  log "Starting PostgreSQL via Docker..."
  docker run -d \
    --name wundr-postgres \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=neolith \
    -p 5432:5432 \
    postgres:16-alpine > /dev/null 2>&1 || true

  # Wait for Postgres to be ready
  for i in {1..30}; do
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null 2>&1; then
      success "PostgreSQL started via Docker"
      POSTGRES_RUNNING=true
      break
    fi
    sleep 1
  done
else
  warn "PostgreSQL not available - database features may not work"
fi

echo ""

# ============================================================================
# 4. RUN DATABASE MIGRATIONS
# ============================================================================

if [ "$POSTGRES_RUNNING" = true ]; then
  log "Running database migrations..."

  cd "$(dirname "$0")/.."

  # Generate Prisma client
  log "Generating Prisma client..."
  pnpm --filter @neolith/database run db:generate > "$LOGS_DIR/prisma-generate.log" 2>&1

  # Run migrations
  log "Applying database migrations..."
  pnpm --filter @neolith/database run db:migrate:deploy > "$LOGS_DIR/prisma-migrate.log" 2>&1 || {
    warn "Migrations failed - database may be up to date"
  }

  success "Database migrations completed"
  echo ""
fi

# ============================================================================
# 5. BUILD PACKAGES
# ============================================================================

log "Building packages..."

cd "$(dirname "$0")/.."

# Build core dependencies first
log "Building core packages..."
pnpm build --filter=@wundr.io/core \
  --filter=@neolith/database \
  --filter=@neolith/core \
  --filter=@neolith/ui > "$LOGS_DIR/build-core.log" 2>&1

success "Core packages built"

# Build daemon
log "Building orchestrator daemon..."
pnpm build --filter=@wundr.io/orchestrator-daemon > "$LOGS_DIR/build-daemon.log" 2>&1

success "Orchestrator daemon built"

# Build web app
log "Building Neolith web app..."
pnpm build --filter=@neolith/web > "$LOGS_DIR/build-web.log" 2>&1

success "Neolith web app built"

echo ""

# ============================================================================
# 6. START ORCHESTRATOR DAEMON
# ============================================================================

log "Starting Orchestrator Daemon..."

cd "$(dirname "$0")/.."

DAEMON_PORT=8787
DAEMON_LOG="$LOGS_DIR/daemon.log"

# Set environment variables
export REDIS_URL="redis://localhost:$REDIS_PORT"
export NODE_ENV=development

# Start daemon in background
pnpm --filter=@wundr.io/orchestrator-daemon run start > "$DAEMON_LOG" 2>&1 &
DAEMON_PID=$!
echo "$DAEMON_PID" >> "$PIDS_FILE"

log "Daemon started (PID: $DAEMON_PID)"

# Wait for daemon to be ready
log "Waiting for daemon health check..."
for i in {1..60}; do
  if curl -s "http://localhost:$DAEMON_PORT/health" > /dev/null 2>&1; then
    success "Orchestrator Daemon is ready!"
    break
  fi

  if [ $i -eq 60 ]; then
    error "Daemon failed to start. Check logs: $DAEMON_LOG"
    exit 1
  fi

  sleep 1
done

echo ""

# ============================================================================
# 7. START NEOLITH WEB APP
# ============================================================================

log "Starting Neolith Web App..."

cd "$(dirname "$0")/.."

WEB_PORT=3000
WEB_LOG="$LOGS_DIR/web.log"

# Set environment variables
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/neolith}"
export NEXTAUTH_URL="http://localhost:$WEB_PORT"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dev-secret-change-in-production}"
export DAEMON_URL="ws://localhost:$DAEMON_PORT"

# Start web app in background
pnpm --filter=@neolith/web run start > "$WEB_LOG" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" >> "$PIDS_FILE"

log "Web app started (PID: $WEB_PID)"

# Wait for web app to be ready
log "Waiting for web app to be ready..."
for i in {1..60}; do
  if curl -s "http://localhost:$WEB_PORT" > /dev/null 2>&1; then
    success "Neolith Web App is ready!"
    break
  fi

  if [ $i -eq 60 ]; then
    error "Web app failed to start. Check logs: $WEB_LOG"
    exit 1
  fi

  sleep 1
done

echo ""

# ============================================================================
# 8. PRINT STATUS
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "All services are running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ${GREEN}Service URLs:${NC}"
echo "  ├─ Orchestrator Daemon:  ws://localhost:$DAEMON_PORT"
echo "  ├─ Daemon Health:        http://localhost:$DAEMON_PORT/health"
echo "  ├─ Neolith Web App:      http://localhost:$WEB_PORT"
if [ "$REDIS_RUNNING" = true ]; then
  echo "  ├─ Redis:                redis://localhost:$REDIS_PORT"
fi
if [ "$POSTGRES_RUNNING" = true ]; then
  echo "  └─ PostgreSQL:           postgresql://localhost:5432/neolith"
fi
echo ""
echo "  ${BLUE}Logs:${NC}"
echo "  ├─ Daemon:               $DAEMON_LOG"
echo "  ├─ Web:                  $WEB_LOG"
echo "  └─ All logs:             $LOGS_DIR/"
echo ""
echo "  ${YELLOW}PIDs:${NC}"
echo "  ├─ Daemon:               $DAEMON_PID"
echo "  └─ Web:                  $WEB_PID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Press Ctrl+C to stop all services"
echo ""

# Keep script running
wait
