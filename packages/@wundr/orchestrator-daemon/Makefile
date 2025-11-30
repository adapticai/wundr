# Makefile for orchestrator-daemon Docker operations
.PHONY: help dev prod up down build logs restart status health clean

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

help: ## Show this help message
	@echo '$(GREEN)Orchestrator Daemon - Docker Commands$(NC)'
	@echo ''
	@echo 'Usage:'
	@echo '  $(YELLOW)make$(NC) $(BLUE)<target>$(NC)'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(BLUE)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development commands
dev: ## Start development environment
	@./docker-start.sh dev up

dev-build: ## Build and start development environment
	@docker-compose -f docker-compose.dev.yml up --build

dev-down: ## Stop development environment
	@./docker-start.sh dev down

dev-logs: ## View development logs
	@docker-compose -f docker-compose.dev.yml logs -f

# Production commands
prod: ## Start production environment
	@./docker-start.sh prod up

prod-build: ## Build and start production environment
	@docker-compose up --build -d

prod-down: ## Stop production environment
	@./docker-start.sh prod down

prod-logs: ## View production logs
	@docker-compose logs -f

# Common commands
up: prod ## Alias for prod (default)

down: ## Stop all services
	@docker-compose down
	@docker-compose -f docker-compose.dev.yml down

build: ## Build all images
	@docker-compose build

rebuild: ## Rebuild images without cache
	@docker-compose build --no-cache

logs: ## View logs (production)
	@docker-compose logs -f daemon

logs-all: ## View all service logs
	@docker-compose logs -f

restart: ## Restart all services
	@docker-compose restart

restart-daemon: ## Restart only daemon service
	@docker-compose restart daemon

status: ## Show service status
	@docker-compose ps

health: ## Check service health
	@./docker-start.sh prod health

# Database commands
db-shell: ## Access PostgreSQL shell
	@docker-compose exec postgres psql -U orchestrator -d orchestrator

db-backup: ## Backup PostgreSQL database
	@echo "Creating backup..."
	@docker-compose exec postgres pg_dump -U orchestrator orchestrator > backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup created: backup-$$(date +%Y%m%d-%H%M%S).sql"

db-restore: ## Restore PostgreSQL database (usage: make db-restore FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then echo "Usage: make db-restore FILE=backup.sql"; exit 1; fi
	@echo "Restoring from $(FILE)..."
	@docker-compose exec -T postgres psql -U orchestrator orchestrator < $(FILE)
	@echo "Restore complete"

# Redis commands
redis-cli: ## Access Redis CLI
	@docker-compose exec redis redis-cli

redis-flush: ## Flush all Redis data (WARNING: deletes all data)
	@echo "WARNING: This will delete all Redis data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose exec redis redis-cli FLUSHALL; \
		echo "Redis data flushed"; \
	fi

# Daemon commands
daemon-shell: ## Access daemon container shell
	@docker-compose exec daemon sh

daemon-exec: ## Execute command in daemon (usage: make daemon-exec CMD="ls -la")
	@docker-compose exec daemon $(CMD)

# Development tools
pgadmin: ## Open PgAdmin in browser
	@echo "Opening PgAdmin at http://localhost:5050"
	@echo "Email: admin@orchestrator.local"
	@echo "Password: admin"
	@open http://localhost:5050 || xdg-open http://localhost:5050 || echo "Please open http://localhost:5050 in your browser"

redis-commander: ## Open Redis Commander in browser
	@echo "Opening Redis Commander at http://localhost:8081"
	@open http://localhost:8081 || xdg-open http://localhost:8081 || echo "Please open http://localhost:8081 in your browser"

metrics: ## Open metrics endpoint in browser
	@echo "Opening metrics at http://localhost:9090/metrics"
	@open http://localhost:9090/metrics || xdg-open http://localhost:9090/metrics || echo "Please open http://localhost:9090/metrics in your browser"

# Cleanup commands
clean: ## Remove stopped containers and orphaned volumes
	@docker-compose down -v --remove-orphans
	@docker-compose -f docker-compose.dev.yml down -v --remove-orphans

clean-all: ## Remove all containers, volumes, and images (WARNING: destructive)
	@echo "WARNING: This will remove all containers, volumes, and images!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v --rmi all --remove-orphans; \
		docker-compose -f docker-compose.dev.yml down -v --rmi all --remove-orphans; \
		echo "Cleanup complete"; \
	fi

prune: ## Prune Docker system (removes unused data)
	@docker system prune -f

# Setup commands
setup: ## Initial setup (create .env, build images)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file. Please review and update settings."; \
	fi
	@$(MAKE) build
	@echo "Setup complete! Run 'make dev' or 'make prod' to start."

# Testing commands
test: ## Run tests in daemon container
	@docker-compose exec daemon pnpm test

test-watch: ## Run tests in watch mode
	@docker-compose exec daemon pnpm test:watch

# Monitoring commands
ps: ## Show running containers (alias for status)
	@docker-compose ps

top: ## Show container resource usage
	@docker stats --no-stream

monitor: ## Continuous monitoring of resources
	@docker stats

# Network commands
network-inspect: ## Inspect Docker network
	@docker network inspect orchestrator-network || echo "Network not found"

network-ls: ## List all networks
	@docker network ls

# Volume commands
volumes: ## List all volumes
	@docker volume ls | grep orchestrator

volume-inspect: ## Inspect volume (usage: make volume-inspect VOL=orchestrator_postgres_data)
	@if [ -z "$(VOL)" ]; then \
		echo "Usage: make volume-inspect VOL=volume_name"; \
		echo "Available volumes:"; \
		docker volume ls | grep orchestrator; \
	else \
		docker volume inspect $(VOL); \
	fi

# Version info
version: ## Show version information
	@echo "Docker version:"
	@docker --version
	@echo ""
	@echo "Docker Compose version:"
	@docker-compose --version
	@echo ""
	@echo "Orchestrator daemon version:"
	@grep '"version"' package.json | head -1 | awk -F: '{ print $$2 }' | sed 's/[",]//g' | xargs
