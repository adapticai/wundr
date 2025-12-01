#!/usr/bin/env bash
# =============================================================================
# Wundr Docker Development Environment Manager
# =============================================================================
# Usage: ./scripts/docker-dev.sh [command]
#
# Commands:
#   up      - Start all infrastructure services
#   down    - Stop all services
#   reset   - Remove volumes and restart fresh
#   logs    - Follow logs from all services
#   status  - Show status of all services
#   ps      - Alias for status
#   shell   - Open psql shell to PostgreSQL
#   redis   - Open redis-cli
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$ROOT_DIR/docker-compose.dev.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker Desktop."
        exit 1
    fi
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi
}

cmd_up() {
    log_info "Starting development infrastructure..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    log_info "Waiting for services to be healthy..."
    sleep 3
    
    # Check service health
    local retries=30
    local count=0
    while [ $count -lt $retries ]; do
        if docker compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy\|starting"; then
            sleep 1
            ((count++))
        else
            break
        fi
    done
    
    echo ""
    log_success "Development infrastructure is ready!"
    echo ""
    echo "Services:"
    echo "  PostgreSQL:  localhost:5432 (user: neolith, pass: neolith, db: neolith)"
    echo "  Redis:       localhost:6379"
    echo "  MailHog UI:  http://localhost:8025"
    echo "  MinIO API:   http://localhost:9000 (user: minioadmin, pass: minioadmin)"
    echo "  MinIO UI:    http://localhost:9001"
    echo ""
    echo "Next steps:"
    echo "  1. Run database migrations:  pnpm db:migrate"
    echo "  2. Start development:        pnpm dev"
}

cmd_down() {
    log_info "Stopping development infrastructure..."
    docker compose -f "$COMPOSE_FILE" down
    log_success "All services stopped."
}

cmd_reset() {
    log_warn "This will delete all development data (databases, redis, minio)!"
    read -p "Are you sure? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Stopping and removing containers..."
        docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
        log_success "All data removed."
        log_info "Starting fresh infrastructure..."
        cmd_up
    else
        log_info "Cancelled."
    fi
}

cmd_logs() {
    docker compose -f "$COMPOSE_FILE" logs -f "$@"
}

cmd_status() {
    docker compose -f "$COMPOSE_FILE" ps
}

cmd_shell() {
    log_info "Connecting to PostgreSQL..."
    docker compose -f "$COMPOSE_FILE" exec postgres psql -U neolith -d neolith
}

cmd_redis() {
    log_info "Connecting to Redis..."
    docker compose -f "$COMPOSE_FILE" exec redis redis-cli
}

cmd_help() {
    echo "Wundr Docker Development Environment"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  up      Start all infrastructure services"
    echo "  down    Stop all services"
    echo "  reset   Remove volumes and restart fresh"
    echo "  logs    Follow logs from all services"
    echo "  status  Show status of all services"
    echo "  ps      Alias for status"
    echo "  shell   Open psql shell to PostgreSQL"
    echo "  redis   Open redis-cli"
    echo "  help    Show this help message"
}

# Main
check_docker

case "${1:-help}" in
    up)      cmd_up ;;
    down)    cmd_down ;;
    reset)   cmd_reset ;;
    logs)    shift; cmd_logs "$@" ;;
    status)  cmd_status ;;
    ps)      cmd_status ;;
    shell)   cmd_shell ;;
    redis)   cmd_redis ;;
    help)    cmd_help ;;
    *)       log_error "Unknown command: $1"; cmd_help; exit 1 ;;
esac
