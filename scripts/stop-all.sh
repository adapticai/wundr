#!/bin/bash

# Stop all services started by start-all.sh

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

log "Stopping Wundr E2E environment..."
echo ""

# ============================================================================
# 1. STOP PROCESSES FROM PID FILE
# ============================================================================

if [ -f "$PIDS_FILE" ]; then
  log "Stopping tracked processes..."

  STOPPED=0
  while read -r pid; do
    if [ -n "$pid" ]; then
      if kill -0 "$pid" 2>/dev/null; then
        log "Stopping process $pid..."
        kill "$pid" 2>/dev/null || true

        # Give it time to stop gracefully
        for i in {1..10}; do
          if ! kill -0 "$pid" 2>/dev/null; then
            break
          fi
          sleep 0.5
        done

        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
          warn "Force stopping process $pid"
          kill -9 "$pid" 2>/dev/null || true
        fi

        STOPPED=$((STOPPED + 1))
      fi
    fi
  done < "$PIDS_FILE"

  rm -f "$PIDS_FILE"
  success "Stopped $STOPPED process(es)"
else
  warn "No PID file found at $PIDS_FILE"
fi

echo ""

# ============================================================================
# 2. STOP BY PORT (fallback)
# ============================================================================

log "Checking for services on known ports..."

# Port 8787 - Orchestrator Daemon
DAEMON_PID=$(lsof -ti:8787 2>/dev/null || true)
if [ -n "$DAEMON_PID" ]; then
  log "Stopping daemon on port 8787 (PID: $DAEMON_PID)..."
  kill "$DAEMON_PID" 2>/dev/null || true
  sleep 1
  if kill -0 "$DAEMON_PID" 2>/dev/null; then
    kill -9 "$DAEMON_PID" 2>/dev/null || true
  fi
  success "Daemon stopped"
fi

# Port 3000 - Neolith Web
WEB_PID=$(lsof -ti:3000 2>/dev/null || true)
if [ -n "$WEB_PID" ]; then
  log "Stopping web app on port 3000 (PID: $WEB_PID)..."
  kill "$WEB_PID" 2>/dev/null || true
  sleep 1
  if kill -0 "$WEB_PID" 2>/dev/null; then
    kill -9 "$WEB_PID" 2>/dev/null || true
  fi
  success "Web app stopped"
fi

echo ""

# ============================================================================
# 3. STOP DOCKER CONTAINERS (if created by start-all.sh)
# ============================================================================

if command -v docker &> /dev/null; then
  log "Stopping Docker containers..."

  # Stop Redis
  if docker ps -q -f name=wundr-redis 2>/dev/null | grep -q .; then
    log "Stopping wundr-redis container..."
    docker stop wundr-redis > /dev/null 2>&1 || true
    docker rm wundr-redis > /dev/null 2>&1 || true
    success "Redis container stopped"
  fi

  # Stop PostgreSQL
  if docker ps -q -f name=wundr-postgres 2>/dev/null | grep -q .; then
    log "Stopping wundr-postgres container..."
    docker stop wundr-postgres > /dev/null 2>&1 || true
    docker rm wundr-postgres > /dev/null 2>&1 || true
    success "PostgreSQL container stopped"
  fi
fi

echo ""

# ============================================================================
# 4. CLEANUP BY PROCESS NAME (extra safety)
# ============================================================================

log "Checking for remaining Node.js processes..."

# Kill any remaining orchestrator-daemon processes
pkill -f "orchestrator-daemon" 2>/dev/null || true

# Kill any remaining Next.js processes for Neolith
pkill -f "next.*@neolith/web" 2>/dev/null || true

echo ""

# ============================================================================
# 5. FINAL STATUS
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "All Wundr services stopped!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify ports are free
PORT_8787=$(lsof -ti:8787 2>/dev/null || true)
PORT_3000=$(lsof -ti:3000 2>/dev/null || true)

if [ -z "$PORT_8787" ] && [ -z "$PORT_3000" ]; then
  success "Ports 8787 and 3000 are now free"
else
  if [ -n "$PORT_8787" ]; then
    warn "Port 8787 still in use by PID: $PORT_8787"
  fi
  if [ -n "$PORT_3000" ]; then
    warn "Port 3000 still in use by PID: $PORT_3000"
  fi
  echo ""
  echo "Run: lsof -ti:8787 -ti:3000 | xargs kill -9"
  echo ""
fi

echo ""
