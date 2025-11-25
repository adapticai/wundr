#!/bin/bash

# Neolith - Local Services Startup Script
# This script starts PostgreSQL, Redis, and MailHog using Docker Compose

set -e

echo "🚀 Starting Neolith local services..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Docker is not running. Starting Docker Desktop..."
    open -a Docker
    echo "⏳ Waiting for Docker to start (60 seconds)..."
    for i in {1..60}; do
        if docker info > /dev/null 2>&1; then
            echo "✅ Docker started successfully!"
            break
        fi
        sleep 1
        if [ $i -eq 60 ]; then
            echo "❌ Docker failed to start after 60 seconds"
            echo "Please start Docker Desktop manually and run this script again"
            exit 1
        fi
    done
fi

# Navigate to the genesis-app directory
cd "$(dirname "$0")/.."

echo ""
echo "📦 Starting Docker services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check PostgreSQL health
echo "🔍 Checking PostgreSQL..."
if docker-compose exec -T postgres pg_isready -U neolith > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "⚠️  PostgreSQL is starting... (may take a few more seconds)"
fi

# Check Redis health
echo "🔍 Checking Redis..."
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "⚠️  Redis is starting... (may take a few more seconds)"
fi

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📊 Service URLs:"
echo "  PostgreSQL: postgresql://neolith:neolith@localhost:5432/neolith"
echo "  Redis:      redis://localhost:6379"
echo "  MailHog UI: http://localhost:8025"
echo ""
echo "📝 Next steps:"
echo "  1. Run database migrations: cd packages/@genesis/database && pnpm db:migrate"
echo "  2. Generate Prisma client:  cd packages/@genesis/database && pnpm db:generate"
echo "  3. Start the dev server:    cd apps/web && pnpm dev"
echo ""
echo "To stop services: docker-compose down"
echo "To view logs:     docker-compose logs -f [service_name]"
