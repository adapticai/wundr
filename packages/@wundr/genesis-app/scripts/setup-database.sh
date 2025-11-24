#!/bin/bash

# Neolith - Database Setup Script
# This script initializes the PostgreSQL database with Prisma

set -e

echo "🗄️  Setting up Neolith database..."
echo ""

# Check if Docker services are running
if ! docker ps | grep -q neolith-postgres; then
    echo "❌ PostgreSQL container is not running"
    echo "Please run: ./scripts/start-services.sh"
    exit 1
fi

# Navigate to the database package
cd "$(dirname "$0")/../packages/@genesis/database"

echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🔧 Generating Prisma client..."
pnpm db:generate

echo ""
echo "🚀 Running database migrations..."
pnpm db:migrate

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📊 Database Info:"
echo "  URL: postgresql://neolith:neolith@localhost:5432/neolith"
echo ""
echo "🛠️  Useful commands:"
echo "  View database:    pnpm db:studio"
echo "  Reset database:   pnpm db:reset"
echo "  Seed data:        pnpm db:seed"
echo "  New migration:    pnpm db:migrate"
