#!/bin/bash
# Quick start script for orchestrator-daemon Docker setup

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print with color
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    print_warn ".env file not found. Creating from .env.example..."
    cp .env.example .env
    print_info "Created .env file. Please review and update with your settings."
    print_warn "Especially set: POSTGRES_PASSWORD, ANTHROPIC_API_KEY, OPENAI_API_KEY"
fi

# Parse arguments
MODE=${1:-production}
ACTION=${2:-up}

case $MODE in
    prod|production)
        COMPOSE_FILE="docker-compose.yml"
        print_info "Starting in PRODUCTION mode"
        ;;
    dev|development)
        COMPOSE_FILE="docker-compose.dev.yml"
        print_info "Starting in DEVELOPMENT mode"
        ;;
    *)
        print_error "Invalid mode: $MODE"
        echo "Usage: $0 [prod|dev] [up|down|build|logs|restart]"
        exit 1
        ;;
esac

# Execute action
case $ACTION in
    up)
        print_info "Starting services..."
        docker-compose -f "$COMPOSE_FILE" up -d
        print_info "Waiting for services to be healthy..."
        sleep 5
        docker-compose -f "$COMPOSE_FILE" ps
        print_info "Services started successfully!"
        print_info "Daemon: http://localhost:8787"
        print_info "Metrics: http://localhost:9090/metrics"
        if [ "$MODE" = "dev" ] || [ "$MODE" = "development" ]; then
            print_info "Redis Commander: http://localhost:8081"
            print_info "PgAdmin: http://localhost:5050"
        fi
        ;;
    down)
        print_info "Stopping services..."
        docker-compose -f "$COMPOSE_FILE" down
        print_info "Services stopped"
        ;;
    build)
        print_info "Building images..."
        docker-compose -f "$COMPOSE_FILE" build
        print_info "Build complete"
        ;;
    logs)
        docker-compose -f "$COMPOSE_FILE" logs -f
        ;;
    restart)
        print_info "Restarting services..."
        docker-compose -f "$COMPOSE_FILE" restart
        print_info "Services restarted"
        ;;
    status)
        docker-compose -f "$COMPOSE_FILE" ps
        ;;
    health)
        print_info "Checking service health..."
        echo ""
        print_info "Daemon health:"
        curl -s http://localhost:8787/health | jq . || echo "Daemon not responding"
        echo ""
        print_info "Redis health:"
        docker-compose -f "$COMPOSE_FILE" exec redis redis-cli ping || echo "Redis not responding"
        echo ""
        print_info "PostgreSQL health:"
        docker-compose -f "$COMPOSE_FILE" exec postgres pg_isready || echo "PostgreSQL not responding"
        ;;
    *)
        print_error "Invalid action: $ACTION"
        echo "Usage: $0 [prod|dev] [up|down|build|logs|restart|status|health]"
        exit 1
        ;;
esac
